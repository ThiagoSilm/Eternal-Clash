// src/systems/mazeSystem.js

// 1. IMPORTAÇÕES CORRIGIDAS
import { loadUser, saveUserData } from "./userSystem.js"; // Carrega e Salva
import { spendGems, spendEnergy, addGold, addXP } from "./economySystem.js"; // Economia
import { summonMultiple } from "./summonSystem.js";
import { battle } from "./battleSystem.js"; // Supondo que battle recebe o deck

// Configurações de maze (MANTIDAS)
const mazeConfig = {
  // ... (mapConfig)
  maps: {
    // ...
  },
  energyCost: 4,
  goldDiceCost: 20 // gemas
};

/**
 * [HELPER] Verifica se é um novo dia e reseta os contadores 'usedToday' e 'resetUsed'.
 */
function checkAndResetDaily(mazeState) {
    const now = new Date();
    const lastUse = new Date(mazeState.lastUsedDate || 0);

    if (now.toDateString() !== lastUse.toDateString()) {
        mazeState.usedToday = 0;
        mazeState.resetUsed = false;
        mazeState.lastUsedDate = now.getTime();
        return true;
    }
    // Garante que o timestamp é atualizado mesmo que não haja reset total.
    mazeState.lastUsedDate = now.getTime(); 
    return false;
}

/**
 * Inicializa o estado do maze para o usuário
 */
function initMazeState(user, mapId) {
  if (!user.mazes) user.mazes = {};
  if (!user.mazes[mapId]) {
    user.mazes[mapId] = {
      position: 0,
      usedToday: 0,
      resetUsed: false,
      lastUsedDate: 0 // Adicionado para controle diário
    };
  }
}

/**
 * Rola o dado e avança no maze
 */
export function rollMaze(userId, mapId) {
  const user = loadUser(userId);
  const map = mazeConfig.maps[mapId];

  if (!map || !map.unlocked) return "❌ Mapa não desbloqueado.";
  
  initMazeState(user, mapId);
  const mazeState = user.mazes[mapId];
  
  checkAndResetDaily(mazeState); // 2. CORREÇÃO: Reset diário

  if (mazeState.usedToday >= 2) return "⚠️ Você já usou suas 2 tentativas diárias neste mapa.";
  
  // 1. CORREÇÃO: Usa spendEnergy do economySystem
  if (!spendEnergy(userId, mazeConfig.energyCost)) return "⚡ Energia insuficiente."; 
  
  // Rola dado (1 a 6)
  const roll = Math.floor(Math.random() * 6) + 1;
  mazeState.position += roll;
  
  if (mazeState.position > map.maxHouses) mazeState.position = map.maxHouses;
  
  let message = `🎲 Você rolou ${roll} e está na casa ${mazeState.position}/${map.maxHouses}.\n`;
  
  // Lógica de Recompensa
  const rewardRoll = Math.random();
  if (rewardRoll < 0.4) {
    const goldReward = 500 + Math.floor(Math.random() * 1000);
    addGold(userId, goldReward); // 1. CORREÇÃO: Usa addGold
    message += `💰 Você encontrou ${goldReward} de ouro!\n`;
  } else if (rewardRoll < 0.7) {
    const xpReward = 50 + Math.floor(Math.random() * 200);
    addXP(userId, xpReward); // 1. CORREÇÃO: Usa addXP
    message += `✨ Você ganhou ${xpReward} XP!\n`;
  } else {
    // Luta
    // 3. CORREÇÃO: Passa o deck, não o objeto user
    const battleResult = battle(user.decks.main || [], { type: "mazeEnemy", mapForce: map.baseForce });
    
    if (battleResult.win) {
      message += `⚔️ Você venceu a batalha! Avance normalmente.\n`;
    } else {
      // Volta metade das casas roladas
      mazeState.position = Math.max(mazeState.position - Math.floor(roll / 2), 0); 
      message += `❌ Você perdeu a batalha e voltou para a casa ${mazeState.position}.\n`;
    }
  }
  
  mazeState.usedToday++;
  saveUserData(user); // 1. CORREÇÃO: Usa saveUserData

  // Checagem de chefão
  if (mazeState.position === map.maxHouses) {
    message += `👑 Você alcançou o chefão do mapa ${mapId}!\n`;
    
    // Assumindo que summonMultiple tem a lógica de recompensa do boss
    const bossReward = summonMultiple(user, "mazeBoss", 3, { mapForce: map.baseForce }); 
    
    const goldFinal = 5000 + Math.floor(Math.random() * 5000);
    const xpFinal = 500 + Math.floor(Math.random() * 500);
    
    addGold(userId, goldFinal);
    addXP(userId, xpFinal);
    
    message += `🏆 Recompensas do chefão: 3 cartas + ${goldFinal} de ouro + ${xpFinal} XP.\n`;
    message += bossReward;
  }
  
  return message;
}

/**
 * Usa o Gold Dice para escolher casa
 */
export function useGoldDice(userId, mapId, targetHouse) {
  const user = loadUser(userId);
  if (!user.mazes || !user.mazes[mapId]) return "❌ Maze não iniciado.";
  
  // 1. CORREÇÃO: Usa spendGems do economySystem
  if (!spendGems(userId, mazeConfig.goldDiceCost)) { 
      return "💎 Gemas insuficientes para usar o Gold Dice.";
  }
  
  const mazeState = user.mazes[mapId];
  
  if (targetHouse < mazeState.position) return "⚠️ Não pode retroceder casas com o Gold Dice.";
  mazeState.position = Math.min(targetHouse, mazeConfig.maps[mapId].maxHouses);
  
  saveUserData(user); // 1. CORREÇÃO: Usa saveUserData
  return `🎲 Gold Dice usado! Você avançou para a casa ${mazeState.position}.`;
}

/**
 * Reseta o maze (uma vez por dia)
 */
export function resetMaze(userId, mapId) {
  const user = loadUser(userId);
  initMazeState(user, mapId);
  const mazeState = user.mazes[mapId];
  
  // 2. CORREÇÃO: O reset diário agora é feito automaticamente em rollMaze.
  // Esta função agora apenas permite o reset manual SE AINDA NÃO FOI USADO HOJE.
  
  checkAndResetDaily(mazeState); // Checa se já pode resetar
  
  if (mazeState.resetUsed) return "⚠️ Você já usou o reset manual do maze hoje.";
  
  mazeState.position = 0;
  mazeState.usedToday = 0;
  mazeState.resetUsed = true;
  saveUserData(user);
  return "🔄 Maze resetado! Você pode jogar novamente (tentativas restauradas).";
}
