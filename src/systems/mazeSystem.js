// src/systems/mazeSystem.js
import { spendGems, spendEnergy, addGold, addXP } from "./economySystem.js";
import { summonMultiple } from "./summonSystem.js";
import { runBattle } from "./battleSystem.js";
import { markUserDirty } from "./userCacheSystem.js";

//
// CONFIGURAÇÃO DO MAZE — EXPANDIDO
//
export const mazeConfig = {
  energyCost: 4,
  goldDiceGemCost: 20,
  
  rarityWeights: {
    common: 55,
    rare: 25,
    epic: 12,
    elite: 6,
    event: 2,
  },
  
  maps: {
    map1: { maxHouses: 20, baseForce: 10, unlocked: true, rewardScale: 1 },
    map2: { maxHouses: 25, baseForce: 20, unlocked: false, rewardScale: 1.3 },
    map3: { maxHouses: 30, baseForce: 30, unlocked: false, rewardScale: 1.6 },
  },
};

//
// UTILIDADES
//
function rollRarity() {
  const r = Math.random() * 100;
  let acc = 0;
  for (const [rar, w] of Object.entries(mazeConfig.rarityWeights)) {
    acc += w;
    if (r <= acc) return rar;
  }
  return "common";
}

function initMazeState(user, mapId) {
  user.mazes ||= {};
  return (
    user.mazes[mapId] ??
    (user.mazes[mapId] = {
      position: 0,
      usedToday: 0,
      resetUsed: false,
      lastDailyReset: 0,
    })
  );
}

function resetDaily(mazeState) {
  const now = Date.now();
  const DAY = 86400000;
  if (now - mazeState.lastDailyReset >= DAY) {
    mazeState.usedToday = 0;
    mazeState.resetUsed = false;
    mazeState.lastDailyReset = now;
  }
}

//
// EVENTOS ESPECIAIS DO MAZE
//
function runMazeEvent(user) {
  const r = Math.random();
  if (r < 0.25) {
    const gold = 200 + Math.floor(Math.random() * 400);
    addGold(user, gold);
    return `🎁 Evento! Você encontrou um baú e ganhou **${gold} ouro**!`;
  }
  if (r < 0.5) {
    const xp = 50 + Math.floor(Math.random() * 150);
    addXP(user, xp);
    return `✨ Evento! Sabedoria antiga encontrada: **${xp} XP**!`;
  }
  if (r < 0.7) {
    return `🔮 Evento misterioso... Nada aconteceu. Talvez na próxima.`;
  }
  if (r < 0.85) {
    user.energy = Math.min(user.energyMax, user.energy + 5);
    return `⚡ Uma fonte de energia! Você recuperou **5 energia**.`;
  }
  return `💀 Armadilha! Você perde **1 casa**.`;
}

//
// BATALHA NO MAZE
//
async function mazeBattle(user, map) {
  const enemy = {
    type: "mazeEnemy",
    force: map.baseForce + Math.floor(Math.random() * 10),
  };
  return await runBattle(user, enemy);
}

//
// ROLAR O MAZE (EXPANDIDO)
//
export async function rollMaze(user, mapId) {
  const map = mazeConfig.maps[mapId];
  if (!map?.unlocked) throw new Error("Mapa não desbloqueado.");
  
  const mazeState = initMazeState(user, mapId);
  resetDaily(mazeState);
  
  if (mazeState.usedToday >= 2)
    throw new Error("Você já usou as 2 tentativas diárias.");
  
  if (!spendEnergy(user, mazeConfig.energyCost))
    throw new Error("Energia insuficiente.");
  
  const roll = Math.floor(Math.random() * 6) + 1;
  mazeState.position = Math.min(mazeState.position + roll, map.maxHouses);
  
  let msg = `🎲 Você rolou **${roll}** → casa **${mazeState.position}/${map.maxHouses}**\n`;
  
  const rarity = rollRarity();
  
  //
  // REGRAS POR RARIDADE
  //
  if (rarity === "common") {
    const gold = Math.floor(200 * map.rewardScale);
    addGold(user, gold);
    msg += `💰 (Comum) Você ganhou **${gold} ouro**.\n`;
  } else if (rarity === "rare") {
    const xp = Math.floor(80 * map.rewardScale);
    addXP(user, xp);
    msg += `✨ (Raro) Você ganhou **${xp} XP**.\n`;
  } else if (rarity === "epic") {
    const [g, x] = [
      Math.floor(500 * map.rewardScale),
      Math.floor(150 * map.rewardScale),
    ];
    addGold(user, g);
    addXP(user, x);
    msg += `🌟 (Épico) Recompensa dupla! **${g} ouro + ${x} XP**.\n`;
  } else if (rarity === "elite") {
    const battle = await mazeBattle(user, map);
    msg += battle.win ?
      `⚔️ (Elite) Você venceu!\n` :
      `💀 (Elite) Você perdeu e voltou 2 casas.\n`;
    if (!battle.win) mazeState.position = Math.max(mazeState.position - 2, 0);
  } else if (rarity === "event") {
    msg += `🎭 (Evento) ${runMazeEvent(user)}\n`;
  }
  
  mazeState.usedToday++;
  
  //
  // BOSS FINAL
  //
  if (mazeState.position === map.maxHouses) {
    msg += `👑 CHEFÃO do mapa **${mapId}** encontrado!\n`;
    const battle = await mazeBattle(user, map);
    
    if (!battle.win) {
      mazeState.position -= 3;
      msg += `❌ Você perdeu! Voltou 3 casas.\n`;
    } else {
      const g = Math.floor(5000 * map.rewardScale);
      const x = Math.floor(600 * map.rewardScale);
      addGold(user, g);
      addXP(user, x);
      
      msg += `🏆 Vitória! Recompensas:\n`;
      msg += `• **3 cartas (boss)**\n`;
      msg += `• **${g} ouro**\n`;
      msg += `• **${x} XP**\n`;
      
      msg += summonMultiple(user, "mazeBoss", 3) || "";
    }
  }
  
  markUserDirty(user.id);
  return msg;
}

//
// GOLD DICE — AVANÇAR CASAS PAGANDO GEMAS
//
export function useGoldDice(user, mapId, targetHouse) {
  const map = mazeConfig.maps[mapId];
  const mazeState = initMazeState(user, mapId);
  
  if (!spendGems(user, mazeConfig.goldDiceGemCost))
    throw new Error("Gemas insuficientes.");
  
  if (targetHouse < mazeState.position)
    throw new Error("Gold Dice não retrocede casas.");
  
  mazeState.position = Math.min(targetHouse, map.maxHouses);
  markUserDirty(user.id);
  
  return `🎲 Gold Dice: agora você está na casa **${mazeState.position}**.`;
}

//
// RESET MAZE (DIÁRIO)
//
export function resetMaze(user, mapId) {
  const mazeState = initMazeState(user, mapId);
  resetDaily(mazeState);
  
  if (mazeState.resetUsed) throw new Error("Reset diário já usado.");
  
  mazeState.position = 0;
  mazeState.usedToday = 0;
  mazeState.resetUsed = true;
  
  markUserDirty(user.id);
  return "🔄 Maze resetado para hoje!";
}

export function getMazeState(user, mapId) {
  return initMazeState(user, mapId);
}