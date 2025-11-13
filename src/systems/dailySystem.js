// src/systems/dailySystem.js

// 1. IMPORTAÇÕES CORRIGIDAS
import { loadUser, saveUserData } from "./userSystem.js";
import { addGold, addGems, addXP } from "./economySystem.js"; // Funções de economia
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
 */
function grantReward(userId, reward) {
  if (!reward) return;
  
  if (reward.gold) addGold(userId, reward.gold); // CORREÇÃO: Usa addGold
  if (reward.gems) addGems(userId, reward.gems); // CORREÇÃO: Usa addGems
  
  // addXP processa o Level Up automaticamente
  let levelUpMsg = null;
  if (reward.xp) {
    levelUpMsg = addXP(userId, reward.xp); // CORREÇÃO: Usa addXP
  }
  
  return levelUpMsg;
}

/**
 * Formata a recompensa para exibição.
 */
function formatReward(reward) {
  if (!reward) return "";
  let msg = "";
  if (reward.gold) msg += `💰 +${reward.gold} ouro `;
  if (reward.xp) msg += `📚 +${reward.xp} XP `;
  if (reward.gems) msg += `💎 +${reward.gems} gemas `;
  return msg.trim();
}

/**
 * Coleta a recompensa diária do usuário e aplica regeneração de energia.
 * @param {string} userId - ID do usuário.
 * @returns {string} Mensagem do resultado.
 */
export function claimDaily(userId) {
  const user = loadUser(userId); // 2. CORREÇÃO: Carrega usuário pelo ID
  const today = new Date().toDateString();
  
  if (!user.daily) user.daily = { lastClaim: null, streak: 0 };
  
  if (user.daily.lastClaim === today)
    return "📆 Você já coletou sua recompensa diária hoje!";
  
  let levelUpMessage = null;
  
  // Checa se a streak deve ser incrementada (logou no dia seguinte) ou resetada
  const lastDate = user.daily.lastClaim ? new Date(user.daily.lastClaim) : new Date(0);
  const tomorrow = new Date(lastDate.getTime() + MILLIS_PER_DAY);
  
  const isConsecutive = tomorrow.toDateString() === today;
  
  if (isConsecutive) {
    user.daily.streak++;
  } else {
    // Se não é consecutivo (pulou um ou mais dias), reseta
    user.daily.streak = 1;
  }
  
  // Limita a streak ao ciclo de recompensas (ex: 7 dias)
  if (user.daily.streak > 7) user.daily.streak = 1;
  
  const reward = rewards.find((r) => r.day === user.daily.streak);
  
  // Aplica as recompensas (dispara Level Up)
  levelUpMessage = grantReward(userId, reward.reward);
  
  // Calcula e aplica regeneração de energia
  const energyGained = calculateDailyEnergy(user.daily.streak);
  // O economySystem não exporta addEnergy, então tratamos aqui, mas marcamos dirty no final.
  user.energy = (user.energy || 0) + energyGained;
  
  user.daily.lastClaim = today;
  saveUserData(user); // 1. CORREÇÃO: Usa saveUserData
  
  let finalMessage = `🎉 Recompensa diária (Dia ${user.daily.streak}) recebida!\n`;
  finalMessage += `${formatReward(reward.reward)}\n`;
  finalMessage += `⚡ +${energyGained} de energia recuperada!`;
  
  if (levelUpMessage) {
    finalMessage += `\n\n${levelUpMessage}`;
  }
  
  return finalMessage;
}

/**
 * Retorna a sequência atual de login do usuário.
 * @param {string} userId - ID do usuário.
 * @returns {string} Mensagem da streak.
 */
export function getDailyStatus(userId) {
  const user = loadUser(userId); // 2. CORREÇÃO: Carrega usuário pelo ID
  const streak = user.daily?.streak || 0;
  
  // Atualiza o lastClaim e marca como dirty se necessário para manter o estado atualizado
  // Não fazemos o claim, apenas garantimos que o objeto user está fresco.
  
  return `📅 Sequência de login: ${streak} dias`;
}