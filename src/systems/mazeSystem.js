// src/systems/mazeSystem.js
import { spendGems, spendEnergy, addGold, addXP } from "./economySystem.js";
import { summonMultiple } from "./summonSystem.js";
import { runBattle } from "./battleSystem.js";
import { markUserDirty } from "./userCacheSystem.js";

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
  return user.mazes[mapId] ?? (user.mazes[mapId] = {
    position: 0,
    usedToday: 0,
    resetUsed: false,
    lastDailyReset: 0,
  });
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

async function mazeBattle(user, map) {
  const enemy = { type: "mazeEnemy", force: map.baseForce + Math.floor(Math.random() * 10) };
  return await runBattle(user, enemy);
}

function runMazeEvent(user) {
  const r = Math.random();
  if (r < 0.25) {
    const gold = 200 + Math.floor(Math.random() * 400);
    addGold(user, gold);
    return { message: `🎁 Evento! Você encontrou um baú e ganhou **${gold} ouro**!`, prize: { type: "coin", amount: gold } };
  }
  if (r < 0.5) {
    const xp = 50 + Math.floor(Math.random() * 150);
    addXP(user, xp);
    return { message: `✨ Evento! Sabedoria antiga encontrada: **${xp} XP**!`, prize: { type: "xp", amount: xp } };
  }
  if (r < 0.7) return { message: `🔮 Evento misterioso... Nada aconteceu. Talvez na próxima.`, prize: null };
  if (r < 0.85) {
    user.energy = Math.min(user.energyMax, user.energy + 5);
    return { message: `⚡ Uma fonte de energia! Você recuperou **5 energia**.`, prize: { type: "energy", amount: 5 } };
  }
  return { message: `💀 Armadilha! Você perde **1 casa**.`, prize: null };
}

export async function rollMaze(user, mapId) {
  const map = mazeConfig.maps[mapId];
  if (!map?.unlocked) throw new Error("Mapa não desbloqueado.");

  const mazeState = initMazeState(user, mapId);
  resetDaily(mazeState);

  if (mazeState.usedToday >= 2) throw new Error("Você já usou as 2 tentativas diárias.");
  if (!spendEnergy(user, mazeConfig.energyCost)) throw new Error("Energia insuficiente.");

  const roll = Math.floor(Math.random() * 6) + 1;
  mazeState.position = Math.min(mazeState.position + roll, map.maxHouses);

  let msg = `🎲 Você rolou **${roll}** → casa **${mazeState.position}/${map.maxHouses}**\n`;

  const rarity = rollRarity();
  let prize = null;

  if (rarity === "common") {
    const gold = Math.floor(200 * map.rewardScale);
    addGold(user, gold);
    msg += `💰 (Comum) Você ganhou **${gold} ouro**.\n`;
    prize = { type: "coin", amount: gold };
  } else if (rarity === "rare") {
    const xp = Math.floor(80 * map.rewardScale);
    addXP(user, xp);
    msg += `✨ (Raro) Você ganhou **${xp} XP**.\n`;
    prize = { type: "xp", amount: xp };
  } else if (rarity === "epic") {
    const g = Math.floor(500 * map.rewardScale);
    const x = Math.floor(150 * map.rewardScale);
    addGold(user, g);
    addXP(user, x);
    msg += `🌟 (Épico) Recompensa dupla! **${g} ouro + ${x} XP**.\n`;
    prize = { type: "epic", gold: g, xp: x };
  } else if (rarity === "elite") {
    const battle = await mazeBattle(user, map);
    msg += battle.win ? `⚔️ (Elite) Você venceu!\n` : `💀 (Elite) Você perdeu e voltou 2 casas.\n`;
    if (!battle.win) mazeState.position = Math.max(mazeState.position - 2, 0);
    prize = { type: battle.win ? "trophy" : null };
  } else if (rarity === "event") {
    const eventResult = runMazeEvent(user);
    msg += `🎭 (Evento) ${eventResult.message}\n`;
    prize = eventResult.prize;
  }

  mazeState.usedToday++;

  // Boss final
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
      msg += `🏆 Vitória! Recompensas:\n• **3 cartas (boss)**\n• **${g} ouro**\n• **${x} XP**\n`;
      msg += summonMultiple(user, "mazeBoss", 3) || "";
      prize = { type: "boss", gold: g, xp: x };
    }
  }

  markUserDirty(user.id);
  return { message: msg, prize };
}

// Funções restantes
export function useGoldDice(user, mapId, targetHouse) {
  const map = mazeConfig.maps[mapId];
  const mazeState = initMazeState(user, mapId);

  if (!spendGems(user, mazeConfig.goldDiceGemCost)) throw new Error("Gemas insuficientes.");
  if (targetHouse < mazeState.position) throw new Error("Gold Dice não retrocede casas.");

  mazeState.position = Math.min(targetHouse, map.maxHouses);
  markUserDirty(user.id);
  return { message: `🎲 Gold Dice: agora você está na casa **${mazeState.position}**.`, prize: null };
}

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

export function getMazeState(user, mapId) { return initMazeState(user, mapId); }
export function getCurrentMapId(user) {
  for (const [mapId, map] of Object.entries(mazeConfig.maps)) if (map.unlocked) return mapId;
  return null;
}

export function getMazeMapInfo(user, mapId) {
  const map = mazeConfig.maps[mapId];
  if (!map || !map.unlocked) return null; // ❌ Retorna null se mapa inválido ou bloqueado
  
  const state = getMazeState(user, mapId);
  
  return {
    totalHouses: map.maxHouses,
    currentHouse: state.position,
    visitedHouses: Array.from({ length: state.position }, (_, i) => i + 1),
    prizeHouses: {}, // opcional
  };
}