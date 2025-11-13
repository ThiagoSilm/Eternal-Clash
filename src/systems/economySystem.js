// src/systems/economySystem.js
import { loadUserCached, markUserDirty } from "./userCacheSystem.js";

/**
 * Adiciona ouro ao usuário
 */
export function addGold(userId, amount) {
  const user = loadUserCached(userId);
  user.gold += amount;
  markUserDirty(userId);
}

/**
 * Gasta ouro do usuário
 */
export function spendGold(userId, amount) {
  const user = loadUserCached(userId);
  if (user.gold < amount) return false;
  user.gold -= amount;
  markUserDirty(userId);
  return true;
}

/**
 * Adiciona gemas ao usuário
 */
export function addGems(userId, amount) {
  const user = loadUserCached(userId);
  user.gems += amount;
  markUserDirty(userId);
}

/**
 * Gasta gemas
 */
export function spendGems(userId, amount) {
  const user = loadUserCached(userId);
  if (user.gems < amount) return false;
  user.gems -= amount;
  markUserDirty(userId);
  return true;
}

/**
 * Adiciona cupom ao usuário
 */
export function addCoupons(userId, amount) {
  const user = loadUserCached(userId);
  user.coupons += amount;
  markUserDirty(userId);
}

/**
 * Gasta cupom
 */
export function spendCoupons(userId, amount) {
  const user = loadUserCached(userId);
  if (user.coupons < amount) return false;
  user.coupons -= amount;
  markUserDirty(userId);
  return true;
}

/**
 * Adiciona XP de jogador e sobe nível
 */
export function addXP(userId, amount) {
  const user = loadUserCached(userId);
  if (!user.level) user.level = 1;
  if (!user.xp) user.xp = 0;
  
  user.xp += amount;
  
  const xpForNext = Math.floor(1000 * Math.pow(user.level, 2.2));
  if (user.xp >= xpForNext) {
    user.xp -= xpForNext;
    user.level++;
    markUserDirty(userId);
    return `✨ Subiu para o nível ${user.level}!`;
  }
  
  markUserDirty(userId);
  return null;
}