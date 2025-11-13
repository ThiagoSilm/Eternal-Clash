// src/systems/economySystem.js
import { loadUserCached, markUserDirty } from "./userCacheSystem.js";

// ❌ FUNÇÃO saveUser REMOVIDA. 
// A função canônica de salvamento agora é saveUserData, exportada pelo userSystem.js.

/**
 * [HELPER] Calcula o XP total necessário para o próximo nível.
 */
export function getXPForNextLevel(currentLevel) {
  // Fórmula Exponencial: Base * (Nível ^ 2.2)
  return Math.floor(1000 * Math.pow(currentLevel, 2.2));
}

// --- FUNÇÕES DE RECURSOS ---

/**
 * Adiciona ouro ao usuário
 */
export function addGold(userId, amount) {
  const user = loadUserCached(userId);
  user.gold = (user.gold || 0) + amount;
  markUserDirty(userId);
}

/**
 * Gasta ouro do usuário
 */
export function spendGold(userId, amount) {
  const user = loadUserCached(userId);
  if ((user.gold || 0) < amount) return false;
  user.gold -= amount;
  markUserDirty(userId);
  return true;
}

/**
 * Adiciona gemas ao usuário
 */
export function addGems(userId, amount) {
  const user = loadUserCached(userId);
  user.gems = (user.gems || 0) + amount;
  markUserDirty(userId);
}

/**
 * Gasta gemas
 */
export function spendGems(userId, amount) {
  const user = loadUserCached(userId);
  if ((user.gems || 0) < amount) return false;
  user.gems -= amount;
  markUserDirty(userId);
  return true;
}

/**
 * Adiciona cupom ao usuário
 */
export function addCoupons(userId, amount) {
  const user = loadUserCached(userId);
  user.coupons = (user.coupons || 0) + amount;
  markUserDirty(userId);
}

/**
 * Gasta cupom
 */
export function spendCoupons(userId, amount) {
  const user = loadUserCached(userId);
  if ((user.coupons || 0) < amount) return false;
  user.coupons -= amount;
  markUserDirty(userId);
  return true;
}

// --- FUNÇÃO DE PROGRESSÃO (XP) ---

/**
 * Adiciona XP de jogador e sobe nível
 * Retorna uma mensagem de Level Up (se houver).
 */
export function addXP(userId, amount) {
  const user = loadUserCached(userId);
  
  user.level = user.level || 1;
  user.xp = user.xp || 0;
  
  // Se o XP for manipulado diretamente fora desta função (violando a arquitetura),
  // user.xp pode ser null/undefined. Garantimos que é um número.
  user.xp = (user.xp || 0) + amount;
  let levelUpMessage = null;
  
  // Loop WHILE para processar MÚLTIPLOS NÍVEIS
  while (true) {
    const xpForNext = getXPForNextLevel(user.level);
    
    if (user.xp >= xpForNext) {
      user.xp -= xpForNext;
      user.level++;
      
      const msg = `✨ Subiu para o nível ${user.level}!`;
      levelUpMessage = levelUpMessage ? `${levelUpMessage}\n${msg}` : msg;
      
    } else {
      break; 
    }
  }
  
  markUserDirty(userId);
  return levelUpMessage;
}
