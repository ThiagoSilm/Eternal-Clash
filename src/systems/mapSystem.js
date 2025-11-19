import fs from "fs";
import path from "path";
import { spendEnergy, ENERGY_TYPES, addGold, addItem } from "./economySystem.js";
import { battleSystem } from "./battleSystem.js";
import { CardController } from "../controllers/CardController.js";
import { markUserDirty } from "./userCacheSystem.js";

/* --------------------------
   CONFIGURAÇÃO & CONSTANTES
   -------------------------- */
export const MAP_CONFIG = Object.freeze({
  worlds: 17,
  energyCost: 3,
  difficulties: ["Fácil", "Médio", "Difícil"],
  phasesFile: path.resolve("./data/phases.json")
});

const SAFE = Object.freeze({
  assertUser: (u) => { if (!u) throw new Error("Utilizador inválido"); },
  loadJSON: (p) => {
    try {
      return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf-8")) : {};
    } catch (e) { console.error("Erro ao carregar mapa:", e); return {}; }
  }
});

// Carregamento de dados estáticos
const PHASES = SAFE.loadJSON(MAP_CONFIG.phasesFile);

// Dados estáticos de estrutura (simplificado para manter o clean code)
export const MAP_PHASES = [
  { id: 1, subStages: ["1-1", "1-2", "1-3", "1-4", "1-5", "1-6"] },
  { id: 2, subStages: ["3-1", "3-2", "3-3", "3-4", "3-5", "3-6"] },
  { id: 3, subStages: ["4-1", "4-2", "4-3", "4-4", "4-5", "4-6", "4-7", "4-8", "4-9"] },
  // ... adicione os restantes mundos conforme necessário
];

/* --------------------------
   GESTÃO DE ESTADO
   -------------------------- */

export function initUserMapProgress(user) {
  SAFE.assertUser(user);
  if (!user.mapProgress) {
    user.mapProgress = {
      completed: [],
      discovered: [],
      stars: {},
      openedChests: {},
      buffs: [],
      debuffs: []
    };
    markUserDirty(user.id);
  }
  return user.mapProgress;
}

export function hasCompleted(user, phaseId) {
  const prog = initUserMapProgress(user);
  return prog.completed.includes(phaseId);
}

function markSceneCompleted(user, id, stars) {
  const prog = initUserMapProgress(user);
  if (!prog.completed.includes(id)) prog.completed.push(id);
  
  const currentStars = prog.stars[id] || 0;
  prog.stars[id] = Math.max(currentStars, Math.min(3, Number(stars) || 0));
  markUserDirty(user.id);
}

/* --------------------------
   LÓGICA DE DESCOBERTA
   -------------------------- */

export function discoverNextScenes(user) {
  const prog = initUserMapProgress(user);
  
  // Inicialização: Garante que o 1-1 está visível
  if (!prog.discovered.length) {
    const first = Object.keys(PHASES)[0] || "1-1";
    if (!prog.discovered.includes(first)) prog.discovered.push(first);
  }

  for (const phaseId of Object.keys(PHASES)) {
    checkAndUnlockPhase(user, phaseId);
  }
}

function checkAndUnlockPhase(user, phaseId) {
  const prog = user.mapProgress;
  if (prog.completed.includes(phaseId) || prog.discovered.includes(phaseId)) return;

  if (phaseId === "1-1") {
    prog.discovered.push(phaseId);
    return;
  }

  const prevId = getPreviousStageId(phaseId);
  if (prevId && prog.completed.includes(prevId)) {
    prog.discovered.push(phaseId);
    markUserDirty(user.id);
  }
}

function getPreviousStageId(currentId) {
  const [w, s] = currentId.split("-").map(Number);
  if (s > 1) return `${w}-${s - 1}`;
  
  // Se for a primeira fase do mundo, procura a última do mundo anterior
  const prevWorld = MAP_PHASES.find(p => p.id === w - 1);
  if (prevWorld?.subStages?.length) {
    return prevWorld.subStages[prevWorld.subStages.length - 1];
  }
  return null;
}

export function getNextAvailableScenes(user) {
  discoverNextScenes(user);
  const prog = user.mapProgress;
  return Object.keys(PHASES).filter(id => 
    prog.discovered.includes(id) && !prog.completed.includes(id)
  );
}

/* --------------------------
   ENTRAR NA CENA (CORE)
   -------------------------- */

export async function enterScene(user, phaseId, difficulty = "Fácil") {
  try {
    const phaseData = validateEntry(user, phaseId, difficulty);
    
    if (!spendEnergy(user, ENERGY_TYPES.ADVENTURE, MAP_CONFIG.energyCost)) {
      return `⚠️ Energia insuficiente (${MAP_CONFIG.energyCost}).`;
    }

    const result = await runStageBattles(user, phaseData, difficulty, phaseId);
    
    if (result.victory) {
      finalizeVictory(user, phaseId, result.stars);
      return `🏆 Vitória em ${phaseId}! Estrelas: ${result.stars}`;
    }
    return `💀 Derrota em ${phaseId}.`;
  } catch (e) {
    return `Erro: ${e.message}`;
  }
}

function validateEntry(user, phaseId, difficulty) {
  initUserMapProgress(user);
  if (!PHASES[phaseId]) throw new Error(`Fase ${phaseId} inexistente.`);
  if (!MAP_CONFIG.difficulties.includes(difficulty)) throw new Error("Dificuldade inválida.");
  
  const available = getNextAvailableScenes(user);
  const completed = hasCompleted(user, phaseId);
  
  if (!completed && !available.includes(phaseId)) {
    throw new Error("Fase bloqueada.");
  }
  return PHASES[phaseId];
}

async function runStageBattles(user, phaseData, difficulty, phaseId) {
  const enemies = phaseData.enemies || [];
  let stars = 3;

  for (let i = 0; i < enemies.length; i++) {
    const enemyDef = resolveEnemyVariant(enemies[i], difficulty);
    const opts = { mapStage: phaseId, index: i, difficulty };
    
    const init = battleSystem.initBattle(user, enemyDef, opts, CardController);
    const res = await battleSystem.runBattle(init);
    
    const winner = res?.winner ?? res?.state?.winner;
    if (winner !== "player") return { victory: false, stars: 0 };
  }
  
  return { victory: true, stars };
}

function resolveEnemyVariant(rawEnemy, difficulty) {
  if (rawEnemy.variants && rawEnemy.variants[difficulty]) {
    return rawEnemy.variants[difficulty];
  }
  return rawEnemy.base || rawEnemy;
}

function finalizeVictory(user, phaseId, stars) {
  markSceneCompleted(user, phaseId, stars);
  grantPhaseRewards(user, PHASES[phaseId]);
}

/* --------------------------
   RECOMPENSAS E BAÚS
   -------------------------- */

function grantPhaseRewards(user, phaseData) {
  if (!phaseData?.reward) return;
  const { gold, gems, card, items } = phaseData.reward;

  if (gold) addGold(user, gold);
  if (gems) addItem(user, "gem", gems);
  if (card) addItem(user, card, 1);
  if (Array.isArray(items)) {
    items.forEach(it => it.id && addItem(user, it.id, it.amount || 1));
  }
  markUserDirty(user.id);
}

export function openChest(user, worldId) {
  initUserMapProgress(user);
  const world = Number(worldId);
  if (!world || world < 1 || world > MAP_CONFIG.worlds) return "Mundo inválido.";

  const prog = user.mapProgress;
  prog.openedChests[world] = prog.openedChests[world] || 0;
  
  if (prog.openedChests[world] >= 3) return "⚠️ Todos os baús já foram abertos.";

  const neededStars = (prog.openedChests[world] + 1) * 3;
  const currentStars = calculateWorldStars(user, world);

  if (currentStars < neededStars) {
    return `⚠️ Requer ${neededStars} estrelas (Possui: ${currentStars}).`;
  }

  prog.openedChests[world]++;
  const multiplier = prog.openedChests[world];
  addGold(user, 50 * multiplier);
  addItem(user, "gem", 1 * multiplier);
  
  markUserDirty(user.id);
  return `🎁 Baú Nv.${multiplier} aberto!`;
}

function calculateWorldStars(user, worldId) {
  const worldMeta = MAP_PHASES.find(p => p.id === worldId);
  if (!worldMeta) return 0;
  
  return worldMeta.subStages.reduce((acc, stageId) => {
    return acc + (user.mapProgress.stars[stageId] || 0);
  }, 0);
}

/* --------------------------
   VISUALIZAÇÃO E EXPORTS
   -------------------------- */

export function visualizeMap(user) {
  initUserMapProgress(user);
  discoverNextScenes(user);
  
  const lines = ["🌍 MAPA — Exploração"];
  for (const world of MAP_PHASES) {
    const icons = world.subStages.map(stage => getStageIcon(user, stage));
    lines.push(`🌐 W${world.id}: ${icons.join(" ")}`);
  }
  
  lines.push("\nLegenda: 🎯 Disp | ✅ Fim | ❔ Bloq");
  return lines.join("\n");
}

function getStageIcon(user, stageId) {
  const prog = user.mapProgress;
  if (prog.completed.includes(stageId)) return "✅";
  if (prog.discovered.includes(stageId)) return "🎯";
  return "❔";
}

export const getNextAvailableScenesForUser = (u) => getNextAvailableScenes(u);
export const getPhaseInfo = (id) => PHASES[id] || null;
