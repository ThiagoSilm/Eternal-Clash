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
    const ctx = { user, addGold, addGems, addXP, addEnergy };
    with(ctx) {
      eval(reward.script);
    }
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