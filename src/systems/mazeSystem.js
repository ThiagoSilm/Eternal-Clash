// src/systems/mazeSystem.js
import { spendGems, spendEnergy, addGold, addXP } from "./economySystem.js";
import { summonMultiple } from "./summonSystem.js";
import { runBattle } from "./battleSystem.js"; // <- Correto
import { markUserDirty } from "./userCacheSystem.js";

const mazeConfig = {
  energyCost: 4,
  
  gemCost: 20, // renomeado porque realmente usa spendGems
  
  maps: {
    map1: { maxHouses: 20, baseForce: 10, unlocked: true },
    map2: { maxHouses: 25, baseForce: 15, unlocked: false },
  },
};

function initMazeState(user, mapId) {
  user.mazes = user.mazes || {};
  
  if (!user.mazes[mapId]) {
    user.mazes[mapId] = {
      position: 0,
      usedToday: 0,
      resetUsed: false,
      lastDailyReset: 0
    };
  }
  
  return user.mazes[mapId];
}

function checkAndResetDaily(mazeState) {
  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;
  
  if (!mazeState.lastDailyReset) mazeState.lastDailyReset = 0;
  
  if (now - mazeState.lastDailyReset >= DAY) {
    mazeState.usedToday = 0;
    mazeState.resetUsed = false;
    mazeState.lastDailyReset = now;
  }
}

export async function rollMaze(user, mapId) {
  const map = mazeConfig.maps[mapId];
  if (!map || !map.unlocked) throw new Error("Mapa não desbloqueado.");
  
  const mazeState = initMazeState(user, mapId);
  checkAndResetDaily(mazeState);
  
  if (mazeState.usedToday >= 2) {
    throw new Error("Você já usou suas 2 tentativas diárias neste mapa.");
  }
  
  if (!spendEnergy(user, mazeConfig.energyCost)) {
    throw new Error("Energia insuficiente.");
  }
  
  const roll = Math.floor(Math.random() * 6) + 1;
  mazeState.position += roll;
  
  if (mazeState.position > map.maxHouses) {
    mazeState.position = map.maxHouses;
  }
  
  let msg = `🎲 Você rolou **${roll}** e está na casa **${mazeState.position}/${map.maxHouses}**\n`;
  
  const rewardRoll = Math.random();
  
  if (rewardRoll < 0.4) {
    const goldReward = 500 + Math.floor(Math.random() * 1000);
    addGold(user, goldReward);
    msg += `💰 Você encontrou **${goldReward} ouro**!\n`;
    
  } else if (rewardRoll < 0.7) {
    const xpReward = 50 + Math.floor(Math.random() * 200);
    addXP(user, xpReward);
    msg += `✨ Você ganhou **${xpReward} XP**!\n`;
    
  } else {
    // BATALHA NO MAZE
    const enemy = { type: "mazeEnemy", force: map.baseForce };
    
    const result = await runBattle(user, enemy);
    
    if (result.win) {
      msg += `⚔️ Você **venceu** a batalha!\n`;
    } else {
      mazeState.position = Math.max(mazeState.position - Math.ceil(roll / 2), 0);
      msg += `❌ Você **perdeu** e voltou para a casa **${mazeState.position}**.\n`;
    }
  }
  
  mazeState.usedToday++;
  
  // Boss
  if (mazeState.position === map.maxHouses) {
    msg += `👑 Você alcançou o CHEFÃO do mapa **${mapId}**!\n`;
    
    const bossRewardMsg = summonMultiple(user, "mazeBoss", 3) || "";
    
    const goldFinal = 5000 + Math.floor(Math.random() * 5000);
    const xpFinal = 500 + Math.floor(Math.random() * 500);
    
    addGold(user, goldFinal);
    addXP(user, xpFinal);
    
    msg += `🏆 Recompensas: **3 cartas + ${goldFinal} ouro + ${xpFinal} XP**\n`;
    msg += bossRewardMsg;
  }
  
  markUserDirty(user.id);
  
  return msg;
}

export function useGoldDice(user, mapId, targetHouse) {
  const mazeState = initMazeState(user, mapId);
  
  if (targetHouse < mazeState.position) {
    throw new Error("Não pode retroceder casas com o Gold Dice.");
  }
  
  if (!spendGems(user, mazeConfig.gemCost)) {
    throw new Error("Gemas insuficientes.");
  }
  
  mazeState.position = Math.min(
    targetHouse,
    mazeConfig.maps[mapId].maxHouses
  );
  
  markUserDirty(user.id);
  
  return `🎲 Gold Dice usado! Você avançou para a casa **${mazeState.position}**.`;
}

export function resetMaze(user, mapId) {
  const mazeState = initMazeState(user, mapId);
  checkAndResetDaily(mazeState);
  
  if (mazeState.resetUsed) {
    throw new Error("Você já usou o reset do maze hoje.");
  }
  
  mazeState.position = 0;
  mazeState.usedToday = 0;
  mazeState.resetUsed = true;
  
  markUserDirty(user.id);
  
  return "🔄 Maze resetado! Você pode jogar novamente.";
}

export function getMazeState(user, mapId) {
  return initMazeState(user, mapId);
}