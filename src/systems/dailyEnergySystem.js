// src/systems/dailyEnergySystem.js
import { loadUserCached, markUserDirty } from "./userCacheSystem.js";

/**
 * Define os horários de bônus de energia e quantidade.
 * Pode ser ajustado conforme desejado.
 */
const bonusPeriods = [
  { startHour: 10, endHour: 15, energy: 30 }, // Ex: 10h às 15h
  { startHour: 20, endHour: 22, energy: 20 } // Ex: 20h às 22h
];

/**
 * Recompensa diária de login
 */
export function claimDailyEnergy(userId) {
  const user = loadUserCached(userId);
  const now = Date.now();
  
  if (!user.lastDailyClaim) user.lastDailyClaim = 0;
  
  // 24h desde o último claim
  if (now - user.lastDailyClaim < 1000 * 60 * 60 * 24) {
    return "⚠️ Você já recebeu sua energia diária hoje.";
  }
  
  // Energia padrão diária
  const baseEnergy = 50;
  user.energy += baseEnergy;
  
  // Aplica bônus por horário
  const currentHour = new Date().getHours();
  bonusPeriods.forEach(period => {
    if (currentHour >= period.startHour && currentHour <= period.endHour) {
      user.energy += period.energy;
    }
  });
  
  user.lastDailyClaim = now;
  markUserDirty(userId);
  
  return `⚡ Você recebeu sua energia diária de ${baseEnergy} + bônus de horário! Total atual: ${user.energy} de energia.`;
}

/**
 * Recupera energia baseada em tempo de jogo (opcional)
 */
export function regenEnergyOverTime(userId) {
  const user = loadUserCached(userId);
  const now = Date.now();
  
  if (!user.lastEnergyRegen) user.lastEnergyRegen = now;
  
  const delta = now - user.lastEnergyRegen;
  const regenRate = 1; // 1 energia a cada minuto
  const regenAmount = Math.floor(delta / (1000 * 60) * regenRate);
  
  if (regenAmount > 0) {
    user.energy += regenAmount;
    user.lastEnergyRegen = now;
    markUserDirty(userId);
  }
  
  return regenAmount;
}

/**
 * Permite comprar energia usando gemas
 */
export function buyEnergy(userId, gemsSpent = 1) {
  const user = loadUserCached(userId);
  
  if (user.gems < gemsSpent) return "💎 Gemas insuficientes.";
  
  const energyPerGem = 40;
  user.gems -= gemsSpent;
  user.energy += energyPerGem;
  markUserDirty(userId);
  
  return `⚡ Você comprou ${energyPerGem} de energia usando ${gemsSpent} gemas. Total atual: ${user.energy} de energia.`;
}