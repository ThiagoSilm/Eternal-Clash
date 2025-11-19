// src/systems/economySystem.js

import { markUserDirty } from "./userCacheSystem.js";

// =========================================================
// ⚙️ CONFIGURAÇÕES & CONSTANTES
// =========================================================

export const DEFAULT_MAX_ENERGY = 100;
export const REGEN_RATE_MS = 5 * 60 * 1000; // 5 minutos por 1 energia
export const ONE_HOUR_MS = 60 * 60 * 1000;

/**
 * Tipos de moedas disponíveis no jogo.
 */
export const CURRENCY_TYPES = {
  GOLD: "gold",
  GEMS: "gems",
  COUPONS: "coupons",
  BOUND_GEMS: "boundGems", // Gemas vinculadas/não negociáveis
  EVENT_TOKEN: "eventToken"
};

/**
 * Tipos de energia que o usuário possui.
 */
export const ENERGY_TYPES = {
  ADVENTURE: "adventure",
  ARENA: "arena",
  RAID: "raid"
};

/**
 * @typedef {object} EnergyState
 * @property {number} current - Valor atual da energia.
 * @property {number} max - Limite máximo da energia.
 * @property {number} lastRegen - Timestamp da última regeneração.
 */

/**
 * @typedef {object} UserState
 * @property {string} id - ID único do usuário.
 * @property {number} [level=1] - Nível do usuário.
 * @property {number} [xp=0] - XP atual.
 * @property {number} [vipLevel=0] - Nível VIP (para multiplicadores).
 * @property {Object.<string, number>} [gold=0] - Saldo das moedas (ex: gold, gems).
 * @property {Object.<string, number>} [buffs] - Multiplicadores de bônus temporários.
 * @property {Object.<string, EnergyState>} [energy] - Estado da energia por tipo (ex: adventure).
 * @property {Object.<string, number>} [dailyCaps] - Contagem atual dos limites diários.
 * @property {number} [lastOfflineReward] - Timestamp da última coleta offline.
 * @property {Object.<string, number>} [inventory] - Inventário de itens.
 * @property {number} [lastShopVisit] - Timestamp da última visita à loja.
 */

/**
 * Multiplicadores de economia globais (pode ser usado para eventos).
 */
export const globalEconomyModifiers = { gold: 1, xp: 1, gems: 1 };


// =========================================================
// 📈 MULTIPLICADORES E CÁLCULO
// =========================================================

/**
 * Aplica o multiplicador a um valor base e retorna um inteiro (piso).
 * @param {number} base - O valor original.
 * @param {number} mult - O multiplicador total.
 * @returns {number} O valor final arredondado para baixo.
 */
export function applyMultiplier(base, mult) {
  return Math.floor(base * mult);
}

/**
 * Calcula o multiplicador total aplicável a um tipo de recurso para o usuário.
 * @param {UserState} user - Objeto do usuário.
 * @param {string} type - Tipo de recurso (gold, xp, gems).
 * @returns {number} Multiplicador total.
 */
export function getUserMultiplier(user, type) {
  let mult = 1;
  
  // 1. Multiplicador VIP
  mult += (user.vipLevel || 0) * 0.05; 
  
  // 2. Multiplicador de Buffs/Itens
  if (user.buffs?.[type]) mult *= user.buffs[type];
  
  // 3. Multiplicador Global/Evento
  if (globalEconomyModifiers[type]) mult *= globalEconomyModifiers[type];
  
  return mult;
}

// ----------------------------------------------------
// Auxiliar: Encontra um tipo de moeda válido (case-insensitive)
function isValidCurrency(type) {
    const key = type.toUpperCase();
    return Object.values(CURRENCY_TYPES).includes(type) || CURRENCY_TYPES[key];
}

// ----------------------------------------------------
// Auxiliar: Encontra um tipo de energia válido (case-insensitive)
function isValidEnergyType(type) {
    const key = type.toUpperCase();
    return Object.values(ENERGY_TYPES).includes(type) || ENERGY_TYPES[key];
}

// =========================================================
// 💵 WALLET — MOEDAS E RECURSOS
// =========================================================

/**
 * Adiciona uma quantidade de moeda ao saldo do usuário, aplicando multiplicadores.
 * @param {UserState} user - Objeto do usuário (mutável).
 * @param {string} type - O tipo de moeda (ex: 'gold', 'gems').
 * @param {number} amount - A quantidade base a ser adicionada.
 * @returns {boolean} True se a moeda for válida e adicionada, false caso contrário.
 */
export function addCurrency(user, type, amount) {
  if (!isValidCurrency(type) || amount <= 0) return false;
  
  amount = applyMultiplier(amount, getUserMultiplier(user, type));
  
  // Inicializa o campo se for nulo
  user[type] = (user[type] || 0) + amount; 
  markUserDirty(user.id);
  return true;
}

/**
 * Gasta uma quantidade de moeda do saldo do usuário.
 * @param {UserState} user - Objeto do usuário (mutável).
 * @param {string} type - O tipo de moeda (ex: 'gold', 'gems').
 * @param {number} amount - A quantidade a ser gasta.
 * @returns {boolean} True se o saldo for suficiente, false caso contrário.
 */
export function spendCurrency(user, type, amount) {
  if (!isValidCurrency(type) || amount <= 0) return false;
  if ((user[type] || 0) < amount) return false;
  
  user[type] -= amount;
  markUserDirty(user.id);
  return true;
}

/**
 * Obtém o saldo atual de uma moeda.
 * @param {UserState} user - Objeto do usuário.
 * @param {string} type - O tipo de moeda (padrão: 'gold').
 * @returns {number} O saldo.
 */
export function getBalance(user, type = CURRENCY_TYPES.GOLD) {
  return user[type] || 0;
}

// ---------------------------------------------------------
// WRAPPERS PARA MOEDAS COMUNS (Mantendo compatibilidade)
// ---------------------------------------------------------
export const addGold = (u, v) => addCurrency(u, CURRENCY_TYPES.GOLD, v);
export const spendGold = (u, v) => spendCurrency(u, CURRENCY_TYPES.GOLD, v);

export const addGems = (u, v) => addCurrency(u, CURRENCY_TYPES.GEMS, v);
export const spendGems = (u, v) => spendCurrency(u, CURRENCY_TYPES.GEMS, v);

export const addCoupons = (u, v) => addCurrency(u, CURRENCY_TYPES.COUPONS, v);
export const spendCoupons = (u, v) => spendCurrency(u, CURRENCY_TYPES.COUPONS, v);


// =========================================================
// ⚡ ENERGIA E REGENERAÇÃO
// =========================================================

/**
 * Garante que o objeto user.energy e todos os tipos de energia necessários estejam inicializados.
 * @param {UserState} user - Objeto do usuário (mutável).
 */
export function ensureEnergy(user) {
  user.energy = user.energy || {};
  for (const type of Object.values(ENERGY_TYPES)) {
    if (!user.energy[type]) {
      user.energy[type] = {
        current: DEFAULT_MAX_ENERGY,
        max: DEFAULT_MAX_ENERGY,
        lastRegen: Date.now()
      };
    }
  }
}

/**
 * Gasta energia de um tipo específico.
 * @param {UserState} user - Objeto do usuário (mutável).
 * @param {string} type - Tipo de energia (ex: 'adventure').
 * @param {number} amount - Quantidade a ser gasta.
 * @returns {boolean} True se o gasto for bem-sucedido, false caso contrário.
 */
export function spendEnergy(user, type, amount) {
  if (!isValidEnergyType(type) || amount <= 0) return false;
    
  ensureEnergy(user);
  const e = user.energy[type];
  
  if (e.current < amount) return false;
  
  e.current -= amount;
  markUserDirty(user.id);
  return true;
}

/**
 * Adiciona energia de um tipo específico, respeitando o limite máximo.
 * @param {UserState} user - Objeto do usuário (mutável).
 * @param {string} type - Tipo de energia.
 * @param {number} amount - Quantidade a ser adicionada.
 * @returns {number} A quantidade **realmente** adicionada.
 */
export function addEnergy(user, type, amount) {
  if (!isValidEnergyType(type) || amount <= 0) return 0;

  ensureEnergy(user);
  const e = user.energy[type];
  
  const added = Math.min(e.max - e.current, amount);
  if (added <= 0) return 0;

  e.current += added;
  markUserDirty(user.id);
  return added;
}

/**
 * Processa a regeneração de energia para todos os tipos.
 * @param {UserState} user - Objeto do usuário (mutável).
 * @returns {string | null} Mensagem de regeneração ou null se não houve mudança.
 */
export function regenerateEnergy(user) {
  ensureEnergy(user);
  const now = Date.now();
  let totalRegen = [];
  
  for (const type of Object.values(ENERGY_TYPES)) {
    const e = user.energy[type];
    const elapsed = now - e.lastRegen;
    
    // Calcula quantos pontos inteiros devem ter regenerado
    const points = Math.floor(elapsed / REGEN_RATE_MS); 
    if (points <= 0) continue;
    
    const before = e.current;
    
    // Aplica regeneração (limitado ao máximo)
    e.current = Math.min(e.max, e.current + points);
    
    // Ajusta o último timestamp de regeneração para o tempo restante
    e.lastRegen = now - (elapsed % REGEN_RATE_MS); 
    
    if (e.current > before) {
        totalRegen.push(`${type}: +${e.current - before}`);
    }
  }
  
  if (totalRegen.length === 0) return null;
  markUserDirty(user.id);
  return `⚡ Energia regenerada:\n${totalRegen.join("\n")}`;
}


// =========================================================
// 🏆 XP E LEVEL UP
// =========================================================

/**
 * Calcula o XP necessário para o próximo nível.
 * @param {number} level - Nível atual.
 * @returns {number} XP necessário.
 */
export function getXPForNextLevel(level) {
  // Fórmula: 1000 * level^2.2
  return Math.floor(1000 * Math.pow(level, 2.2));
}

/**
 * Adiciona XP e processa o level-up automático.
 * @param {UserState} user - Objeto do usuário (mutável).
 * @param {number} amount - Quantidade base de XP a ser adicionada.
 * @returns {string | null} Mensagem de level-up ou null se não houver nível.
 */
export function addXP(user, amount) {
  if (amount <= 0) return null;
    
  amount = applyMultiplier(amount, getUserMultiplier(user, CURRENCY_TYPES.XP)); // Assume XP como tipo 'xp'
  
  user.level = user.level || 1;
  user.xp = user.xp || 0;
  user.xp += amount;
  
  let msg = null;
  
  // Processamento de Level-Up
  while (true) {
    const need = getXPForNextLevel(user.level);
    if (user.xp >= need) {
      user.xp -= need;
      user.level++;
      msg = msg ?
        msg + `\n✨ Subiu para o nível ${user.level}!` :
        `✨ Subiu para o nível ${user.level}!`;
    } else break;
  }
  
  markUserDirty(user.id);
  return msg;
}

// =========================================================
// 🚫 DAILY CAPS
// =========================================================

/**
 * Adiciona uma moeda, respeitando um limite diário.
 * @param {UserState} user - Objeto do usuário (mutável).
 * @param {string} type - Tipo de moeda a ser adicionada.
 * @param {number} amount - Quantidade base a tentar adicionar.
 * @param {string} capField - Campo de rastreamento do limite diário (ex: 'goldFromDungeons').
 * @param {number} capLimit - O limite máximo.
 * @returns {number} A quantidade **realmente** dada ao usuário.
 */
export function addWithDailyCap(user, type, amount, capField, capLimit) {
  if (!isValidCurrency(type) || amount <= 0) return 0;
    
  user.dailyCaps = user.dailyCaps || {};
  user.dailyCaps[capField] = user.dailyCaps[capField] || 0;
  
  const available = capLimit - user.dailyCaps[capField];
  if (available <= 0) return 0;
  
  const given = Math.min(amount, available);
  user.dailyCaps[capField] += given;
  
  // Usa addCurrency para aplicar o multiplicador antes de adicionar
  addCurrency(user, type, given); 
  
  return given;
}

// =========================================================
// ⏳ RECOMPENSAS OFFLINE
// =========================================================

/**
 * Calcula e concede recompensas por tempo offline (simulando mineração/produção).
 * @param {UserState} user - Objeto do usuário (mutável).
 * @returns {string | null} Mensagem de recompensa ou null.
 */
export function claimOfflineRewards(user) {
  const now = Date.now();
  
  // lastOfflineReward é o timestamp da última coleta (ou 'now' se for a primeira vez)
  const last = user.lastOfflineReward || now; 
  
  const elapsedMs = now - last;
  const hours = Math.floor(elapsedMs / ONE_HOUR_MS);
  
  if (hours < 1) return null;
  
  // Defina taxas de recompensa por hora
  const goldRate = 20;
  const xpRate = 15;
  
  const gold = hours * goldRate;
  const xp = hours * xpRate;
  
  // Usa addGold/addXP para aplicar multiplicadores
  addGold(user, gold); 
  addXP(user, xp);
  
  user.lastOfflineReward = now;
  markUserDirty(user.id);
  
  return `⏳ Você recebeu **${gold} ouro** e **${xp} XP** por ${hours}h offline.`;
}

// =========================================================
// 🛍️ INVENTÁRIO & LOJA
// =========================================================

/**
 * Adiciona um item ao inventário do usuário.
 * @param {UserState} user - Objeto do usuário (mutável).
 * @param {string} itemId - ID do item.
 * @param {number} [quantity=1] - Quantidade a adicionar.
 * @returns {boolean} True se o item foi adicionado.
 */
export function addItem(user, itemId, quantity = 1) {
  if (!itemId || quantity <= 0) return false;
  
  user.inventory = user.inventory || {};
  user.inventory[itemId] = (user.inventory[itemId] || 0) + quantity;
  markUserDirty(user.id);
  return true;
}

/**
 * Atualiza o timestamp da última visita do usuário à loja.
 * @param {UserState} user - Objeto do usuário (mutável).
 * @returns {boolean} True se o timestamp foi atualizado.
 */
export function updateLastShopVisit(user) {
  if (!user) return false;
  user.lastShopVisit = Date.now();
  markUserDirty(user.id);
  return true;
}
