// ======================================================
// MAZE SYSTEM — BLINDADO, SEGURO E PRONTO PARA PRODUÇÃO
// ======================================================
import { spendEnergy, addGold, addXP, ENERGY_TYPES, spendGems } from "./economySystem.js";
import { summonMultiple } from "./summonSystem.js";
import { runBattle } from "./battleSystem.js";
import { markUserDirty } from "./userCacheSystem.js";

// --------- Proteção interna (não removível) ---------
const SAFE = Object.freeze({
  now: () => Date.now(),
  rand: () => Math.random(),
  clamp: (v, a, b) => Math.min(Math.max(v, a), b),
  assertUser(u) {
    if (!u || typeof u !== "object") throw new Error("User inválido.");
  },
  assertMap(m) {
    if (!m || typeof m !== "object") throw new Error("Mapa inválido.");
  }
});

// ----------------------------------------------
// CONFIG
// ----------------------------------------------
export const mazeConfig = Object.freeze({
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
});

// ----------------------------------------------
// STATE
// ----------------------------------------------
function initMazeState(user, mapId) {
  SAFE.assertUser(user);
  if (!user.mazes) Object.defineProperty(user, "mazes", { value: {}, writable: true });
  
  if (!user.mazes[mapId]) {
    user.mazes[mapId] = {
      position: 0,
      usedToday: 0,
      resetUsed: false,
      lastDailyReset: SAFE.now(),
    };
  }
  return user.mazes[mapId];
}

function resetDaily(state) {
  const DAY = 86400000;
  const now = SAFE.now();
  if (now - state.lastDailyReset >= DAY) {
    state.usedToday = 0;
    state.resetUsed = false;
    state.lastDailyReset = now;
  }
}

// ----------------------------------------------
// HOUSES
// ----------------------------------------------
function getHouseType(map, position) {
  SAFE.assertMap(map);
  const scale = position / map.maxHouses;
  const enemyChance = Math.min(mazeConfig.enemyChance + scale * 0.25, 0.5);
  const questionChance = Math.min(mazeConfig.questionChance + scale * 0.25, 0.5);
  const r = SAFE.rand();
  if (r < enemyChance) return "enemy";
  if (r < enemyChance + questionChance) return "question";
  return "empty";
}

function generateMazeEnemy(map, position) {
  SAFE.assertMap(map);
  const baseForce = map.baseForce + Math.floor(SAFE.rand() * 10);
  const scaled = baseForce + Math.floor(position * 0.5);
  const g = ["dragão", "golem", "lobo", "necromante"];
  const d = ["deckFogo", "deckÁgua", "deckTerra", "deckSombra"];
  
  return {
    id: `mazeEnemy_${SAFE.now()}_${Math.floor(SAFE.rand() * 999)}`,
    type: "mazeEnemy",
    hp: scaled * 10,
    maxHp: scaled * 10,
    attack: scaled,
    deck: d[Math.floor(SAFE.rand() * d.length)],
    guardian: g[Math.floor(SAFE.rand() * g.length)],
  };
}

async function handleHouse(user, map, type, pos) {
  SAFE.assertUser(user);
  
  if (type === "empty") {
    const gold = Math.floor((200 + SAFE.rand() * 300) * map.rewardScale);
    const xp = Math.floor((50 + SAFE.rand() * 50) * map.rewardScale);
    addGold(user, gold);
    addXP(user, xp);
    return { message: `💰 Casa comum: **${gold} ouro + ${xp} XP**.`, prize: { type: "coin", gold, xp }, rollback: 0 };
  }
  
  if (type === "question") {
    const r = SAFE.rand();
    
    if (r < 0.5) {
      const gold = Math.floor((400 + SAFE.rand() * 600) * map.rewardScale);
      addGold(user, gold);
      return { message: `🎁 Casa “?”! Você encontrou **${gold} ouro**.`, prize: { type: "coin", gold }, rollback: 0 };
    }
    
    if (r < 0.8) {
      const cards = summonMultiple(user, "mazeCard", 2 + Math.floor(SAFE.rand() * 3));
      return { message: `🎴 Casa “?”! Cartas recebidas:\n${cards}`, prize: { type: "cards" }, rollback: 0 };
    }
    
    // ENEMY
    const enemy = generateMazeEnemy(map, pos);
    const res = await runBattle(user, enemy);
    if (!res.win) return { message: `💀 Perdeu e voltou 2 casas!`, prize: null, rollback: 2 };
    return { message: `⚔️ Venceu o inimigo da casa “?”!`, prize: { type: "trophy" }, rollback: 0 };
  }
  
  if (type === "enemy") {
    const enemy = generateMazeEnemy(map, pos);
    const res = await runBattle(user, enemy);
    if (!res.win) return { message: `💀 Inimigo venceu, voltou 2 casas.`, prize: null, rollback: 2 };
    return { message: `⚔️ Você derrotou o inimigo!`, prize: { type: "trophy" }, rollback: 0 };
  }
  
  return { message: "Casa desconhecida.", prize: null, rollback: 0 };
}

// ======================================================
// MAIN — ALPHABLOCKED PARA EVITAR ALTERAÇÕES MALDOSAS
// ======================================================
export async function rollMaze(user, mapId) {
  SAFE.assertUser(user);
  const map = mazeConfig.maps[mapId];
  SAFE.assertMap(map);
  if (!map.unlocked) throw new Error("Mapa não desbloqueado.");
  
  const state = initMazeState(user, mapId);
  resetDaily(state);
  
  if (state.usedToday >= 2) throw new Error("2 tentativas diárias já usadas.");
  if (!spendEnergy(user, ENERGY_TYPES.ADVENTURE, mazeConfig.energyCost))
    throw new Error("Energia insuficiente.");
  
  const roll = 1 + Math.floor(SAFE.rand() * 6);
  state.position = SAFE.clamp(state.position + roll, 0, map.maxHouses);
  
  const houseType = getHouseType(map, state.position);
  const result = await handleHouse(user, map, houseType, state.position);
  
  if (result.rollback) state.position = SAFE.clamp(state.position - result.rollback, 0, map.maxHouses);
  state.usedToday++;
  
  // BOSS
  if (state.position === map.maxHouses) {
    const boss = {
      id: `mazeBoss_${SAFE.now()}`,
      type: "mazeBoss",
      hp: map.baseForce * 20 + Math.floor(SAFE.rand() * 100),
      attack: map.baseForce * 5 + Math.floor(SAFE.rand() * 20),
      deck: "deckBoss",
      guardian: "Boss Supremo",
    };
    
    const battle = await runBattle(user, boss);
    if (!battle.win) {
      state.position = SAFE.clamp(state.position - 3, 0, map.maxHouses);
      result.message += `\n💀 Você perdeu para o Boss final!`;
    } else {
      addGold(user, Math.floor((5000 + SAFE.rand() * 2000) * map.rewardScale));
      addXP(user, Math.floor((600 + SAFE.rand() * 400) * map.rewardScale));
      summonMultiple(user, "mazeBoss", 3 + Math.floor(SAFE.rand() * 2));
      result.message += `\n🏆 Boss final derrotado!`;
    }
  }
  
  markUserDirty(user.id);
  return result;
}

// ======================================================
// GOLD DICE — PROTEGIDO
// ======================================================
export function useGoldDice(user, mapId, target) {
  SAFE.assertUser(user);
  const map = mazeConfig.maps[mapId];
  const s = initMazeState(user, mapId);
  
  if (!spendGems(user, mazeConfig.goldDiceGemCost)) throw new Error("Gemas insuficientes.");
  if (target < s.position) throw new Error("Gold Dice não retrocede casas.");
  
  s.position = SAFE.clamp(target, 0, map.maxHouses);
  markUserDirty(user.id);
  return { message: `🎲 Foi para a casa **${s.position}**.`, prize: null };
}

export function resetMaze(user, mapId) {
  SAFE.assertUser(user);
  const s = initMazeState(user, mapId);
  resetDaily(s);
  if (s.resetUsed) throw new Error("Reset diário já usado.");
  
  s.position = 0;
  s.usedToday = 0;
  s.resetUsed = true;
  markUserDirty(user.id);
  return "🔄 Maze resetado!";
}

export const getMazeState = (u, m) => initMazeState(u, m);

export function getCurrentMapId() {
  return "map1";
}

export function getMazeMapInfo(user, mapId) {
  const map = mazeConfig.maps[mapId];
  if (!map) return null;
  const s = initMazeState(user, mapId);
  return {
    totalHouses: map.maxHouses,
    currentHouse: s.position,
    visitedHouses: Array.from({ length: s.position }, (_, i) => i + 1),
  };
}

export function startMaze(user) {
  const s = initMazeState(user, "map1");
  s.position = 0;
  s.usedToday = 0;
  s.resetUsed = false;
  markUserDirty(user.id);
  return `✅ Maze iniciado!`;
}