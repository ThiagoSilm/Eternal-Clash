// src/systems/userSystem.js

import userCache from "./userCacheSystem.js";

// =========================================================
// 📋 TEMPLATES E TIPOS
// =========================================================

/**
 * @typedef {object} EnergyState
 * @property {number} current
 * @property {number} max
 * @property {number} lastRegen - Timestamp do último tick de regeneração
 */

/**
 * @typedef {object} ArenaState
 * @property {number} attempts - Tentativas usadas hoje
 * @property {number} lastAttack - Timestamp do último ataque
 * @property {number} rank - Ranking atual na arena
 * @property {number} elo - Rating ELO do jogador
 * @property {number} wins - Vitórias totais
 * @property {number} losses - Derrotas totais
 */

/**
 * @typedef {object} TowerState
 * @property {number} floor - Andar atual da torre
 * @property {number} attempts - Tentativas usadas hoje
 * @property {number} lastAccess - Último acesso à torre
 * @property {number} tokens - Tokens de torre acumulados
 * @property {number} highestFloor - Maior andar já alcançado
 */

/**
 * @typedef {object} GuardianState
 * @property {string[]} unlocked - IDs dos guardiões desbloqueados
 * @property {string|null} equipped - ID do guardião equipado
 */

/**
 * @typedef {object} StatsState
 * @property {number} totalBattles - Total de batalhas
 * @property {number} wins - Vitórias totais
 * @property {number} losses - Derrotas totais
 * @property {number} cardsPlayed - Cartas jogadas
 * @property {number} damageDealt - Dano causado
 * @property {number} damageTaken - Dano recebido
 * @property {number} perfectWins - Vitórias perfeitas (sem dano)
 */

/**
 * @typedef {object} UserState
 * @property {string} id
 * @property {string} name
 * @property {number} level
 * @property {number} xp
 * @property {EnergyState} energy
 * @property {number} gold
 * @property {number} gems
 * @property {number} coupons
 * @property {object} inventory
 * @property {Array} cards
 * @property {object} decks
 * @property {Array} graveyard
 * @property {ArenaState} arena
 * @property {TowerState} tower
 * @property {GuardianState} guardians
 * @property {StatsState} stats
 * @property {object} flags
 * @property {number} createdAt
 * @property {number} lastModified
 * @property {number} lastLogin
 */

/** Template completo de usuário */
const USER_TEMPLATE = Object.freeze({
  id: "",
  name: "",
  level: 1,
  xp: 0,
  
  // Sistema de Energia
  energy: {
    current: 100,
    max: 100,
    lastRegen: Date.now(),
  },
  
  // Economia
  gold: 100,
  gems: 10,
  coupons: 0,
  
  // Inventário e Cartas
  inventory: {},
  cards: [],
  decks: {},
  graveyard: [],
  
  // Arena PvP
  arena: {
    attempts: 0,
    lastAttack: 0,
    rank: 1000,
    elo: 1000,
    wins: 0,
    losses: 0,
  },
  
  // Torre de Desafios
  tower: {
    floor: 1,
    attempts: 0,
    lastAccess: 0,
    tokens: 0,
    highestFloor: 1,
  },
  
  // Sistema de Guardiões
  guardians: {
    unlocked: [],
    equipped: null,
  },
  
  // Estatísticas
  stats: {
    totalBattles: 0,
    wins: 0,
    losses: 0,
    cardsPlayed: 0,
    damageDealt: 0,
    damageTaken: 0,
    perfectWins: 0,
  },
  
  // Flags e Conquistas
  flags: {
    tutorialCompleted: false,
    firstBattle: false,
    firstVictory: false,
  },
  
  // Metadados
  createdAt: Date.now(),
  lastModified: Date.now(),
  lastLogin: Date.now(),
});

// =========================================================
// 🔧 VALIDADORES E SANITIZADORES
// =========================================================

class UserValidator {
  /**
   * Valida e corrige o estado de energia
   */
  static sanitizeEnergy(energy, template) {
    if (!energy || typeof energy !== "object") {
      return structuredClone(template.energy);
    }

    const sanitized = {
      current: this._clamp(energy.current, 0, energy.max || template.energy.max),
      max: Math.max(1, Number(energy.max) || template.energy.max),
      lastRegen: Number(energy.lastRegen) || template.energy.lastRegen,
    };

    // Garante que current não excede max
    if (sanitized.current > sanitized.max) {
      sanitized.current = sanitized.max;
    }

    return sanitized;
  }

  /**
   * Valida e corrige o estado da arena
   */
  static sanitizeArena(arena, template) {
    if (!arena || typeof arena !== "object") {
      return structuredClone(template.arena);
    }

    return {
      attempts: this._clamp(arena.attempts, 0, Infinity),
      lastAttack: Number(arena.lastAttack) || 0,
      rank: this._clamp(arena.rank, 1, Infinity),
      elo: this._clamp(arena.elo, 0, Infinity),
      wins: this._clamp(arena.wins, 0, Infinity),
      losses: this._clamp(arena.losses, 0, Infinity),
    };
  }

  /**
   * Valida e corrige o estado da torre
   */
  static sanitizeTower(tower, template) {
    if (!tower || typeof tower !== "object") {
      return structuredClone(template.tower);
    }

    const floor = this._clamp(tower.floor, 1, Infinity);
    const highestFloor = Math.max(floor, this._clamp(tower.highestFloor, 1, Infinity));

    return {
      floor: floor,
      attempts: this._clamp(tower.attempts, 0, Infinity),
      lastAccess: Number(tower.lastAccess) || 0,
      tokens: this._clamp(tower.tokens, 0, Infinity),
      highestFloor: highestFloor,
    };
  }

  /**
   * Valida e corrige o estado dos guardiões
   */
  static sanitizeGuardians(guardians, template) {
    if (!guardians || typeof guardians !== "object") {
      return structuredClone(template.guardians);
    }

    const unlocked = Array.isArray(guardians.unlocked) 
      ? guardians.unlocked.filter(id => typeof id === "string")
      : [];

    const equipped = typeof guardians.equipped === "string" 
      ? guardians.equipped 
      : null;

    // Garante que o guardião equipado está desbloqueado
    if (equipped && !unlocked.includes(equipped)) {
      return { unlocked, equipped: null };
    }

    return { unlocked, equipped };
  }

  /**
   * Valida e corrige as estatísticas
   */
  static sanitizeStats(stats, template) {
    if (!stats || typeof stats !== "object") {
      return structuredClone(template.stats);
    }

    return {
      totalBattles: this._clamp(stats.totalBattles, 0, Infinity),
      wins: this._clamp(stats.wins, 0, Infinity),
      losses: this._clamp(stats.losses, 0, Infinity),
      cardsPlayed: this._clamp(stats.cardsPlayed, 0, Infinity),
      damageDealt: this._clamp(stats.damageDealt, 0, Infinity),
      damageTaken: this._clamp(stats.damageTaken, 0, Infinity),
      perfectWins: this._clamp(stats.perfectWins, 0, Infinity),
    };
  }

  /**
   * Valida cartas do usuário
   */
  static sanitizeCards(cards) {
    if (!Array.isArray(cards)) return [];

    return cards.filter(card => {
      if (!card || typeof card !== "object") return false;
      if (!card.uniqueId || !card.id) return false;
      return true;
    });
  }

  /**
   * Valida decks do usuário
   */
  static sanitizeDecks(decks) {
    if (!decks || typeof decks !== "object") return {};

    const sanitized = {};
    for (const [deckName, deck] of Object.entries(decks)) {
      if (Array.isArray(deck)) {
        sanitized[deckName] = deck.filter(cardId => typeof cardId === "string");
      }
    }

    return sanitized;
  }

  /**
   * Valida flags
   */
  static sanitizeFlags(flags, template) {
    if (!flags || typeof flags !== "object") {
      return structuredClone(template.flags);
    }

    const sanitized = { ...template.flags };
    for (const key of Object.keys(template.flags)) {
      if (typeof flags[key] === "boolean") {
        sanitized[key] = flags[key];
      }
    }

    return sanitized;
  }

  /**
   * Utilitário: limita valor entre min e max
   */
  static _clamp(value, min, max) {
    const num = Number(value);
    if (isNaN(num)) return min;
    return Math.max(min, Math.min(max, num));
  }

  /**
   * Utilitário: valida timestamp
   */
  static _validateTimestamp(value, fallback = Date.now()) {
    const num = Number(value);
    if (isNaN(num) || num < 0) return fallback;
    return num;
  }
}

// =========================================================
// 🛠️ SISTEMA DE SANITIZAÇÃO PRINCIPAL
// =========================================================

class UserSanitizer {
  /**
   * Sanitiza completamente um objeto de usuário
   */
  static sanitize(rawUser) {
    if (!rawUser || typeof rawUser !== "object") {
      console.warn("[UserSystem] Usuário inválido recebido, criando novo.");
      return this.createNew("invalid_user");
    }

    const sanitized = { ...rawUser };
    let isDirty = false;

    // Campos primitivos
    const primitives = {
      id: { type: "string", default: "" },
      name: { type: "string", default: "" },
      level: { type: "number", default: 1, min: 1 },
      xp: { type: "number", default: 0, min: 0 },
      gold: { type: "number", default: 0, min: 0 },
      gems: { type: "number", default: 0, min: 0 },
      coupons: { type: "number", default: 0, min: 0 },
      createdAt: { type: "timestamp", default: Date.now() },
      lastModified: { type: "timestamp", default: Date.now() },
      lastLogin: { type: "timestamp", default: Date.now() },
    };

    for (const [key, config] of Object.entries(primitives)) {
      const current = rawUser[key];
      const template = USER_TEMPLATE[key];

      if (config.type === "string") {
        if (typeof current !== "string") {
          sanitized[key] = config.default;
          isDirty = true;
        }
      } else if (config.type === "number") {
        const num = Number(current);
        if (isNaN(num) || (config.min !== undefined && num < config.min)) {
          sanitized[key] = config.default;
          isDirty = true;
        }
      } else if (config.type === "timestamp") {
        sanitized[key] = UserValidator._validateTimestamp(current, config.default);
        if (sanitized[key] !== current) isDirty = true;
      }
    }

    // Objetos complexos
    const complexFields = {
      energy: () => UserValidator.sanitizeEnergy(rawUser.energy, USER_TEMPLATE),
      arena: () => UserValidator.sanitizeArena(rawUser.arena, USER_TEMPLATE),
      tower: () => UserValidator.sanitizeTower(rawUser.tower, USER_TEMPLATE),
      guardians: () => UserValidator.sanitizeGuardians(rawUser.guardians, USER_TEMPLATE),
      stats: () => UserValidator.sanitizeStats(rawUser.stats, USER_TEMPLATE),
      flags: () => UserValidator.sanitizeFlags(rawUser.flags, USER_TEMPLATE),
      cards: () => UserValidator.sanitizeCards(rawUser.cards),
      decks: () => UserValidator.sanitizeDecks(rawUser.decks),
    };

    for (const [key, sanitizer] of Object.entries(complexFields)) {
      const original = rawUser[key];
      const sanitized_value = sanitizer();
      
      if (JSON.stringify(original) !== JSON.stringify(sanitized_value)) {
        sanitized[key] = sanitized_value;
        isDirty = true;
      } else {
        sanitized[key] = original;
      }
    }

    // Inventário e Cemitério
    if (!sanitized.inventory || typeof sanitized.inventory !== "object") {
      sanitized.inventory = {};
      isDirty = true;
    }

    if (!Array.isArray(sanitized.graveyard)) {
      sanitized.graveyard = [];
      isDirty = true;
    }

    // Atualiza lastModified se houve mudanças
    if (isDirty) {
      sanitized.lastModified = Date.now();
      console.log(`[UserSystem] Usuário ${sanitized.id} sanitizado e marcado como modificado.`);
    }

    return { sanitized, isDirty };
  }

  /**
   * Cria um novo usuário com valores padrão
   */
  static createNew(userId) {
    const newUser = structuredClone(USER_TEMPLATE);
    newUser.id = userId;
    newUser.name = `Gladiador_${userId.slice(0, 8)}`;
    newUser.createdAt = Date.now();
    newUser.lastModified = Date.now();
    newUser.lastLogin = Date.now();
    
    console.log(`[UserSystem] Novo usuário criado: ${userId}`);
    return newUser;
  }
}

// =========================================================
// 📦 API PÚBLICA
// =========================================================

/**
 * Carrega um usuário do cache/disco com sanitização completa
 */
export async function loadUser(userId) {
  if (!userId || typeof userId !== "string") {
    throw new Error("[UserSystem] userId inválido");
  }

  try {
    // Obtém do cache
    const rawUser = await userCache.getUser(userId);
    
    // Sanitiza
    const { sanitized, isDirty } = UserSanitizer.sanitize(rawUser);
    
    // Salva se houve correções
    if (isDirty) {
      await userCache.saveUser(userId, sanitized);
    }

    // Atualiza lastLogin
    sanitized.lastLogin = Date.now();
    await userCache.saveUser(userId);

    return sanitized;
  } catch (error) {
    console.error(`[UserSystem] Erro ao carregar usuário ${userId}:`, error);
    throw error;
  }
}

/**
 * Salva alterações no usuário
 */
export async function saveUser(user) {
  if (!user || !user.id) {
    throw new Error("[UserSystem] Usuário inválido para salvamento");
  }

  try {
    user.lastModified = Date.now();
    await userCache.saveUser(user.id, user);
  } catch (error) {
    console.error(`[UserSystem] Erro ao salvar usuário ${user.id}:`, error);
    throw error;
  }
}

/**
 * Atualiza campos específicos do usuário
 */
export async function updateUser(userId, updates) {
  if (!userId || !updates || typeof updates !== "object") {
    throw new Error("[UserSystem] Parâmetros inválidos para atualização");
  }

  try {
    const user = await loadUser(userId);
    const updatedUser = { ...user, ...updates, lastModified: Date.now() };
    
    // Re-sanitiza após update
    const { sanitized } = UserSanitizer.sanitize(updatedUser);
    
    await userCache.saveUser(userId, sanitized);
    return sanitized;
  } catch (error) {
    console.error(`[UserSystem] Erro ao atualizar usuário ${userId}:`, error);
    throw error;
  }
}

/**
 * Obtém o nível de um usuário
 */
export async function getUserLevel(userId) {
  const user = await loadUser(userId);
  return user.level;
}

/**
 * Obtém informações básicas do usuário (sem carregamento completo)
 */
export function getUserInfo(userId) {
  const stats = userCache.getStats();
  // Retorna info do índice se disponível
  return {
    exists: userCache.diskIndex.has(userId),
    cached: userCache.cache.has(userId),
  };
}

/**
 * Busca uma carta específica no inventário do usuário
 */
export function getCardByUniqueId(user, uniqueId) {
  if (!user || !Array.isArray(user.cards)) {
    return null;
  }

  return user.cards.find(card => card?.uniqueId === uniqueId) || null;
}

/**
 * Busca cartas por ID (pode retornar múltiplas cópias)
 */
export function getCardsByCardId(user, cardId) {
  if (!user || !Array.isArray(user.cards)) {
    return [];
  }

  return user.cards.filter(card => card?.id === cardId);
}

/**
 * Adiciona uma carta ao inventário do usuário
 */
export async function addCard(userId, card) {
  if (!card || !card.id) {
    throw new Error("[UserSystem] Carta inválida");
  }

  const user = await loadUser(userId);
  
  // Gera uniqueId se não existir
  if (!card.uniqueId) {
    card.uniqueId = `${card.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  user.cards.push(card);
  await saveUser(user);

  console.log(`[UserSystem] Carta ${card.id} adicionada ao usuário ${userId}`);
  return card;
}

/**
 * Remove uma carta do inventário
 */
export async function removeCard(userId, uniqueId, toGraveyard = true) {
  const user = await loadUser(userId);
  const cardIndex = user.cards.findIndex(c => c?.uniqueId === uniqueId);

  if (cardIndex === -1) {
    throw new Error(`[UserSystem] Carta ${uniqueId} não encontrada`);
  }

  const [removedCard] = user.cards.splice(cardIndex, 1);

  if (toGraveyard) {
    user.graveyard.push({
      ...removedCard,
      removedAt: Date.now(),
    });
  }

  await saveUser(user);

  console.log(`[UserSystem] Carta ${uniqueId} removida do usuário ${userId}`);
  return removedCard;
}

/**
 * Adiciona recursos ao usuário (gold, gems, xp, etc.)
 */
export async function addResource(userId, resource, amount) {
  if (amount <= 0) return;

  const user = await loadUser(userId);
  
  if (typeof user[resource] !== "number") {
    throw new Error(`[UserSystem] Recurso inválido: ${resource}`);
  }

  user[resource] += amount;
  
  // XP pode causar level up
  if (resource === "xp") {
    await _checkLevelUp(user);
  }

  await saveUser(user);
  console.log(`[UserSystem] +${amount} ${resource} para ${userId}`);
  
  return user[resource];
}

/**
 * Remove recursos do usuário
 */
export async function removeResource(userId, resource, amount) {
  if (amount <= 0) return;

  const user = await loadUser(userId);
  
  if (typeof user[resource] !== "number") {
    throw new Error(`[UserSystem] Recurso inválido: ${resource}`);
  }

  if (user[resource] < amount) {
    throw new Error(`[UserSystem] Recursos insuficientes: ${resource}`);
  }

  user[resource] -= amount;
  await saveUser(user);

  console.log(`[UserSystem] -${amount} ${resource} do ${userId}`);
  return user[resource];
}

/**
 * Verifica e processa level up
 */
async function _checkLevelUp(user) {
  const xpNeeded = calculateXPForLevel(user.level + 1);
  
  if (user.xp >= xpNeeded) {
    user.level++;
    user.xp -= xpNeeded;
    
    // Recompensas de level up
    user.gold += user.level * 50;
    user.gems += Math.floor(user.level / 5);
    user.energy.max += 10;
    user.energy.current = user.energy.max;

    console.log(`[UserSystem] 🎉 ${user.id} subiu para nível ${user.level}!`);
    
    // Verifica se subiu múltiplos níveis
    if (user.xp >= calculateXPForLevel(user.level + 1)) {
      await _checkLevelUp(user);
    }
  }
}

/**
 * Calcula XP necessário para um nível
 */
export function calculateXPForLevel(level) {
  return Math.floor(100 * Math.pow(1.5, level - 1));
}

/**
 * Retorna o template de usuário (somente leitura)
 */
export function getUserTemplate() {
  return structuredClone(USER_TEMPLATE);
}

// =========================================================
// 📊 EXPORTAÇÕES
// =========================================================

export default {
  loadUser,
  saveUser,
  updateUser,
  getUserLevel,
  getUserInfo,
  getCardByUniqueId,
  getCardsByCardId,
  addCard,
  removeCard,
  addResource,
  removeResource,
  calculateXPForLevel,
  getUserTemplate,
};