import { spendEnergy, addGold, addXP, ENERGY_TYPES, spendGems } from "./economySystem.js";
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

// ---------------------------
// Estado do Maze
// ---------------------------
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

// ---------------------------
// Casas do Maze
// ---------------------------
function getHouseType(map, position) {
  const scale = position / map.maxHouses;
  const enemyChance = Math.min(mazeConfig.enemyChance + scale * 0.25, 0.5);
  const questionChance = Math.min(mazeConfig.questionChance + scale * 0.25, 0.5);
  const r = Math.random();
  if (r < enemyChance) return "enemy";
  if (r < enemyChance + questionChance) return "question";
  return "empty";
}

function generateMazeEnemy(map, position) {
  const baseForce = map.baseForce + Math.floor(Math.random() * 10);
  const scaledForce = baseForce + Math.floor(position * 0.5);
  const guardians = ["dragão", "golem", "lobo", "necromante"];
  const decks = ["deckFogo", "deckÁgua", "deckTerra", "deckSombra"];
  const chosenDeck = decks[Math.floor(Math.random() * decks.length)];
  
  return {
    id: `mazeEnemy_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    type: "mazeEnemy",
    hp: scaledForce * 10,
    maxHp: scaledForce * 10,
    attack: scaledForce,
    deck: chosenDeck,
    guardian: guardians[Math.floor(Math.random() * guardians.length)],
  };
}

async function handleHouse(user, map, houseType, position) {
  let msg = "";
  let prize = null;
  
  if (houseType === "empty") {
    const gold = Math.floor((200 + Math.random() * 300) * map.rewardScale);
    const xp = Math.floor((50 + Math.random() * 50) * map.rewardScale);
    addGold(user, gold);
    addXP(user, xp);
    msg = `💰 Casa comum: você ganhou **${gold} ouro + ${xp} XP**.`;
    prize = { type: "coin", amount: gold, xp };
  } else if (houseType === "question") {
    const r = Math.random();
    if (r < 0.5) {
      const gold = Math.floor((400 + Math.random() * 600) * map.rewardScale);
      addGold(user, gold);
      msg = `🎁 Casa “?”! Você encontrou **${gold} ouro**!`;
      prize = { type: "coin", amount: gold };
    } else if (r < 0.8) {
      const cards = summonMultiple(user, "mazeCard", 2 + Math.floor(Math.random() * 3));
      msg = `🎴 Casa “?”! Você ganhou cartas:\n${cards}`;
      prize = { type: "cards" };
    } else {
      const enemy = generateMazeEnemy(map, position);
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
    const enemy = generateMazeEnemy(map, position);
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

// ---------------------------
// Funções principais
// ---------------------------
export async function rollMaze(user, mapId) {
  const map = mazeConfig.maps[mapId];
  if (!map?.unlocked) throw new Error("Mapa não desbloqueado.");
  
  const mazeState = initMazeState(user, mapId);
  resetDaily(mazeState);
  
  if (mazeState.usedToday >= 2) throw new Error("Você já usou as 2 tentativas diárias.");
  if (!spendEnergy(user, ENERGY_TYPES.ADVENTURE, mazeConfig.energyCost))
    throw new Error("Energia insuficiente.");
  
  const roll = Math.floor(Math.random() * 6) + 1;
  mazeState.position = Math.min(mazeState.position + roll, map.maxHouses);
  
  const houseType = getHouseType(map, mazeState.position);
  const houseResult = await handleHouse(user, map, houseType, mazeState.position);
  
  if (houseResult.rollback) mazeState.position = Math.max(mazeState.position - houseResult.rollback, 0);
  
  mazeState.usedToday++;
  
  // Boss final
  if (mazeState.position === map.maxHouses) {
    const boss = {
      id: `mazeBoss_${Date.now()}`,
      type: "mazeBoss",
      hp: map.baseForce * 20 + Math.floor(Math.random() * 100),
      attack: map.baseForce * 5 + Math.floor(Math.random() * 20),
      deck: "deckBoss",
      guardian: "Boss Supremo",
    };
    const battle = await runBattle(user, boss);
    if (!battle.win) {
      mazeState.position = Math.max(mazeState.position - 3, 0);
      houseResult.message += `\n💀 Você perdeu para o Boss final e recuou 3 casas.`;
    } else {
      addGold(user, Math.floor((5000 + Math.random() * 2000) * map.rewardScale));
      addXP(user, Math.floor((600 + Math.random() * 400) * map.rewardScale));
      summonMultiple(user, "mazeBoss", 3 + Math.floor(Math.random() * 2));
      houseResult.message += `\n🏆 Você derrotou o Boss final!`;
    }
  }
  
  markUserDirty(user.id);
  return { message: houseResult.message, prize: houseResult.prize };
}

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
  return Object.entries(mazeConfig.maps).find(([_, v]) => v.unlocked) ? "map1" : null;
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
  const mapId = "map1";
  const state = getMazeState(user, mapId);
  state.position = 0;
  state.usedToday = 0;
  state.resetUsed = false;
  markUserDirty(user.id);
  return `✅ Maze iniciado no mapa **${mapId}**! Use \`!maze roll\` para rolar o dado.`;
}