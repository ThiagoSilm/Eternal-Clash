import { addGold, addGems, addXP, addEnergy } from "./economySystem.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// -----------------------------
// Carrega o JSON de recompensas
// -----------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REWARDS_PATH = path.join(__dirname, "../../data/dailyRewards.json");

let rewards = [];
try {
  rewards = JSON.parse(fs.readFileSync(REWARDS_PATH, "utf-8"));
} catch (err) {
  console.error("Erro ao carregar dailyRewards.json:", err.message);
  rewards = [];
}

// -----------------------------
// Helpers
// -----------------------------
function calculateDailyEnergy(streak) {
  let baseEnergy = 30;
  if (streak >= 3) baseEnergy += 10;
  if (streak >= 5) baseEnergy += 10;
  return baseEnergy;
}

/**
 * Executa scripts dinâmicos do reward com contexto 'with'.
 */
function executeRewardScript(user, reward) {
  if (!reward || !reward.script) return;
  
  try {
    const context = { user, addGold, addGems, addXP, addEnergy };
    
    // Cria uma função com variáveis do contexto
    const func = new Function(
      "user", "addGold", "addGems", "addXP", "addEnergy",
      reward.script
    );
    
    // Executa passando os valores do contexto
    func(context.user, context.addGold, context.addGems, context.addXP, context.addEnergy);
    
  } catch (err) {
    console.error("Erro ao executar script de recompensa diária:", err.message);
  }
}

function formatReward(reward) {
  if (!reward) return "Nenhuma recompensa";
  const parts = [];
  if (reward.gold) parts.push(`💰 Ouro: +${reward.gold}`);
  if (reward.gems) parts.push(`💎 Gemas: +${reward.gems}`);
  if (reward.xp) parts.push(`✨ XP: +${reward.xp}`);
  return parts.join(" | ");
}

// -----------------------------
// Daily System
// -----------------------------
export function claimDaily(user) {
  const today = new Date().toDateString();
  
  if (!user.daily) user.daily = { lastClaim: null, streak: 0 };
  if (user.daily.lastClaim === today)
    throw new Error("📆 Você já coletou sua recompensa diária hoje!");
  
  const lastDate = user.daily.lastClaim ? new Date(user.daily.lastClaim) : new Date(0);
  const tomorrow = new Date(lastDate.getTime() + 1000 * 60 * 60 * 24);
  const isConsecutive = tomorrow.toDateString() === today;
  
  user.daily.streak = isConsecutive ? user.daily.streak + 1 : 1;
  if (user.daily.streak > 7) user.daily.streak = 1;
  
  const rewardEntry = rewards.find(r => r.day === user.daily.streak);
  const reward = rewardEntry?.reward;
  
  // Aplica recompensas fixas
  if (reward) {
    if (reward.gold) addGold(user, reward.gold);
    if (reward.gems) addGems(user, reward.gems);
    if (reward.xp) addXP(user, reward.xp);
    
    // Executa script dinâmico (caso exista)
    executeRewardScript(user, reward);
  }
  
  const energyGained = calculateDailyEnergy(user.daily.streak);
  const energyAdded = addEnergy(user, energyGained);
  
  user.daily.lastClaim = today;
  
  let finalMessage = `🎉 Recompensa diária (Dia ${user.daily.streak}) recebida!\n`;
  finalMessage += `${formatReward(reward)}\n`;
  finalMessage += `⚡ +${energyAdded ? energyGained : 0} de energia recuperada!`;
  
  return finalMessage;
}

export function getDailyStatus(user) {
  const streak = user.daily?.streak || 0;
  return `📅 Sequência de login: ${streak} dias`;
}

export function dailyDraw(user) {
  const now = Date.now();
  const cooldown = 24 * 60 * 60 * 1000; // 24 horas
  if (!user.dailyDraw) user.dailyDraw = { lastDraw: 0 };
  
  const timeSince = now - user.dailyDraw.lastDraw;
  if (timeSince < cooldown) {
    const remaining = Math.ceil((cooldown - timeSince) / (60 * 60 * 1000));
    return `⏳ Você já participou do sorteio hoje. Tente novamente em **${remaining}h**.`;
  }
  
  user.dailyDraw.lastDraw = now;
  
  // 🎁 Possíveis recompensas
  const rewards = [
    { type: "gold", amount: 2500, chance: 40 },
    { type: "gems", amount: 50, chance: 25 },
    { type: "coupon", amount: 1, chance: 10 },
    { type: "card", rarity: 3, chance: 15 },
    { type: "card", rarity: 4, chance: 7 },
    { type: "card", rarity: 5, chance: 3 },
  ];
  
  // Sorteia a recompensa com base nas chances
  const roll = Math.random() * 100;
  let cumulative = 0;
  let reward = rewards[0];
  
  for (const r of rewards) {
    cumulative += r.chance;
    if (roll <= cumulative) {
      reward = r;
      break;
    }
  }
  
  // Aplica a recompensa
  let resultMsg = "";
  switch (reward.type) {
    case "gold":
      addGold(user, reward.amount);
      resultMsg = `💰 Você ganhou **${reward.amount} ouro!**`;
      break;
    case "gems":
      addGems(user, reward.amount);
      resultMsg = `💎 Você ganhou **${reward.amount} gemas!**`;
      break;
    case "coupon":
      addCoupons(user, reward.amount);
      resultMsg = `🎟️ Você ganhou **${reward.amount} cupom!**`;
      break;
    case "card":
      const cardId = getRandomCardIdByRarity(reward.rarity);
      giveCardToUser(user, cardId);
      resultMsg = `✨ Você recebeu uma carta **${reward.rarity}★** no sorteio diário!`;
      break;
  }
  
  return `🎰 **Sorteio Diário**\n${resultMsg}`;
}