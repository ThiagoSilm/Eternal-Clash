import { loadUser, saveUser } from "./economySystem.js";
const rewards = require("../../data/luckySpinRewards.json");
const cards = require("../../data/cards.json");
const boosters = require("../../data/boosters.json");

export function spinLucky(username) {
  const user = loadUser(username);

  const spinCost = 100; // gemas
  if (user.gems < spinCost) return "💎 Gemas insuficientes para girar o Lucky Spin.";

  user.gems -= spinCost;

  const reward = randomReward();
  applyReward(user, reward);

  saveUser(user);
  return formatResult(reward);
}

function randomReward() {
  const roll = Math.random() * 100;
  let sum = 0;
  for (const r of rewards) {
    sum += r.chance;
    if (roll <= sum) return r;
  }
  return rewards[0];
}

function applyReward(user, reward) {
  switch (reward.type) {
    case "gold": user.gold += reward.amount; break;
    case "gems": user.gems += reward.amount; break;
    case "xp": user.xp = (user.xp || 0) + reward.amount; break;
    case "energy": user.energy = (user.energy || 0) + reward.amount; break;
    case "card":
      if (!user.cards) user.cards = [];
      const possible = cards.filter(c => c.rarity === reward.rarity);
      const card = possible[Math.floor(Math.random() * possible.length)];
      user.cards.push(card);
      break;
    case "booster":
      if (!user.boosters) user.boosters = [];
      const booster = boosters.find(b => b.name === reward.name);
      if (booster) user.boosters.push(booster);
      break;
  }
}

function formatResult(reward) {
  switch (reward.type) {
    case "gold": return `🎰 Lucky Spin: 💰 +${reward.amount} ouro!`;
    case "gems": return `🎰 Lucky Spin: 💎 +${reward.amount} gemas!`;
    case "xp": return `🎰 Lucky Spin: 📚 +${reward.amount} XP!`;
    case "energy": return `🎰 Lucky Spin: ⚡ +${reward.amount} energia!`;
    case "card": return `🎰 Lucky Spin: 🎴 Você tirou uma carta ${reward.rarity} estrelas!`;
    case "booster": return `🎰 Lucky Spin: 🎁 Você recebeu o booster "${reward.name}"!`;
  }
}