// src/systems/mazeSystem.js
import { spendGems, spendEnergy, addGold, addXP } from "./economySystem.js";
import { summonMultiple } from "./summonSystem.js";
import { runBattle } from "./battleSystem.js";
import { markUserDirty } from "./userCacheSystem.js";

export const mazeConfig = {
  energyCost: 4,
  goldDiceGemCost: 20,
  maps: {
    map1: { maxHouses: 40, baseForce: 10, unlocked: true, rewardScale: 1 },
    map2: { maxHouses: 60, baseForce: 20, unlocked: false, rewardScale: 1.3 },
    map3: { maxHouses: 80, baseForce: 30, unlocked: false, rewardScale: 1.6 },
  },
  houseTypes: ["empty", "question", "enemy"],
  questionChance: 0.2,
  enemyChance: 0.1,
};

// -------------------
// Funções de estado
// -------------------
function initMazeState(user, mapId) {
  if (!user.mazes || typeof user.mazes !== "object") user.mazes = {};
  if (!user.mazes[mapId] || typeof user.mazes[mapId] !== "object") {
    user.mazes[mapId] = {
      position: 0,
      usedToday: 0,
      resetUsed: false,
      lastDailyReset: 0,
    };
  }

  const state = user.mazes[mapId];

  // Garante tipos corretos
  state.position = Number(state.position || 0);
  state.usedToday = Number(state.usedToday || 0);
  state.resetUsed = Boolean(state.resetUsed);
  state.lastDailyReset = Number(state.lastDailyReset || 0);

  return state;
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

// -------------------
// Casas com RNG melhorado
// -------------------
function getHouseType(mazeState, map) {
  // Ajusta chance base dependendo do progresso
  const progressRatio = mazeState.position / map.maxHouses; // 0 a 1
  let enemyChance = mazeConfig.enemyChance + progressRatio * 0.2; // mais inimigos no final
  let questionChance = mazeConfig.questionChance + (1 - progressRatio) * 0.1; // mais "?" no início

  enemyChance = Math.min(enemyChance, 0.5); // cap max 50%
  questionChance = Math.min(questionChance, 0.3); // cap max 30%
  const emptyChance = 1 - enemyChance - questionChance;

  // Cria array ponderado
  const weighted = [];
  for (let i = 0; i < Math.floor(emptyChance * 100); i++) weighted.push("empty");
  for (let i = 0; i < Math.floor(questionChance * 100); i++) weighted.push("question");
  for (let i = 0; i < Math.floor(enemyChance * 100); i++) weighted.push("enemy");

  // Escolhe aleatoriamente
  return weighted[Math.floor(Math.random() * weighted.length)];
}

function generateMazeEnemy(map) {
  return {
    type: "mazeEnemy",
    force: map.baseForce + Math.floor(Math.random() * 10),
    deck: "deckSimulado",
    guardian: "guardiãoSimulado",
  };
}

async function handleHouse(user, map, houseType) {
  let msg = "";
  let prize = null;

  if (houseType === "empty") {
    const gold = Math.floor(200 * map.rewardScale);
    const xp = Math.floor(50 * map.rewardScale);
    addGold(user, gold);
    addXP(user, xp);
    msg = `💰 Casa comum: você ganhou **${gold} ouro + ${xp} XP**.`;
    prize = { type: "coin", amount: gold, xp };
  } else if (houseType === "question") {
    const r = Math.random();
    if (r < 0.5) {
      const gold = Math.floor(400 * map.rewardScale + Math.random() * 600);
      addGold(user, gold);
      msg = `🎁 Casa “?”! Você encontrou **${gold} ouro**!`;
      prize = { type: "coin", amount: gold };
    } else if (r < 0.8) {
      const cards = summonMultiple(user, "mazeCard", 2 + Math.floor(Math.random() * 2));
      msg = `🎴 Casa “?”! Você ganhou cartas:\n${cards}`;
      prize = { type: "cards" };
    } else {
      const enemy = generateMazeEnemy(map);
      const battle = await runBattle(user, enemy);
      if (battle.win) {
        msg = `⚔️ Casa “?”! Você venceu o inimigo com guardião ${enemy.guardian}!`;
        prize = { type: "trophy" };
      } else {
        msg = `💀 Casa “?”! Você perdeu para o inimigo e voltou 2 casas.`;
        return { message: msg, prize, rollback: 2 };
      }
    }
  } else if (houseType === "enemy") {
    const enemy = generateMazeEnemy(map);
    const battle = await runBattle(user, enemy);
    if (battle.win) {
      msg = `⚔️ Você venceu o inimigo com guardião ${enemy.guardian}!`;
      prize = { type: "trophy" };
    } else {
      msg = `💀 Você perdeu para o inimigo e voltou 2 casas.`;
      return { message: msg, prize, rollback: 2 };
    }
  }

  return { message: msg, prize, rollback: 0 };
}

// -------------------
// Roll / Movimento
// -------------------
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

  const houseType = getHouseType(mazeState, map);
  const houseResult = await handleHouse(user, map, houseType);

  if (houseResult.rollback) mazeState.position = Math.max(mazeState.position - houseResult.rollback, 0);

  mazeState.usedToday++;

  // Boss final
  if (mazeState.position === map.maxHouses) {
    msg += `👑 CHEFÃO do mapa **${mapId}**!\n`;
    const battle = await runBattle(user, generateMazeEnemy(map));
    if (!battle.win) {
      mazeState.position = Math.max(mazeState.position - 3, 0);
      msg += `❌ Você perdeu! Voltou 3 casas.\n`;
    } else {
      const g = Math.floor(5000 * map.rewardScale);
      const x = Math.floor(600 * map.rewardScale);
      addGold(user, g);
      addXP(user, x);
      msg += `🏆 Vitória! Recompensas:\n• **3 cartas (boss)**\n• **${g} ouro**\n• **${x} XP**\n`;
      msg += summonMultiple(user, "mazeBoss", 3) || "";
    }
  }

  markUserDirty(user.id);
  return { message: msg, prize: houseResult.prize };
}

// -------------------
// Gold Dice
// -------------------
export function useGoldDice(user, mapId, targetHouse) {
  const map = mazeConfig.maps[mapId];
  const mazeState = initMazeState(user, mapId);

  if (!spendGems(user, mazeConfig.goldDiceGemCost)) throw new Error("Gemas insuficientes.");
  if (targetHouse < mazeState.position) throw new Error("Gold Dice não retrocede casas.");

  mazeState.position = Math.min(targetHouse, map.maxHouses);
  markUserDirty(user.id);
  return { message: `🎲 Gold Dice: agora você está na casa **${mazeState.position}**.`, prize: null };
}

// -------------------
// Reset / Estado
// -------------------
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
  if (!map || !map.unlocked) return null;

  const state = getMazeState(user, mapId);
  return {
    totalHouses: map.maxHouses,
    currentHouse: state.position,
    visitedHouses: Array.from({ length: state.position }, (_, i) => i + 1),
  };
}

export function startMaze(user) {
  const mapId = getCurrentMapId(user) || "map1";
  const state = getMazeState(user, mapId);
  state.position = 0;
  state.usedToday = 0;
  state.resetUsed = false;
  return `✅ Maze iniciado no mapa **${mapId}**! Use \`!maze roll\` para rolar o dado.`;
}