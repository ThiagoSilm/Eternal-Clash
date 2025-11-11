import { loadUser, saveUser } from "./economySystem.js";
const floors = require("../../data/towerFloors.json");
import { spendEnergy } from "./energySystem.js";
import { simulateBattle } from "./battleSimulator.js";

export function enterTower(username) {
  const user = loadUser(username);
  const today = new Date().toDateString();

  if (!user.tower) user.tower = { floor: 1, bestFloor: 0, lastReset: today };

  // Reset diário
  if (user.tower.lastReset !== today) {
    user.tower.floor = 1;
    user.tower.lastReset = today;
  }

  if (!spendEnergy(username, 4))
    return "⚡ Energia insuficiente para desafiar a Tower.";

  const currentFloor = floors.find(f => f.floor === user.tower.floor);
  if (!currentFloor) return "🏁 Você completou todos os andares disponíveis!";

  const victory = runBattle(user, currentFloor);

  let result = `🗼 **Andar ${currentFloor.floor}** — Inimigo: ${currentFloor.enemy}\n`;

  if (victory) {
    result += `🏆 Vitória! ${formatRewards(currentFloor.reward)}\n`;
    gainRewards(user, currentFloor.reward);
    user.tower.bestFloor = Math.max(user.tower.bestFloor, user.tower.floor);
    user.tower.floor++;
  } else {
    result += `💀 Derrota... O ${currentFloor.enemy} te venceu.\n`;
  }

  saveUser(user);
  return result;
}

function runBattle(user, floor) {
  const playerPower = user.deckPower || 300;
  const enemyPower = floor.deckPower;
  const chance = Math.min(Math.max((playerPower / enemyPower) * 60, 25), 95);
  return Math.random() * 100 <= chance;
}

function gainRewards(user, reward) {
  user.gold += reward.gold || 0;
  user.xp = (user.xp || 0) + (reward.xp || 0);
  user.gems += reward.gems || 0;
}

function formatRewards(reward) {
  let msg = "";
  if (reward.gold) msg += `💰 +${reward.gold} ouro `;
  if (reward.xp) msg += `📚 +${reward.xp} XP `;
  if (reward.gems) msg += `💎 +${reward.gems} gemas `;
  return msg.trim();
}

export function getTowerStatus(username) {
  const user = loadUser(username);
  if (!user.tower) return "🗼 Você ainda não começou a Tower.";
  return `🗼 Tower — Andar atual: ${user.tower.floor}\n🏆 Melhor andar: ${user.tower.bestFloor}`;
}