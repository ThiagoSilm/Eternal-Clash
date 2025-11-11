// src/systems/drawSystem.js
import { loadUser, saveUser } from "./economySystem.js";

const rewardsPool = [
  { type: "gold", amount: 2000, chance: 40 },
  { type: "gems", amount: 3, chance: 25 },
  { type: "xp", amount: 100, chance: 20 },
  { type: "card", rarity: "rara", chance: 10 },
  { type: "card", rarity: "épica", chance: 5 }
];

export function dailyDraw(username) {
  const user = loadUser(username);
  const today = new Date().toDateString();

  if (user.lastDraw === today)
    return "🎰 Você já girou a sorte do dia! Volte amanhã.";

  const reward = randomReward();
  applyReward(user, reward);

  user.lastDraw = today;
  saveUser(user);

  return formatResult(reward);
}

function randomReward() {
  const roll = Math.random() * 100;
  let sum = 0;
  for (const r of rewardsPool) {
    sum += r.chance;
    if (roll <= sum) return r;
  }
  return rewardsPool[0];
}

function applyReward(user, reward) {
  if (reward.type === "gold") user.gold += reward.amount;
  if (reward.type === "gems") user.gems += reward.amount;
  if (reward.type === "xp") user.xp = (user.xp || 0) + reward.amount;
  if (reward.type === "card") {
    if (!user.cards) user.cards = [];
    user.cards.push({ rarity: reward.rarity, from: "Daily Draw" });
  }
}

function formatResult(reward) {
  switch (reward.type) {
    case "gold": return `🎰 Você ganhou 💰 ${reward.amount} de ouro!`;
    case "gems": return `🎰 Você ganhou 💎 ${reward.amount} gemas!`;
    case "xp": return `🎰 Você ganhou 📚 ${reward.amount} XP!`;
    case "card": return `🎴 Sorte! Você tirou uma carta ${reward.rarity.toUpperCase()}!`;
  }
}