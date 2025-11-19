// src/systems/economySystem.js
import { markUserDirty } from "./userCacheSystem.js";

// =========================================================
// CONFIGURAÇÕES
// =========================================================
export const DEFAULT_MAX_ENERGY = 100;
export const REGEN_RATE_MS = 5 * 60 * 1000; // 5 minutos por 1 energia

export const CURRENCY_TYPES = {
  GOLD: "gold",
  GEMS: "gems",
  COUPONS: "coupons",
  BOUND_GEMS: "boundGems",
  EVENT_TOKEN: "eventToken"
};

export const ENERGY_TYPES = {
  ADVENTURE: "adventure",
  ARENA: "arena",
  RAID: "raid"
};

// =========================================================
// MULTIPLICADORES
// =========================================================
export const globalEconomyModifiers = { gold: 1, xp: 1, gems: 1 };

export function applyMultiplier(base, mult) {
  return Math.floor(base * mult);
}

export function getUserMultiplier(user, type) {
  let mult = 1;
  if (user.vipLevel) mult += user.vipLevel * 0.05;
  if (user.buffs?.[type]) mult *= user.buffs[type];
  if (globalEconomyModifiers[type]) mult *= globalEconomyModifiers[type];
  return mult;
}

// =========================================================
// XP E LEVEL UP
// =========================================================
export function getXPForNextLevel(level) {
  return Math.floor(1000 * Math.pow(level, 2.2));
}

export function addXP(user, amount) {
  amount = applyMultiplier(amount, getUserMultiplier(user, "xp"));
  user.level ??= 1;
  user.xp ??= 0;
  user.xp += amount;
  
  let msg = null;
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
// WALLET — MOEDAS E RECURSOS
// =========================================================
export function addCurrency(user, type, amount) {
  if (!CURRENCY_TYPES[type.toUpperCase()]) return false;
  amount = applyMultiplier(amount, getUserMultiplier(user, type));
  user[type] = (user[type] || 0) + amount;
  markUserDirty(user.id);
  return true;
}

export function spendCurrency(user, type, amount) {
  if (!CURRENCY_TYPES[type.toUpperCase()]) return false;
  if ((user[type] || 0) < amount) return false;
  user[type] -= amount;
  markUserDirty(user.id);
  return true;
}

// =========================================================
// WRAPPERS PARA GOLD, GEMS, COUPONS
// =========================================================
export const addGold = (u, v) => addCurrency(u, "gold", v);
export const spendGold = (u, v) => spendCurrency(u, "gold", v);

export const addGems = (u, v) => addCurrency(u, "gems", v);
export const spendGems = (u, v) => spendCurrency(u, "gems", v);

export const addCoupons = (u, v) => addCurrency(u, "coupons", v);
export const spendCoupons = (u, v) => spendCurrency(u, "coupons", v);

// =========================================================
// GET BALANCE
// =========================================================
export function getBalance(user, type = "gold") {
  return user[type] || 0;
}

// =========================================================
// DAILY CAPS
// =========================================================
export function addWithDailyCap(user, type, amount, capField, capLimit) {
  user.dailyCaps ??= {};
  user.dailyCaps[capField] ??= 0;
  const available = capLimit - user.dailyCaps[capField];
  if (available <= 0) return 0;
  const given = Math.min(amount, available);
  user.dailyCaps[capField] += given;
  addCurrency(user, type, given);
  return given;
}

// =========================================================
// ENERGIA
// =========================================================
export function ensureEnergy(user) {
  user.energy ??= {};
  for (const k of Object.keys(ENERGY_TYPES)) {
    const type = ENERGY_TYPES[k];
    if (!user.energy[type]) {
      user.energy[type] = {
        current: DEFAULT_MAX_ENERGY,
        max: DEFAULT_MAX_ENERGY,
        lastRegen: Date.now()
      };
    }
  }
}

export function spendEnergy(user, type, amount) {
  ensureEnergy(user);
  const e = user.energy[type];
  if (e.current < amount) return false;
  e.current -= amount;
  markUserDirty(user.id);
  return true;
}

export function addEnergy(user, type, amount) {
  ensureEnergy(user);
  const e = user.energy[type];
  const added = Math.min(e.max - e.current, amount);
  e.current += added;
  markUserDirty(user.id);
  return added;
}

export function regenerateEnergy(user) {
  ensureEnergy(user);
  const now = Date.now();
  let totalRegen = [];
  
  for (const type of Object.values(ENERGY_TYPES)) {
    const e = user.energy[type];
    const elapsed = now - e.lastRegen;
    const points = Math.floor(elapsed / REGEN_RATE_MS);
    if (points <= 0) continue;
    const before = e.current;
    e.current = Math.min(e.max, e.current + points);
    e.lastRegen = now - (elapsed % REGEN_RATE_MS);
    if (e.current > before) totalRegen.push(`${type}: +${e.current - before}`);
  }
  
  if (totalRegen.length === 0) return null;
  markUserDirty(user.id);
  return `⚡ Energia regenerada:\n${totalRegen.join("\n")}`;
}

// =========================================================
// RECOMPENSAS OFFLINE
// =========================================================
export function claimOfflineRewards(user) {
  const now = Date.now();
  const last = user.lastOfflineReward || now;
  const hours = Math.floor((now - last) / (60 * 60 * 1000));
  if (hours < 1) return null;
  
  const gold = hours * 20;
  const xp = hours * 15;
  
  addGold(user, gold);
  addXP(user, xp);
  
  user.lastOfflineReward = now;
  markUserDirty(user.id);
  
  return `⏳ Você recebeu **${gold} ouro** e **${xp} XP** por ${hours}h offline.`;
}

// Atualiza a última visita do usuário à loja
export function updateLastShopVisit(user) {
  if (!user) return false;
  user.lastShopVisit = Date.now();
  markUserDirty(user.id);
  return true;
}