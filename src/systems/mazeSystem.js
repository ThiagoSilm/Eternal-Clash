// src/systems/mazeSystem.js

// 1. CORREÇÃO: Removemos loadUser e saveUserData.
// O Middleware carrega e salva. O objeto 'user' será passado.
import { spendGems, spendEnergy, addGold, addXP } from "./economySystem.js";
import { summonMultiple } from "./summonSystem.js";
// Assumindo que battle existe e aceita o deck do usuário e o oponente
import { battle } from "./battleSystem.js";

// Configurações de maze (MANTIDAS, apenas o custo do Gold Dice é alterado para ser Gems)
const mazeConfig = {
  // ... (mapConfig)
  maps: {
    // ...
  },
  energyCost: 4,
  goldDiceCost: 20 // gemas
};

// ... (Funções auxiliares inalteradas) ...
function checkAndResetDaily(mazeState) { /* ... */ }

function initMazeState(user, mapId) { /* ... */ }

/**
 * Rola o dado e avança no maze
 * 🎯 CORREÇÃO 1: Assinatura alterada para receber o objeto 'user'
 */
export function rollMaze(user, mapId) {
  // ❌ REMOVIDO: const user = loadUser(userId);
  
  const map = mazeConfig.maps[mapId];
  
  if (!map || !map.unlocked) throw new Error("Mapa não desbloqueado.");
  
  initMazeState(user, mapId);
  const mazeState = user.mazes[mapId];
  
  checkAndResetDaily(mazeState); // Reset diário
  
  if (mazeState.usedToday >= 2) throw new Error("⚠️ Você já usou suas 2 tentativas diárias neste mapa.");
  
  // 🎯 CORREÇÃO 2: Usa spendEnergy no objeto 'user'
  if (!spendEnergy(user, mazeConfig.energyCost)) throw new Error("⚡ Energia insuficiente.");
  
  // Rola dado (1 a 6)
  const roll = Math.floor(Math.random() * 6) + 1;
  mazeState.position += roll;
  
  if (mazeState.position > map.maxHouses) mazeState.position = map.maxHouses;
  
  let message = `🎲 Você rolou ${roll} e está na casa ${mazeState.position}/${map.maxHouses}.\n`;
  
  // Lógica de Recompensa
  const rewardRoll = Math.random();
  if (rewardRoll < 0.4) {
    const goldReward = 500 + Math.floor(Math.random() * 1000);
    // 🎯 CORREÇÃO 3: Usa addGold no objeto 'user'
    addGold(user, goldReward);
    message += `💰 Você encontrou ${goldReward} de ouro!\n`;
  } else if (rewardRoll < 0.7) {
    const xpReward = 50 + Math.floor(Math.random() * 200);
    // 🎯 CORREÇÃO 4: Usa addXP no objeto 'user'
    addXP(user, xpReward);
    message += `✨ Você ganhou ${xpReward} XP!\n`;
  } else {
    // Luta: Assumindo que battleSystem é síncrono e usa o deck principal
    const battleResult = battle(user.decks.main || [], { type: "mazeEnemy", mapForce: map.baseForce });
    
    if (battleResult.win) {
      message += `⚔️ Você venceu a batalha! Avance normalmente.\n`;
    } else {
      mazeState.position = Math.max(mazeState.position - Math.floor(roll / 2), 0);
      message += `❌ Você perdeu a batalha e voltou para a casa ${mazeState.position}.\n`;
    }
  }
  
  mazeState.usedToday++;
  // ❌ REMOVIDO: saveUserData(user); - O Middleware salva.
  
  // Checagem de chefão
  if (mazeState.position === map.maxHouses) {
    message += `👑 Você alcançou o chefão do mapa ${mapId}!\n`;
    
    const bossReward = summonMultiple(user, "mazeBoss", 3, { mapForce: map.baseForce });
    
    const goldFinal = 5000 + Math.floor(Math.random() * 5000);
    const xpFinal = 500 + Math.floor(Math.random() * 500);
    
    // 🎯 CORREÇÃO 5: Usa addGold/addXP no objeto 'user'
    addGold(user, goldFinal);
    addXP(user, xpFinal);
    
    message += `🏆 Recompensas do chefão: 3 cartas + ${goldFinal} de ouro + ${xpFinal} XP.\n`;
    message += bossReward;
  }
  
  return message;
}

/**
 * Usa o Gold Dice para escolher casa
 * 🎯 CORREÇÃO 6: Assinatura alterada para receber o objeto 'user'
 */
export function useGoldDice(user, mapId, targetHouse) {
  // ❌ REMOVIDO: const user = loadUser(userId);
  
  if (!user.mazes || !user.mazes[mapId]) throw new Error("❌ Maze não iniciado.");
  
  // 🎯 CORREÇÃO 7: Usa spendGems no objeto 'user'
  if (!spendGems(user, mazeConfig.goldDiceCost)) {
    throw new Error("💎 Gemas insuficientes para usar o Gold Dice.");
  }
  
  const mazeState = user.mazes[mapId];
  
  if (targetHouse < mazeState.position) throw new Error("⚠️ Não pode retroceder casas com o Gold Dice.");
  mazeState.position = Math.min(targetHouse, mazeConfig.maps[mapId].maxHouses);
  
  // ❌ REMOVIDO: saveUserData(user);
  return `🎲 Gold Dice usado! Você avançou para a casa ${mazeState.position}.`;
}

/**
 * Reseta o maze (uma vez por dia)
 * 🎯 CORREÇÃO 8: Assinatura alterada para receber o objeto 'user'
 */
export function resetMaze(user, mapId) {
  // ❌ REMOVIDO: const user = loadUser(userId);
  
  initMazeState(user, mapId);
  const mazeState = user.mazes[mapId];
  
  checkAndResetDaily(mazeState); // Checa se já pode resetar
  
  if (mazeState.resetUsed) throw new Error("⚠️ Você já usou o reset manual do maze hoje.");
  
  mazeState.position = 0;
  mazeState.usedToday = 0;
  mazeState.resetUsed = true;
  // ❌ REMOVIDO: saveUserData(user);
  return "🔄 Maze resetado! Você pode jogar novamente (tentativas restauradas).";
}