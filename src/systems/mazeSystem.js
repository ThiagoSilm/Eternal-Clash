// src/systems/mazeSystem.js

import { spendGems, spendEnergy, addGold, addXP } from "./economySystem.js";
import { summonMultiple } from "./summonSystem.js";
import { battleSystem } from "./battleSystem.js";

const mazeConfig = {
  energyCost: 4,
  goldDiceCost: 20,
  maps: {
    "map1": { maxHouses: 20, baseForce: 10, unlocked: true },
    "map2": { maxHouses: 25, baseForce: 15, unlocked: false },
  }
};

function initMazeState(user, mapId) {
  user.mazes = user.mazes || {};
  if (!user.mazes[mapId]) {
    user.mazes[mapId] = {
      position: 0,
      usedToday: 0,
      resetUsed: false
    };
  }
  return user.mazes[mapId];
}

function checkAndResetDaily(mazeState) {
  const now = Date.now();
  if (!mazeState.lastDailyReset) mazeState.lastDailyReset = 0;
  if (now - mazeState.lastDailyReset >= 24 * 60 * 60 * 1000) {
    mazeState.usedToday = 0;
    mazeState.resetUsed = false;
    mazeState.lastDailyReset = now;
  }
}

export function rollMaze(user, mapId) {
  const map = mazeConfig.maps[mapId];
  if (!map || !map.unlocked) throw new Error("Mapa não desbloqueado.");
  
  const mazeState = initMazeState(user, mapId);
  checkAndResetDaily(mazeState);
  
  if (mazeState.usedToday >= 2) throw new Error("Você já usou suas 2 tentativas diárias neste mapa.");
  
  if (!spendEnergy(user, mazeConfig.energyCost)) throw new Error("Energia insuficiente.");
  
  const roll = Math.floor(Math.random() * 6) + 1;
  mazeState.position += roll;
  if (mazeState.position > map.maxHouses) mazeState.position = map.maxHouses;
  
  let message = `🎲 Você rolou ${roll} e está na casa ${mazeState.position}/${map.maxHouses}.\n`;
  
  const rewardRoll = Math.random();
  if (rewardRoll < 0.4) {
    const goldReward = 500 + Math.floor(Math.random() * 1000);
    addGold(user, goldReward);
    message += `💰 Você encontrou ${goldReward} de ouro!\n`;
  } else if (rewardRoll < 0.7) {
    const xpReward = 50 + Math.floor(Math.random() * 200);
    addXP(user, xpReward);
    message += `✨ Você ganhou ${xpReward} XP!\n`;
  } else {
    const deck = user.decks?.main || [];
    const battleResult = battleSystem(deck, { type: "mazeEnemy", mapForce: map.baseForce });
    if (battleResult.win) {
      message += `⚔️ Você venceu a batalha! Avance normalmente.\n`;
    } else {
      mazeState.position = Math.max(mazeState.position - Math.floor(roll / 2), 0);
      message += `❌ Você perdeu a batalha e voltou para a casa ${mazeState.position}.\n`;
    }
  }
  
  mazeState.usedToday++;
  
  if (mazeState.position === map.maxHouses) {
    message += `👑 Você alcançou o chefão do mapa ${mapId}!\n`;
    const bossReward = summonMultiple(user, "mazeBoss", 3, { mapForce: map.baseForce }) || '';
    const goldFinal = 5000 + Math.floor(Math.random() * 5000);
    const xpFinal = 500 + Math.floor(Math.random() * 500);
    addGold(user, goldFinal);
    addXP(user, xpFinal);
    message += `🏆 Recompensas do chefão: 3 cartas + ${goldFinal} de ouro + ${xpFinal} XP.\n`;
    message += bossReward;
  }
  
  return message;
}

export function useGoldDice(user, mapId, targetHouse) {
  const mazeState = initMazeState(user, mapId);
  if (targetHouse < mazeState.position) throw new Error("Não pode retroceder casas com o Gold Dice.");
  if (!spendGems(user, mazeConfig.goldDiceCost)) throw new Error("Gemas insuficientes para usar o Gold Dice.");
  mazeState.position = Math.min(targetHouse, mazeConfig.maps[mapId].maxHouses);
  return `🎲 Gold Dice usado! Você avançou para a casa ${mazeState.position}.`;
}

export function resetMaze(user, mapId) {
  const mazeState = initMazeState(user, mapId);
  checkAndResetDaily(mazeState);
  if (mazeState.resetUsed) throw new Error("Você já usou o reset manual do maze hoje.");
  mazeState.position = 0;
  mazeState.usedToday = 0;
  mazeState.resetUsed = true;
  return "🔄 Maze resetado! Você pode jogar novamente (tentativas restauradas).";
}

export function getMazeState(user, mapId) {
  return initMazeState(user, mapId);
}