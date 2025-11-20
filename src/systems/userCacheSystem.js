// src/systems/userCacheSystem.js
import fs from "fs";
import path from "path";
import { EventEmitter } from "events";

// =========================================================
// ⚙️ CONFIGURAÇÃO E CONSTANTES
// =========================================================

const CONFIG = {
  dataFile: "users.json",
  backupFile: "users.backup.json",
  autoSaveInterval: 60000, // 1 minuto
  maxCacheSize: 1000, // Máximo de usuários em cache
  cacheEvictionTime: 300000, // 5 minutos sem acesso = remoção do cache
};

const dataPath = path.join(process.cwd(), `data/${CONFIG.dataFile}`);
const backupPath = path.join(process.cwd(), `data/${CONFIG.backupFile}`);
const tempPath = dataPath + ".tmp";

// =========================================================
// 📊 ESTADO INTERNO
// =========================================================

class UserCache extends EventEmitter {
  constructor() {
    super();
    
    // Cache principal: userId -> { data, lastAccess, dirty }
    this.cache = new Map();
    
    // Dados do disco (somente IDs e metadata leve)
    this.diskIndex = new Map();
    
    // Controle de operações
    this.isInitialized = false;
    this.isSaving = false;
    this.autoSaveTimer = null;
    this.stats = {
      hits: 0,
      misses: 0,
      saves: 0,
      errors: 0,
    };
  }

  // =========================================================
  // 🚀 INICIALIZAÇÃO
  // =========================================================

  async initialize() {
    if (this.isInitialized) {
      console.warn("[UserCache] Sistema já inicializado.");
      return;
    }

    try {
      await this._ensureDataDirectory();
      await this._loadDiskIndex();
      this._startAutoSave();
      
      this.isInitialized = true;
      console.log(`[UserCache] ✓ Sistema inicializado. ${this.diskIndex.size} usuários indexados.`);
      this.emit("initialized");
    } catch (error) {
      console.error("[UserCache] ✗ Falha na inicialização:", error);
      throw error;
    }
  }

  async _ensureDataDirectory() {
    const dataDir = path.dirname(dataPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
      console.log(`[UserCache] Diretório de dados criado: ${dataDir}`);
    }
  }

  async _loadDiskIndex() {
    if (!fs.existsSync(dataPath)) {
      console.log("[UserCache] Arquivo de dados não encontrado. Criando novo...");
      await this._writeDataFile({});
      return;
    }

    try {
      const raw = await fs.promises.readFile(dataPath, "utf8");
      const data = JSON.parse(raw);

      // Indexa apenas IDs e metadata básica
      for (const [userId, userData] of Object.entries(data)) {
        if (userData && typeof userData === "object" && userData.id) {
          this.diskIndex.set(userId, {
            id: userId,
            level: userData.level || 1,
            lastModified: userData.lastModified || Date.now(),
          });
        }
      }

      console.log(`[UserCache] ${this.diskIndex.size} usuários indexados do disco.`);
    } catch (error) {
      console.error("[UserCache] Erro ao carregar índice. Tentando backup...");
      await this._restoreFromBackup();
    }
  }

  async _restoreFromBackup() {
    if (!fs.existsSync(backupPath)) {
      console.warn("[UserCache] Backup não encontrado. Iniciando com dados vazios.");
      await this._writeDataFile({});
      return;
    }

    try {
      const raw = await fs.promises.readFile(backupPath, "utf8");
      const data = JSON.parse(raw);
      await this._writeDataFile(data);
      console.log("[UserCache] ✓ Dados restaurados do backup.");
    } catch (error) {
      console.error("[UserCache] ✗ Falha ao restaurar backup:", error);
      await this._writeDataFile({});
    }
  }

  // =========================================================
  // 📥 OPERAÇÕES DE LEITURA
  // =========================================================

  async getUser(userId) {
    this._assertInitialized();
    
    if (!userId || typeof userId !== "string") {
      throw new Error("[UserCache] userId inválido");
    }

    // Verifica se está em cache
    if (this.cache.has(userId)) {
      this.stats.hits++;
      const cached = this.cache.get(userId);
      cached.lastAccess = Date.now();
      return cached.data;
    }

    this.stats.misses++;

    // Carrega do disco
    const userData = await this._loadUserFromDisk(userId);
    
    // Adiciona ao cache
    this.cache.set(userId, {
      data: userData,
      lastAccess: Date.now(),
      dirty: false,
    });

    // Gerencia tamanho do cache
    this._evictOldEntries();

    return userData;
  }

  async _loadUserFromDisk(userId) {
    try {
      const raw = await fs.promises.readFile(dataPath, "utf8");
      const allData = JSON.parse(raw);
      
      if (allData[userId]) {
        return this._sanitizeUserData(allData[userId]);
      }

      // Usuário não existe, cria novo
      return this._createNewUser(userId);
    } catch (error) {
      console.error(`[UserCache] Erro ao carregar usuário ${userId}:`, error);
      return this._createNewUser(userId);
    }
  }

  _createNewUser(userId) {
    console.log(`[UserCache] Criando novo usuário: ${userId}`);
    
    return {
      id: userId,
      name: `Gladiador_${userId.slice(0, 8)}`,
      level: 1,
      xp: 0,
      gold: 100,
      gems: 10,
      
      energy: {
        current: 100,
        max: 100,
        lastRegen: Date.now(),
      },
      
      inventory: {},
      cards: [],
      decks: {},
      graveyard: [],
      
      stats: {
        wins: 0,
        losses: 0,
        totalBattles: 0,
      },
      
      elo: 1000,
      rank: "Bronze",
      
      createdAt: Date.now(),
      lastModified: Date.now(),
    };
  }

  _sanitizeUserData(userData) {
    // Garante que propriedades essenciais existam
    const defaults = this._createNewUser(userData.id);
    
    return {
      ...defaults,
      ...userData,
      energy: { ...defaults.energy, ...userData.energy },
      stats: { ...defaults.stats, ...userData.stats },
      lastModified: Date.now(),
    };
  }

  // =========================================================
  // 💾 OPERAÇÕES DE ESCRITA
  // =========================================================

  async saveUser(userId, updates = null) {
    this._assertInitialized();

    const cached = this.cache.get(userId);
    
    if (!cached) {
      throw new Error(`[UserCache] Usuário ${userId} não está em cache.`);
    }

    if (updates) {
      cached.data = { ...cached.data, ...updates, lastModified: Date.now() };
    }

    cached.dirty = true;
    cached.data.lastModified = Date.now();

    // Atualiza índice
    this.diskIndex.set(userId, {
      id: userId,
      level: cached.data.level,
      lastModified: cached.data.lastModified,
    });

    this.emit("userModified", userId);
  }

  async flushCache() {
    if (this.isSaving) {
      console.log("[UserCache] Salvamento já em andamento, aguardando...");
      return;
    }

    const dirtyUsers = Array.from(this.cache.entries())
      .filter(([_, cached]) => cached.dirty);

    if (dirtyUsers.length === 0) {
      return;
    }

    this.isSaving = true;
    console.log(`[UserCache] Salvando ${dirtyUsers.length} usuários modificados...`);

    try {
      // Carrega dados atuais do disco
      let diskData = {};
      if (fs.existsSync(dataPath)) {
        const raw = await fs.promises.readFile(dataPath, "utf8");
        diskData = JSON.parse(raw);
      }

      // Atualiza com dados do cache
      for (const [userId, cached] of dirtyUsers) {
        diskData[userId] = cached.data;
        cached.dirty = false;
      }

      // Cria backup antes de salvar
      if (fs.existsSync(dataPath)) {
        await fs.promises.copyFile(dataPath, backupPath);
      }

      // Salva de forma atômica
      await this._writeDataFile(diskData);

      this.stats.saves++;
      console.log(`[UserCache] ✓ ${dirtyUsers.length} usuários salvos com sucesso.`);
      this.emit("saved", dirtyUsers.length);

    } catch (error) {
      this.stats.errors++;
      console.error("[UserCache] ✗ Erro crítico ao salvar:", error);
      this.emit("error", error);
      throw error;
    } finally {
      this.isSaving = false;
    }
  }

  async _writeDataFile(data) {
    const jsonString = JSON.stringify(data, null, 2);
    
    // Escreve em arquivo temporário
    await fs.promises.writeFile(tempPath, jsonString, "utf8");
    
    // Renomeia atomicamente
    await fs.promises.rename(tempPath, dataPath);
  }

  // =========================================================
  // 🗑️ GERENCIAMENTO DE CACHE
  // =========================================================

  _evictOldEntries() {
    if (this.cache.size <= CONFIG.maxCacheSize) return;

    const now = Date.now();
    const entries = Array.from(this.cache.entries())
      .map(([userId, cached]) => ({
        userId,
        cached,
        age: now - cached.lastAccess,
      }))
      .sort((a, b) => b.age - a.age);

    // Remove os mais antigos
    const toRemove = entries.slice(CONFIG.maxCacheSize);
    
    for (const { userId, cached } of toRemove) {
      if (cached.dirty) {
        console.warn(`[UserCache] Evitando remoção de usuário sujo: ${userId}`);
        continue;
      }
      this.cache.delete(userId);
    }

    console.log(`[UserCache] ${toRemove.length} entradas removidas do cache.`);
  }

  clearInactiveUsers() {
    const now = Date.now();
    let removed = 0;

    for (const [userId, cached] of this.cache.entries()) {
      if (now - cached.lastAccess > CONFIG.cacheEvictionTime && !cached.dirty) {
        this.cache.delete(userId);
        removed++;
      }
    }

    if (removed > 0) {
      console.log(`[UserCache] ${removed} usuários inativos removidos do cache.`);
    }
  }

  // =========================================================
  // ⏰ AUTO-SAVE
  // =========================================================

  _startAutoSave() {
    this.autoSaveTimer = setInterval(async () => {
      try {
        await this.flushCache();
        this.clearInactiveUsers();
      } catch (error) {
        console.error("[UserCache] Erro no auto-save:", error);
      }
    }, CONFIG.autoSaveInterval);

    console.log(`[UserCache] Auto-save ativado (intervalo: ${CONFIG.autoSaveInterval}ms)`);
  }

  stopAutoSave() {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
      console.log("[UserCache] Auto-save desativado.");
    }
  }

  // =========================================================
  // 🎮 NPC GENERATOR
  // =========================================================

  generateNPC(elo) {
    const level = Math.max(1, Math.floor(elo / 100) + 1);
    const npcId = `npc_${elo}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    return {
      id: npcId,
      name: `Gladiador Rank ${level}`,
      level: level,
      gold: level * 50,
      gems: Math.floor(level / 5),
      
      energy: { current: 100, max: 100, lastRegen: Date.now() },
      inventory: {},
      cards: [],
      decks: {},
      graveyard: [],
      
      stats: {
        wins: Math.floor(Math.random() * level * 10),
        losses: Math.floor(Math.random() * level * 5),
        totalBattles: 0,
      },
      
      elo: elo,
      rank: this._getRankFromElo(elo),
      isNPC: true,
    };
  }

  _getRankFromElo(elo) {
    if (elo < 1200) return "Bronze";
    if (elo < 1400) return "Prata";
    if (elo < 1600) return "Ouro";
    if (elo < 1800) return "Platina";
    if (elo < 2000) return "Diamante";
    return "Lendário";
  }

  // =========================================================
  // 📊 UTILIDADES
  // =========================================================

  _assertInitialized() {
    if (!this.isInitialized) {
      throw new Error("[UserCache] Sistema não inicializado. Chame initialize() primeiro.");
    }
  }

  getStats() {
    return {
      ...this.stats,
      cacheSize: this.cache.size,
      diskUsers: this.diskIndex.size,
      dirtyUsers: Array.from(this.cache.values()).filter(c => c.dirty).length,
    };
  }

  async shutdown() {
    console.log("[UserCache] Desligando sistema...");
    this.stopAutoSave();
    await this.flushCache();
    this.cache.clear();
    this.diskIndex.clear();
    console.log("[UserCache] ✓ Sistema desligado com segurança.");
  }
}

// =========================================================
// 📤 EXPORTAÇÃO (Singleton)
// =========================================================

const userCache = new UserCache();

export default userCache;

// Exporta métodos principais
export const initialize = () => userCache.initialize();
export const getUser = (userId) => userCache.getUser(userId);
export const saveUser = (userId, updates) => userCache.saveUser(userId, updates);
export const flushCache = () => userCache.flushCache();
export const generateNPC = (elo) => userCache.generateNPC(elo);
export const getStats = () => userCache.getStats();
export const shutdown = () => userCache.shutdown();

// Compatibilidade com código antigo
export const loadUserCached = getUser;
export const markUserDirty = (userId) => userCache.cache.get(userId) && (userCache.cache.get(userId).dirty = true);
export const flushDirtyUsers = flushCache;
export const generateOpponentForRank = generateNPC;