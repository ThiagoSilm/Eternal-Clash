import { spendEnergy, addGold, addXP, ENERGY_TYPES, spendGems } from "./economySystem.js";
import { summonMultiple } from "./summonSystem.js";
import { runBattle } from "./battleSystem.js";
import { markUserDirty } from "./userCacheSystem.js";

/* --------------------------
   CONSTANTS & SAFE UTILS
   -------------------------- */
const MAZE_CONFIG = Object.freeze({
  energyCost: 4,
  goldDiceGemCost: 20,
  maps: {
    map1: { maxHouses: 40, baseForce: 10, unlocked: true, rewardScale: 1 },
    map2: { maxHouses: 60, baseForce: 20, unlocked: false, rewardScale: 1.3 },
    map3: { maxHouses: 80, baseForce: 30, unlocked: false, rewardScale: 1.6 },
  }
});

const SAFE = Object.freeze({
  now: () => Date.now(),
  rand: () => Math.random(),
  clamp: (v, min, max) => Math.min(Math.max(v, min), max),
  assertUser: (u) => { if (!u || typeof u !== "object") throw new Error("User inválido"); },
  assertMap: (m) => { if (!m) throw new Error("Mapa inválido"); }
});

/* --------------------------
   STATE MANAGEMENT
   -------------------------- */

function getMazeState(user, mapId) {
  SAFE.assertUser(user);
  user.mazes = user.mazes || {};
  
  if (!user.mazes[mapId]) {
    user.mazes[mapId] = {
      position: 0,
      usedToday: 0,
      resetUsed: false,
      lastDailyReset: SAFE.now(),
    };
  }
  
  checkDailyReset(user.mazes[mapId]);
  return user.mazes[mapId];
}

function checkDailyReset(state) {
  const DAY_MS = 86400000;
  if (SAFE.now() - state.lastDailyReset >= DAY_MS) {
    state.usedToday = 0;
    state.resetUsed = false;
    state.lastDailyReset = SAFE.now();
  }
}

/* --------------------------
   CORE: ROLL MAZE
   -------------------------- */

export async function rollMaze(user, mapId) {
  SAFE.assertUser(user);
  const map = MAZE_CONFIG.maps[mapId];
  SAFE.assertMap(map);
  if (!map.unlocked) throw new Error("Mapa bloqueado.");

  const state = getMazeState(user, mapId);
  validateMazeEntry(user, state); // Helper to reduce lines

  // Action: Move
  const dice = 1 + Math.floor(SAFE.rand() * 6);
  state.position = SAFE.clamp(state.position + dice, 0, map.maxHouses);
  state.usedToday++;

  // Action: Resolve Tile
  let result = await resolveTile(user, map, state.position);

  // Action: Apply Rollback (if any)
  if (result.rollback) {
    state.position = SAFE.clamp(state.position - result.rollback, 0, map.maxHouses);
  }

  // Action: Boss Check
  if (state.position === map.maxHouses) {
    result = await handleBossEncounter(user, map, state, result);
  }

  markUserDirty(user.id);
  return result;
}

function validateMazeEntry(user, state) {
  if (state.usedToday >= 2) throw new Error("Limite diário atingido (2/2).");
  if (!spendEnergy(user, ENERGY_TYPES.ADVENTURE, MAZE_CONFIG.energyCost)) {
    throw new Error("Energia insuficiente.");
  }
}

/* --------------------------
   TILE RESOLUTION logic
   -------------------------- */

async function resolveTile(user, map, position) {
  const type = determineTileType(map, position);
  
  switch (type) {
    case "empty": return processEmptyTile(user, map);
    case "question": return processQuestionTile(user, map, position);
    case "enemy": return processEnemyTile(user, map, position);
    default: return { message: "Nada aconteceu.", rollback: 0 };
  }
}

function determineTileType(map, position) {
  const progress = position / map.maxHouses;
  // Probabilities increase slightly as player progresses
  const enemyChance = Math.min(0.1 + (progress * 0.25), 0.5);
  const questChance = Math.min(0.2 + (progress * 0.25), 0.5);
  
  const roll = SAFE.rand();
  if (roll < enemyChance) return "enemy";
  if (roll < enemyChance + questChance) return "question";
  return "empty";
}

function processEmptyTile(user, map) {
  const gold = Math.floor((200 + SAFE.rand() * 300) * map.rewardScale);
  const xp = Math.floor((50 + SAFE.rand() * 50) * map.rewardScale);
  
  addGold(user, gold);
  addXP(user, xp);
  
  return { 
    message: `💰 Casa Comum: Ganhou **${gold} ouro** e **${xp} XP**.`, 
    prize: { type: "coin", gold, xp }, 
    rollback: 0 
  };
}

/* --------------------------
   ENCOUNTER LOGIC
   -------------------------- */

async function processQuestionTile(user, map, position) {
  const roll = SAFE.rand();
  
  if (roll < 0.5) { // 50% Gold
    const gold = Math.floor((400 + SAFE.rand() * 600) * map.rewardScale);
    addGold(user, gold);
    return { message: `🎁 Casa [?]: Encontrou **${gold} ouro**!`, rollback: 0 };
  }
  
  if (roll < 0.8) { // 30% Cards
    const cards = summonMultiple(user, "mazeCard", 2 + Math.floor(SAFE.rand() * 3));
    return { message: `🎴 Casa [?]: Cartas encontradas!\n${cards}`, rollback: 0 };
  }
  
  // 20% Trap (Enemy)
  return processEnemyTile(user, map, position);
}

async function processEnemyTile(user, map, position) {
  const enemy = createEnemy(map, position, false);
  const battle = await runBattle(user, enemy);
  
  if (!battle.win) {
    return { message: `💀 Derrota! Você recuou 2 casas.`, rollback: 2 };
  }
  return { message: `⚔️ Vitória! O caminho está seguro.`, rollback: 0 };
}

function createEnemy(map, position, isBoss) {
  const base = map.baseForce + Math.floor(SAFE.rand() * 10);
  const power = base + Math.floor(position * (isBoss ? 5 : 0.5));
  
  return {
    id: `maze_${isBoss ? 'boss' : 'mob'}_${SAFE.now()}`,
    type: isBoss ? "mazeBoss" : "mazeEnemy",
    hp: power * (isBoss ? 20 : 10),
    maxHp: power * (isBoss ? 20 : 10),
    attack: isBoss ? power * 5 : power,
    deck: "deck_random",
    guardian: isBoss ? "Boss Supremo" : "Monstro"
  };
}

/* --------------------------
   BOSS LOGIC
   -------------------------- */

async function handleBossEncounter(user, map, state, prevResult) {
  const boss = createEnemy(map, state.position, true);
  const battle = await runBattle(user, boss);
  
  let msg = "";
  if (!battle.win) {
    state.position = SAFE.clamp(state.position - 3, 0, map.maxHouses);
    msg = `\n💀 BOSS: Derrota! Recuou 3 casas.`;
  } else {
    const gold = Math.floor((5000 + SAFE.rand() * 2000) * map.rewardScale);
    addGold(user, gold);
    summonMultiple(user, "mazeBoss", 3);
    msg = `\n🏆 BOSS: VITÓRIA! Recompensas lendárias recebidas!`;
  }
  
  return { ...prevResult, message: prevResult.message + msg };
}

/* --------------------------
   GOLD DICE & UTILS
   -------------------------- */

export function useGoldDice(user, mapId, target) {
  SAFE.assertUser(user);
  const map = MAZE_CONFIG.maps[mapId];
  const state = getMazeState(user, mapId);

  if (!spendGems(user, MAZE_CONFIG.goldDiceGemCost)) {
    throw new Error("Gemas insuficientes.");
  }
  if (target <= state.position) throw new Error("Gold Dice apenas avança.");

  state.position = SAFE.clamp(target, 0, map.maxHouses);
  markUserDirty(user.id);
  return { message: `🎲 Gold Dice: Teleportado para a casa ${state.position}.` };
}

export function resetMaze(user, mapId) {
  SAFE.assertUser(user);
  const state = getMazeState(user, mapId);
  
  if (state.resetUsed) throw new Error("Reset diário já utilizado.");
  
  state.position = 0;
  state.usedToday = 0;
  state.resetUsed = true;
  markUserDirty(user.id);
  return "🔄 Labirinto resetado com sucesso!";
}

// Read-only Exports
export function getMazeMapInfo(user, mapId) {
  const map = MAZE_CONFIG.maps[mapId];
  if (!map) return null;
  const s = getMazeState(user, mapId);
  return {
    totalHouses: map.maxHouses,
    currentHouse: s.position,
    visitedHouses: s.position 
  };
}

export const getCurrentMapId = () => "map1";
export const startMaze = (u) => { getMazeState(u, "map1"); return "Iniciado"; };
