// src/systems/energySystem.js
import { loadUser, saveUser } from "./economySystem.js";

const ENERGY_REGEN_RATE = 1; // energia regenerada por tick
const TICK_INTERVAL = 60 * 5 * 1000; // a cada 5 minutos

export function updateEnergy(username) {
  const user = loadUser(username);
  const now = Date.now();
  const elapsed = now - (user.lastEnergyTick || 0);
  
  const ticks = Math.floor(elapsed / TICK_INTERVAL);
  if (ticks > 0) {
    const gained = ticks * ENERGY_REGEN_RATE;
    user.energy = Math.min(user.energy + gained, user.maxEnergy);
    user.lastEnergyTick = now;
    saveUser(user);
  }
}

export function spendEnergy(username, amount) {
  const user = loadUser(username);
  if (user.energy < amount) return false;
  user.energy -= amount;
  saveUser(user);
  return true;
}

export function getEnergyStatus(username) {
  const user = loadUser(username);
  updateEnergy(username);
  return `⚡ Energia atual: ${user.energy}/${user.maxEnergy}`;
}