// src/systems/mazeSystem.js
import { loadUser, saveUser } from "./economySystem.js";
import { summonCard, summonMultiple } from "./summonSystem.js";
import { spendEnergy, addGold, addXp } from "./economySystem.js";
import { battle } from "./battleSystem.js";

// Configurações de maze
const mazeConfig = {
  maps: {
    2: { maxHouses: 40, unlocked: true, baseForce: 7500 },
    3: { maxHouses: 40, unlocked: true, baseForce: 8000 },
    4: { maxHouses: 40, unlocked: true, baseForce: 8500 },
    5: { maxHouses: 60, unlocked: false, baseForce: 9000 },
    6: { maxHouses: 60, unlocked: false, baseForce: 9500 },
    7: { maxHouses: 60, unlocked: false, baseForce: 10000 },
    8: { maxHouses: 60, unlocked: false, baseForce: 10500 },
    9: { maxHouses: 60, unlocked: false, baseForce: 11000 },
    10: { maxHouses: 60, unlocked: false, baseForce: 11500 },
    11: { maxHouses: 60, unlocked: false, baseForce: 12000 },
    12: { maxHouses: 100, unlocked: false, baseForce: 13000 },
    13: { maxHouses: 100, unlocked: false, baseForce: 13500 },
    14: { maxHouses: 100, unlocked: false, baseForce: 14000 },
    15: { maxHouses: 100, unlocked: false, baseForce: 14500 },
    16: { maxHouses: 100, unlocked: false, baseForce: 15000 },
    17: { maxHouses: 100, unlocked: false, baseForce: 15500 },
  },
  energyCost: 4,
  goldDiceCost: 20 // gemas
};

/**
 * Inicializa o estado do maze para o usuário
 */
function initMazeState(user, mapId) {
  if (!user.mazes) user.mazes = {};
  if (!user.mazes[mapId]) {
    user.mazes[mapId] = {
      position: 0,
      usedToday: 0,
      resetUsed: false
    };
  }
}

/**
 * Rola o dado e avança no maze
 */
export function rollMaze(user, mapId) {
  const map = mazeConfig.maps[mapId];
  if (!map || !map.unlocked) return "❌ Mapa não desbloqueado.";
  
  initMazeState(user, mapId);
  
  const mazeState = user.mazes[mapId];
  
  if (mazeState.usedToday >= 2) return "⚠️ Você já usou suas 2 tentativas diárias neste mapa.";
  
  if (!spendEnergy(user, mazeConfig.energyCost)) return "⚡ Energia insuficiente.";
  
  // Rola dado (1 a 6)
  const roll = Math.floor(Math.random() * 6) + 1;
  mazeState.position += roll;
  
  if (mazeState.position > map.maxHouses) mazeState.position = map.maxHouses;
  
  // Recompensa de casa
  let message = `🎲 Você rolou ${roll} e está na casa ${mazeState.position}/${map.maxHouses}.\n`;
  
  const rewardRoll = Math.random();
  if (rewardRoll < 0.4) {
    const goldReward = 500 + Math.floor(Math.random() * 1000);
    addGold(user, goldReward);
    message += `💰 Você encontrou ${goldReward} de ouro!\n`;
  } else if (rewardRoll < 0.7) {
    const xpReward = 50 + Math.floor(Math.random() * 200);
    addXp(user, xpReward);
    message += `✨ Você ganhou ${xpReward} XP!\n`;
  } else {
    // Luta
    const battleResult = battle(user, { type: "mazeEnemy", mapForce: map.baseForce });
    if (battleResult.win) {
      message += `⚔️ Você venceu a batalha! Avance normalmente.\n`;
    } else {
      mazeState.position = Math.max(mazeState.position - roll, 0);
      message += `❌ Você perdeu a batalha e voltou algumas casas.\n`;
    }
  }
  
  mazeState.usedToday++;
  saveUser(user);
  
  // Checagem de chefão
  if (mazeState.position === map.maxHouses) {
    message += `👑 Você alcançou o chefão do mapa ${mapId}!\n`;
    const bossReward = summonMultiple(user, "mazeBoss", 3, { mapForce: map.baseForce });
    const goldFinal = 5000 + Math.floor(Math.random() * 5000);
    const xpFinal = 500 + Math.floor(Math.random() * 500);
    addGold(user, goldFinal);
    addXp(user, xpFinal);
    message += `🏆 Recompensas do chefão: 3 cartas + ${goldFinal} de ouro + ${xpFinal} XP.\n`;
    message += bossReward;
  }
  
  return message;
}

/**
 * Usa o Gold Dice para escolher casa
 */
export function useGoldDice(user, mapId, targetHouse) {
  if (!user.mazes || !user.mazes[mapId]) return "❌ Maze não iniciado.";
  
  if (user.gems < mazeConfig.goldDiceCost) return "💎 Gemas insuficientes para usar o Gold Dice.";
  
  user.gems -= mazeConfig.goldDiceCost;
  const mazeState = user.mazes[mapId];
  
  if (targetHouse < mazeState.position) return "⚠️ Não pode retroceder casas com o Gold Dice.";
  mazeState.position = Math.min(targetHouse, mazeConfig.maps[mapId].maxHouses);
  
  saveUser(user);
  return `🎲 Gold Dice usado! Você avançou para a casa ${mazeState.position}.`;
}

/**
 * Reseta o maze (uma vez por dia)
 */
export function resetMaze(user, mapId) {
  initMazeState(user, mapId);
  const mazeState = user.mazes[mapId];
  
  if (mazeState.resetUsed) return "⚠️ Você já usou o reset do maze hoje.";
  
  mazeState.position = 0;
  mazeState.usedToday = 0;
  mazeState.resetUsed = true;
  saveUser(user);
  return "🔄 Maze resetado! Você pode jogar novamente.";
}