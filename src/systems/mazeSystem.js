// src/systems/mazeSystem.js
import events from "../../data/mazeEvents.json" assert { type: "json" };
import { loadUser, saveUser } from "./economySystem.js";
import { spendEnergy } from "./energySystem.js";

export function rollDice() {
  return Math.floor(Math.random() * 6) + 1;
}

export function enterMaze(username) {
  const user = loadUser(username);
  if (!user.maze) user.maze = { position: 0, floor: 1, completed: false };

  if (!spendEnergy(username, 3))
    return "⚡ Energia insuficiente para explorar o Maze.";

  const dice = rollDice();
  user.maze.position += dice;

  const event = getRandomEvent();
  const result = handleEvent(user, event);

  saveUser(user);

  return `🎲 Você rolou **${dice}** e avançou para a casa **${user.maze.position}**!\n${result}`;
}

function getRandomEvent() {
  const index = Math.floor(Math.random() * events.length);
  return events[index];
}

function handleEvent(user, event) {
  let result = `🌀 Evento: **${event.name}**\n`;

  switch (event.type) {
    case "enemy":
      result += battleEvent(user, event);
      break;
    case "chest":
      result += gainRewards(user, event.reward);
      break;
    case "heal":
      result += healUser(user, event.reward.heal);
      break;
    case "boss":
      result += bossEvent(user, event);
      break;
    case "empty":
      result += "Nada aconteceu...";
      break;
  }

  return result;
}

function battleEvent(user, event) {
  const winChance = 70;
  const roll = Math.random() * 100;

  if (roll <= winChance) {
    gainRewards(user, event.reward);
    return `⚔️ Você derrotou o ${event.name}!\n${formatRewards(event.reward)}`;
  } else {
    return `💀 O ${event.name} te derrotou... mas você poderá tentar novamente.`;
  }
}

function bossEvent(user, event) {
  const winChance = 55;
  const roll = Math.random() * 100;

  if (roll <= winChance) {
    gainRewards(user, event.reward);
    user.maze.completed = true;
    return `🔥 Você venceu o **${event.name}**!\n🏆 Maze do andar ${user.maze.floor} completo!\n${formatRewards(event.reward)}`;
  } else {
    return `💀 O **${event.name}** acabou com você. Volte mais forte.`;
  }
}

function gainRewards(user, reward) {
  user.gold += reward.gold || 0;
  user.xp = (user.xp || 0) + (reward.xp || 0);
  user.gems += reward.gems || 0;
  return "";
}

function healUser(user, amount) {
  user.hp = Math.min(100, (user.hp || 100) + amount);
  return `❤️ Recuperou ${amount} de HP!`;
}

function formatRewards(reward) {
  let msg = "";
  if (reward.gold) msg += `💰 +${reward.gold} ouro\n`;
  if (reward.xp) msg += `📚 +${reward.xp} XP\n`;
  if (reward.gems) msg += `💎 +${reward.gems} gemas\n`;
  return msg.trim();
}

export function resetMaze(username) {
  const user = loadUser(username);
  user.maze = { position: 0, floor: 1, completed: false };
  saveUser(user);
  return "🔄 Maze resetado. Você voltou ao início!";
}