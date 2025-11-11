// src/systems/dailyEnergySystem.js
import { loadUser, saveUser } from "./economySystem.js";

const PERIODS = [
  { start: 10, end: 15, bonus: 30 },
  { start: 18, end: 21, bonus: 30 }
];

export function claimDailyEnergy(username) {
  const user = loadUser(username);
  const now = new Date();
  const hour = now.getHours();
  
  const availablePeriod = PERIODS.find(p => hour >= p.start && hour < p.end);
  if (!availablePeriod) return "⏰ Nenhum período ativo para resgate de energia agora.";
  
  const lastClaim = user.lastEnergyClaim ? new Date(user.lastEnergyClaim) : null;
  if (lastClaim && samePeriod(lastClaim, now, availablePeriod))
    return "⚠️ Você já resgatou energia neste período.";
  
  user.energy = Math.min(user.energy + availablePeriod.bonus, user.maxEnergy);
  user.lastEnergyClaim = now.toISOString();
  saveUser(user);
  return `⚡ Você resgatou ${availablePeriod.bonus} de energia! Agora tem ${user.energy}/${user.maxEnergy}.`;
}

function samePeriod(last, now, period) {
  return (
    last.getHours() >= period.start &&
    last.getHours() < period.end &&
    last.getDate() === now.getDate()
  );
}