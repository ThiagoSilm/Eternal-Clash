// src/systems/economySystem.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const userDataPath = path.join(__dirname, "../../users");

export function loadUser(userid) {
  const file = path.join(userDataPath, `${userid}.json`);
  if (!fs.existsSync(file)) {
    const data = createNewUser(userid);
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
    return data;
  }
  return JSON.parse(fs.readFileSync(file));
}

export function saveUser(user) {
  const file = path.join(userDataPath, `${user.id}.json`);
  fs.writeFileSync(file, JSON.stringify(user, null, 2));
}

export function getXpNeeded(level) {
  // XP cresce exponencialmente
  return Math.floor(1000 * Math.pow(level, 2.2));
}

export function addXp(user, amount) {
  user.xp += amount;
  const needed = getXpNeeded(user.level);
  if (user.xp >= needed) {
    user.xp -= needed;
    user.level++;
    user.energy += 10; // recompensa ao subir de nível
    return `✨ Subiu para o nível ${user.level}!`;
  }
  return null;
}

export function spendEnergy(user, amount = 4) {
  if (user.energy < amount) return false;
  user.energy -= amount;
  return true;
}

export function regenerateEnergy(user) {
  const now = Date.now();
  const claimPeriod = 1000 * 60 * 60; // 1 hora
  const hours = new Date().getHours();
  
  if (hours >= 10 && hours <= 15 && now - user.lastEnergyClaim > claimPeriod) {
    user.energy += 30;
    user.lastEnergyClaim = now;
    return `⚡ Recebeu +30 de energia pelo login entre 10h e 15h!`;
  }
  return null;
}

export function addGold(user, amount) {
  user.gold += amount;
}