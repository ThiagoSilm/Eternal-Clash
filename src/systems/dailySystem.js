// src/systems/dailySystem.js
import rewards from "../../data/dailyRewards.json" assert { type: "json" };
import { loadUser, saveUser } from "./economySystem.js";

export function claimDaily(username) {
  const user = loadUser(username);
  const today = new Date().toDateString();

  if (!user.daily) user.daily = { lastClaim: null, streak: 0 };

  if (user.daily.lastClaim === today)
    return "📆 Você já coletou sua recompensa diária hoje!";

  // Se já passou um dia desde o último claim
  const last = user.daily.lastClaim ? new Date(user.daily.lastClaim) : 0;
const diff = user.daily.lastClaim ? (new Date() - last) / (1000 * 60 * 60 * 24) : Infinity;

  if (isNaN(diff) || diff >= 1) {
    if (diff < 2) user.daily.streak++;
    else user.daily.streak = 1; // perdeu sequência

    if (user.daily.streak > 7) user.daily.streak = 1;

    const reward = rewards.find(r => r.day === user.daily.streak);
    grantReward(user, reward.reward);
    user.daily.lastClaim = today;

    saveUser(user);
    return `🎉 Recompensa diária (Dia ${user.daily.streak}) recebida!\n${formatReward(reward.reward)}`;
  }
}

function grantReward(user, reward) {
  user.gold += reward.gold || 0;
  user.gems += reward.gems || 0;
  user.xp = (user.xp || 0) + (reward.xp || 0);
}

function formatReward(reward) {
  let msg = "";
  if (reward.gold) msg += `💰 +${reward.gold} ouro `;
  if (reward.xp) msg += `📚 +${reward.xp} XP `;
  if (reward.gems) msg += `💎 +${reward.gems} gemas `;
  return msg.trim();
}

export function getDailyStatus(username) {
  const user = loadUser(username);
  const streak = user.daily?.streak || 0;
  return `📅 Sequência de login: ${streak} dias`;
}