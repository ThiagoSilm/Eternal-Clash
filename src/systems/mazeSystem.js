import { spendEnergy, addGold, addXP, ENERGY_TYPES, spendGems } from "./economySystem.js";
import { summonMultiple } from "./summonSystem.js";
import { runBattle } from "./battleSystem.js";
import { markUserDirty } from "./userCacheSystem.js";

/* --------------------------
   CONFIGURAÇÕES GLOBAIS
   -------------------------- */
const MAZE_CONFIG = Object.freeze({
  ENERGY_COST: 4,
  GOLD_DICE_GEM_COST: 20,
  DAILY_LIMIT: 2,
  DAILY_RESET_MS: 86400000, // 24 horas
  MAPS: {
    map1: { id: "map1", maxHouses: 40, baseForce: 10, unlocked: true, rewardScale: 1 },
    map2: { id: "map2", maxHouses: 60, baseForce: 20, unlocked: false, rewardScale: 1.3 },
    map3: { id: "map3", maxHouses: 80, baseForce: 30, unlocked: false, rewardScale: 1.6 },
  }
});

/* --------------------------
   UTILITÁRIOS SEGUROS (SAFE UTILS)
   -------------------------- */
const UTILS = Object.freeze({
  now: () => Date.now(),
  rand: () => Math.random(),
  clamp: (v, min, max) => Math.min(Math.max(v, min), max),
  assertUser: (u) => { if (!u || typeof u !== "object") throw new Error("User inválido."); },
  assertMap: (m) => { if (!m) throw new Error("Mapa inválido."); }
});

/* --------------------------
   GERENCIAMENTO DE ESTADO
   -------------------------- */

/**
 * Verifica se um reset diário é necessário e aplica-o.
 * @param {object} state O estado do labirinto específico (user.mazes[mapId]).
 * @returns {boolean} True se um reset ocorreu.
 */
function checkDailyReset(state) {
  if (UTILS.now() - state.lastDailyReset >= MAZE_CONFIG.DAILY_RESET_MS) {
    state.usedToday = 0;
    state.resetUsed = false;
    state.lastDailyReset = UTILS.now();
    return true;
  }
  return false;
}

/**
 * Obtém o estado do labirinto para um mapa e garante que o estado diário esteja atualizado.
 * @param {object} user Objeto do usuário.
 * @param {string} mapId ID do mapa.
 * @returns {object} O estado do labirinto mutável.
 */
function getMazeState(user, mapId) {
  UTILS.assertUser(user);
  user.mazes = user.mazes || {};
  
  if (!user.mazes[mapId]) {
    user.mazes[mapId] = {
      position: 0,
      usedToday: 0,
      resetUsed: false,
      lastDailyReset: UTILS.now(),
    };
  }
  
  // Garante que o estado é validado/resetado e marca o usuário se houver mudança
  if (checkDailyReset(user.mazes[mapId])) {
     markUserDirty(user.id);
  }
  
  return user.mazes[mapId];
}

/* --------------------------
   VALIDAÇÃO DE ENTRADA
   -------------------------- */

/** Valida se o usuário pode rolar o labirinto. */
function validateMazeEntry(user, state) {
  if (state.usedToday >= MAZE_CONFIG.DAILY_LIMIT) {
    throw new Error(`Limite diário atingido (${MAZE_CONFIG.DAILY_LIMIT}/${MAZE_CONFIG.DAILY_LIMIT}).`);
  }
  
  if (!spendEnergy(user, ENERGY_TYPES.ADVENTURE, MAZE_CONFIG.ENERGY_COST)) {
    throw new Error(`Energia insuficiente. Custo: ${MAZE_CONFIG.ENERGY_COST} de Aventura.`);
  }
}

/* --------------------------
   CORE: ROLAGEM DO LABIRINTO
   -------------------------- */

export async function rollMaze(user, mapId) {
  UTILS.assertUser(user);
  const map = MAZE_CONFIG.MAPS[mapId];
  UTILS.assertMap(map);
  if (!map.unlocked) throw new Error("Mapa bloqueado.");

  const state = getMazeState(user, mapId);
  validateMazeEntry(user, state); 

  // 1. Ação: Mover
  const dice = 1 + Math.floor(UTILS.rand() * 6);
  state.position = UTILS.clamp(state.position + dice, 0, map.maxHouses);
  state.usedToday++;

  // 2. Ação: Resolver Tile (pode ser Boss ou Tile normal)
  let result;
  
  if (state.position === map.maxHouses) {
    // 3. Ação: Checagem do Boss Final
    result = await handleBossEncounter(user, map, state);
  } else {
    // 3. Ação: Resolução do Tile Normal
    result = await resolveTile(user, map, state.position);
  }
  
  // 4. Ação: Aplicar Rollback (se houver, ex: derrota ou armadilha)
  if (result.rollback && result.rollback > 0) {
    state.position = UTILS.clamp(state.position - result.rollback, 0, map.maxHouses);
  }

  markUserDirty(user.id);
  return { 
    ...result, 
    dice,
    newPosition: state.position,
    maxHouses: map.maxHouses
  };
}

/* --------------------------
   LÓGICA DE RESOLUÇÃO DE TILE
   -------------------------- */

/** Mapeamento de chances de Tile baseado no progresso. */
const TILE_PROBABILITIES = (progress) => {
  const baseEnemy = 0.1;
  const baseQuest = 0.2;
  const progressBonus = progress * 0.25;

  const enemyChance = UTILS.clamp(baseEnemy + progressBonus, 0.1, 0.5);
  const questChance = UTILS.clamp(baseQuest + progressBonus, 0.2, 0.5);
  
  return { enemy: enemyChance, question: questChance };
};


async function resolveTile(user, map, position) {
  const progress = position / map.maxHouses;
  const chances = TILE_PROBABILITIES(progress);
  
  const roll = UTILS.rand();

  if (roll < chances.enemy) {
    return processEnemyTile(user, map, position);
  }
  
  if (roll < chances.enemy + chances.question) {
    return processQuestionTile(user, map, position);
  }
  
  return processEmptyTile(user, map);
}

// --- Processadores de Tile ---

function processEmptyTile(user, map) {
  const gold = Math.floor((200 + UTILS.rand() * 300) * map.rewardScale);
  const xp = Math.floor((50 + UTILS.rand() * 50) * map.rewardScale);
  
  addGold(user, gold);
  addXP(user, xp);
  
  return { 
    message: `💰 Casa Comum: Ganhou **${gold} ouro** e **${xp} XP**.`, 
    prize: { type: "coin", gold, xp }, 
    rollback: 0 
  };
}

async function processQuestionTile(user, map, position) {
  const roll = UTILS.rand();
  
  if (roll < 0.5) { // 50% Ouro
    const gold = Math.floor((400 + UTILS.rand() * 600) * map.rewardScale);
    addGold(user, gold);
    return { message: `🎁 Casa [?]: Encontrou **${gold} ouro**!`, rollback: 0 };
  }
  
  if (roll < 0.8) { // 30% Cartas (2-4 cartas)
    const cardCount = 2 + Math.floor(UTILS.rand() * 3);
    const cards = summonMultiple(user, "gems", cardCount); // Assumindo 'gems' ou uma moeda de Labirinto
    return { message: `🎴 Casa [?]: Cartas encontradas!\n${cards}`, rollback: 0 };
  }
  
  // 20% Armadilha (Inimigo)
  const result = await processEnemyTile(user, map, position);
  return { 
    ...result, 
    message: `🪤 Casa [?]: Armadilha! ${result.message}` 
  };
}

async function processEnemyTile(user, map, position) {
  const enemy = createEnemy(map, position, false);
  const battle = await runBattle(user, enemy);
  
  if (!battle.win) {
    return { message: `💀 Derrota! Você recuou 2 casas.`, rollback: 2 };
  }
  return { message: `⚔️ Vitória! O caminho está seguro.`, rollback: 0 };
}

/* --------------------------
   LÓGICA DE INIMIGOS E BOSS
   -------------------------- */

function createEnemy(map, position, isBoss) {
  const base = map.baseForce + Math.floor(UTILS.rand() * 10);
  const powerScale = isBoss ? 5 : 0.5;
  const power = base + Math.floor(position * powerScale);
  
  const stats = {
    hpMultiplier: isBoss ? 20 : 10,
    attackMultiplier: isBoss ? 5 : 1,
  };

  return {
    id: `maze_${isBoss ? 'boss' : 'mob'}_${UTILS.now()}`,
    type: isBoss ? "mazeBoss" : "mazeEnemy",
    hp: power * stats.hpMultiplier,
    maxHp: power * stats.hpMultiplier,
    attack: power * stats.attackMultiplier,
    deck: "deck_random",
    guardian: isBoss ? "Boss Supremo" : "Monstro do Labirinto"
  };
}

async function handleBossEncounter(user, map, state) {
  const boss = createEnemy(map, state.position, true);
  const battle = await runBattle(user, boss);
  
  if (!battle.win) {
    // Recua o jogador, mas sem retroceder além do início
    const newPosition = UTILS.clamp(state.position - 3, 0, map.maxHouses);
    state.position = newPosition; 
    
    return { 
      message: `BOSS: Derrota! Recuou 3 casas. Posição atual: ${newPosition}/${map.maxHouses}`, 
      rollback: 0 // Rollback já aplicado manualmente
    };
  }
  
  // Vitória
  const gold = Math.floor((5000 + UTILS.rand() * 2000) * map.rewardScale);
  addGold(user, gold);
  // Invocações de recompensa de boss (3 cartas de Boss)
  const summonMsg = summonMultiple(user, "gems", 3); 
  
  // O labirinto se reseta após a vitória do boss para poder ser rolado novamente.
  state.usedToday = MAZE_CONFIG.DAILY_LIMIT; // Bloqueia a entrada até o reset diário
  state.position = 0; // Move para o início
  
  return { 
    message: `🏆 BOSS: VITÓRIA! Recompensas lendárias (${gold} ouro + Cartas) recebidas! ${summonMsg}`, 
    rollback: 0, 
    bossDefeated: true
  };
}

/* --------------------------
   GOLD DICE E UTILITÁRIOS
   -------------------------- */

export function useGoldDice(user, mapId, target) {
  UTILS.assertUser(user);
  const map = MAZE_CONFIG.MAPS[mapId];
  UTILS.assertMap(map);
  const state = getMazeState(user, mapId);

  const cost = MAZE_CONFIG.GOLD_DICE_GEM_COST;
  if (!spendGems(user, cost)) {
    throw new Error(`Gemas insuficientes. Custo: ${cost} Gemas.`);
  }
  
  const finalTarget = UTILS.clamp(target, state.position + 1, map.maxHouses);

  if (finalTarget <= state.position) throw new Error("O Gold Dice deve avançar para uma casa superior à atual.");

  state.position = finalTarget;
  markUserDirty(user.id);
  return { 
    message: `🎲 Gold Dice: Teleportado para a casa **${state.position}** (Custo: ${cost} Gemas).`,
    newPosition: state.position 
  };
}

export function resetMaze(user, mapId) {
  UTILS.assertUser(user);
  const state = getMazeState(user, mapId);
  
  if (state.resetUsed) throw new Error("Reset diário já utilizado. Retorne amanhã!");
  
  state.position = 0;
  state.usedToday = 0;
  state.resetUsed = true;
  markUserDirty(user.id);
  return "🔄 Labirinto resetado com sucesso! Você pode tentar novamente.";
}

// Exports de Leitura
export function getMazeMapInfo(user, mapId) {
  const map = MAZE_CONFIG.MAPS[mapId];
  if (!map) return null;
  const state = getMazeState(user, mapId);
  return {
    totalHouses: map.maxHouses,
    currentHouse: state.position,
    usedToday: state.usedToday,
    limit: MAZE_CONFIG.DAILY_LIMIT,
    isResetAvailable: !state.resetUsed
  };
}

export const getCurrentMapId = () => "map1"; // Simplesmente retorna o mapa padrão
export const startMaze = (user, mapId = "map1") => { 
  getMazeState(user, mapId); 
  return `Labirinto ${mapId} iniciado/carregado.`; 
};