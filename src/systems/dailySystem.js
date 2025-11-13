// src/systems/dailySystem.js
import rewards from "../../data/dailyRewards.json" with { type: "json" };
import { markUserDirty } from "./userCacheSystem.js";

/**
 * Coleta a recompensa diária do usuário e aplica regeneração de energia.
 * @param {Object} user - Objeto do usuário.
 * @returns {string} Mensagem do resultado.
 */
export function claimDaily(user) {
  const today = new Date().toDateString();

  if (!user.daily) user.daily = { lastClaim: null, streak: 0 };

  if (user.daily.lastClaim === today)
    return "📆 Você já coletou sua recompensa diária hoje!";

  const last = user.daily.lastClaim ? new Date(user.daily.lastClaim) : 0;
  const diff =
    user.daily.lastClaim
      ? (new Date() - last) / (1000 * 60 * 60 * 24)
      : Infinity;

  if (isNaN(diff) || diff >= 1) {
    // Incrementa streak ou reseta se perdeu dias
    if (diff < 2) user.daily.streak++;
    else user.daily.streak = 1;

    if (user.daily.streak > 7) user.daily.streak = 1;

    const reward = rewards.find((r) => r.day === user.daily.streak);
    grantReward(user, reward.reward);

    // Regenera energia no daily
    const energyGained = calculateDailyEnergy(user);
    user.energy += energyGained;

    user.daily.lastClaim = today;
    markUserDirty(user.id);

    return `🎉 Recompensa diária (Dia ${user.daily.streak}) recebida!\n${formatReward(
      reward.reward
    )}\n⚡ +${energyGained} de energia recuperada!`;
  }
}

/**
 * Calcula energia a ser recuperada no daily.
 * Pode ser ajustado conforme eventos ou streaks.
 * @param {Object} user
 * @returns {number} Quantidade de energia
 */
function calculateDailyEnergy(user) {
  let baseEnergy = 30; // padrão
  // bônus por streak
  if (user.daily.streak >= 3) baseEnergy += 10;
  if (user.daily.streak >= 5) baseEnergy += 10;
  return baseEnergy;
}

/**
 * Adiciona as recompensas do daily ao usuário.
 * @param {Object} user - Objeto do usuário.
 * @param {Object} reward - Objeto com gold, gems e xp.
 */
function grantReward(user, reward) {
  if (!reward) return;
  user.gold += reward.gold || 0;
  user.gems += reward.gems || 0;
  user.xp = (user.xp || 0) + (reward.xp || 0);
}

/**
 * Formata a recompensa para exibição.
 * @param {Object} reward - Objeto com gold, gems e xp.
 * @returns {string} Mensagem formatada.
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
 * Retorna a sequência atual de login do usuário.
 * @param {Object} user - Objeto do usuário.
 * @returns {string} Mensagem da streak.
 */
export function getDailyStatus(user) {
  const streak = user.daily?.streak || 0;
  return `📅 Sequência de login: ${streak} dias`;
}