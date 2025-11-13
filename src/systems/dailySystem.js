// src/systems/dailySystem.js

// 1. CORREÇÕES DE IMPORTAÇÃO: loadUser/saveUserData removidos.
// Assumimos que o economySystem exporta addEnergy.
import { addGold, addGems, addXP, addEnergy } from "./economySystem.js";
import rewards from "../../data/dailyRewards.json"
with { type: "json" };

const MILLIS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * [HELPER] Calcula energia a ser recuperada no daily.
 */
function calculateDailyEnergy(streak) {
  let baseEnergy = 30;
  if (streak >= 3) baseEnergy += 10;
  if (streak >= 5) baseEnergy += 10;
  return baseEnergy;
}

/**
 * Adiciona as recompensas do daily ao usuário usando o EconomySystem.
 * 🎯 CORREÇÃO 1: Recebe o objeto 'user'
 */
function grantReward(user, reward) {
  if (!reward) return;
  
  // 🎯 CORREÇÃO 2: Passa o objeto 'user'
  if (reward.gold) addGold(user, reward.gold);
  if (reward.gems) addGems(user, reward.gems);
  
  let levelUpMsg = null;
  if (reward.xp) {
    // 🎯 CORREÇÃO 3: Passa o objeto 'user'
    levelUpMsg = addXP(user, reward.xp);
  }
  
  return levelUpMsg;
}

// Funções auxiliares (formatReward inalterada)
function formatReward(reward) { /* ... */ }

/**
 * Coleta a recompensa diária do usuário e aplica regeneração de energia.
 * @param {object} user - Objeto do usuário a ser modificado.
 * @returns {string} Mensagem do resultado.
 * @throws {Error} Se já tiver coletado hoje.
 */
export function claimDaily(user) {
  // ❌ REMOVIDO: const user = loadUser(userId);
  
  const today = new Date().toDateString();
  
  if (!user.daily) user.daily = { lastClaim: null, streak: 0 };
  
  if (user.daily.lastClaim === today)
    throw new Error("📆 Você já coletou sua recompensa diária hoje!");
  
  let levelUpMessage = null;
  
  // Lógica de Streak (inalterada)
  const lastDate = user.daily.lastClaim ? new Date(user.daily.lastClaim) : new Date(0);
  const tomorrow = new Date(lastDate.getTime() + MILLIS_PER_DAY);
  
  const isConsecutive = tomorrow.toDateString() === today;
  
  if (isConsecutive) {
    user.daily.streak++;
  } else {
    user.daily.streak = 1;
  }
  
  if (user.daily.streak > 7) user.daily.streak = 1;
  
  const reward = rewards.find((r) => r.day === user.daily.streak);
  
  // Aplica as recompensas (dispara Level Up)
  // 🎯 CORREÇÃO 4: Passa o objeto 'user'
  levelUpMessage = grantReward(user, reward.reward);
  
  // Calcula e aplica regeneração de energia
  const energyGained = calculateDailyEnergy(user.daily.streak);
  // 🎯 CORREÇÃO 5: Delega a adição de energia ao economySystem
  const added = addEnergy(user, energyGained);
  
  user.daily.lastClaim = today;
  // ❌ REMOVIDO: saveUserData(user); - O Middleware salva.
  
  let finalMessage = `🎉 Recompensa diária (Dia ${user.daily.streak}) recebida!\n`;
  finalMessage += `${formatReward(reward.reward)}\n`;
  finalMessage += `⚡ +${energyGained} de energia recuperada!`; // A mensagem deve refletir o valor calculado
  
  if (levelUpMessage) {
    finalMessage += `\n\n${levelUpMessage}`;
  }
  
  return finalMessage;
}

/**
 * Retorna a sequência atual de login do usuário.
 * @param {object} user - Objeto do usuário.
 * @returns {string} Mensagem da streak.
 */
export function getDailyStatus(user) {
  // ❌ REMOVIDO: const user = loadUser(userId);
  
  const streak = user.daily?.streak || 0;
  
  return `📅 Sequência de login: ${streak} dias`;
}