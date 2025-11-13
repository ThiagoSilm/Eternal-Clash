import fs from "fs";
import path from "path";

// --- Configuração e Estado do Cache ---
const dataPath = path.join(process.cwd(), "data/users.json");
const cache = new Map(); // Cache in-memory para dados do usuário
const dirty = new Set(); // Conjunto de IDs de usuários com dados alterados
let allDiskData = {}; // Todos os dados lidos do disco

/**
 * Carrega todos os dados de usuários do arquivo users.json para a memória (allDiskData).
 */
function loadAllDiskData() {
  if (fs.existsSync(dataPath)) {
    try {
      const data = fs.readFileSync(dataPath, "utf-8");
      allDiskData = JSON.parse(data);
      console.log(`[Cache] Dados de ${Object.keys(allDiskData).length} usuários carregados do disco.`);
    } catch (e) {
      console.error("Erro ao ler ou desserializar users.json. Iniciando com cache vazio.", e);
      allDiskData = {};
    }
  } else {
    console.log("[Cache] Arquivo users.json não encontrado. Será criado ao salvar.");
  }
}

// Carrega os dados na inicialização do sistema
loadAllDiskData();

// --- Funções Exportadas ---

/**
 * Carrega os dados de um usuário do cache ou do disco.
 * Se o usuário não existir, cria um novo objeto com dados iniciais padrão.
 * @param {string} userId - O ID único do usuário.
 * @returns {object} O objeto usuário.
 */
export function loadUserCached(userId) {
  if (cache.has(userId)) return cache.get(userId);
  
  let userData = allDiskData[userId] || null;
  
  if (!userData) {
    // Criação de um novo usuário com dados iniciais ricos (herdado do mock)
    userData = {
      id: userId,
      username: `Player_${userId.substring(0, 4)}`,
      level: 1,
      xp: 0,
      gold: 10000,
      gems: 100,
      coupons: 5,
      clanId: null,
      // Inicialização de energia padronizada para o economySystem.js
      energy: { current: 100, max: 100, lastRegen: Date.now() },
      dailyBonusReceived: {},
      cards: [],
      lastEnergyRegen: Date.now(), // Usado por dailyEnergySystem
    };
    console.log(`[Cache] Novo usuário criado: ${userId}`);
  }
  
  // Coloca no cache e retorna
  cache.set(userId, userData);
  return userData;
}

/**
 * Marca o ID do usuário como 'dirty' (sujo), indicando que ele precisa ser salvo no disco.
 * @param {string} userId - O ID único do usuário.
 */
export function markUserDirty(userId) {
  dirty.add(userId);
  // console.log(`[Cache] Usuário ${userId} marcado como sujo.`);
}

/**
 * Persiste todos os dados de usuários 'sujos' para o arquivo users.json.
 */
export function flushCache() {
  if (dirty.size === 0) {
    // console.log("[Cache] Nenhum usuário sujo para salvar.");
    return;
  }
  
  // Itera sobre os IDs sujos e atualiza o objeto de dados do disco
  dirty.forEach((userId) => {
    const user = cache.get(userId);
    if (user) {
      allDiskData[userId] = user;
    } else {
      // Caso o usuário tenha sido marcado como sujo, mas removido do cache (cenário incomum)
      delete allDiskData[userId];
    }
  });
  
  const usersToSaveCount = dirty.size;
  
  try {
    fs.writeFileSync(dataPath, JSON.stringify(allDiskData, null, 2));
    dirty.clear();
    console.log(`[Cache] ${usersToSaveCount} usuários salvos no users.json.`);
  } catch (e) {
    console.error("FATAL ERROR: Falha ao escrever users.json no disco.", e);
  }
}

/**
 * Função de limpeza, mantida para compatibilidade com outros sistemas.
 * Agora, apenas um alias para flushCache.
 */
export function flushDirtyUsers() {
  flushCache();
}