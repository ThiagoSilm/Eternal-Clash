// src/systems/mapSystem.js
import fs from "fs";
import path from "path";
import { spendEnergy, ENERGY_TYPES } from "./economySystem.js";
import { battleSystem } from "./battleSystem.js";
import { CardController } from "./CardController.js";
import { addGold, addXP, addItem } from "./economySystem.js";
import { markUserDirty } from "./userCacheSystem.js";

// -----------------------------
// CONFIGURAÇÃO BASE
export const WORLDS = 17;
export const STAGES_PER_WORLD = 11;
export const ENERGY_PER_BATTLE = 3;
export const DIFFICULTIES = ["Fácil", "Médio", "Difícil"];

// -----------------------------
// MAP PHASES (sequências) - estrutura de referência
export const MAP_PHASES = [
  { id: 1, subStages: ["1-1", "1-2", "1-3", "1-4", "1-5", "1-6"] },
  { id: 2, subStages: ["3-1", "3-2", "3-3", "3-4", "3-5", "3-6"] },
  { id: 3, subStages: ["4-1", "4-2", "4-3", "4-4", "4-5", "4-6", "4-7", "4-8", "4-9"] },
  { id: 4, subStages: ["5-1", "5-2", "5-3", "5-4", "5-5", "5-6", "5-7", "5-8", "5-9"] },
  { id: 5, subStages: ["6-1", "6-2", "6-3", "6-4", "6-5", "6-6", "6-7", "6-8", "6-9"] },
  { id: 6, subStages: ["7-1", "7-2", "7-3", "7-4", "7-5", "7-6", "7-7", "7-8", "7-9"] },
  { id: 7, subStages: ["8-1", "8-2", "8-3", "8-4", "8-5", "8-6", "8-7", "8-8", "8-9"] },
  { id: 8, subStages: ["9-1", "9-2", "9-3", "9-4", "9-5", "9-6", "9-7", "9-8", "9-9"] },
  { id: 9, subStages: ["10-1", "10-2", "10-3", "10-4", "10-5", "10-6", "10-7", "10-8", "10-9", "10-10", "10-11"] },
  { id: 10, subStages: ["11-1", "11-2", "11-3", "11-4", "11-5", "11-6", "11-7", "11-8", "11-9", "11-10", "11-11"] },
  { id: 11, subStages: ["12-1", "12-2", "12-3", "12-4", "12-5", "12-6", "12-7", "12-8", "12-9", "12-10", "12-11"] },
  { id: 12, subStages: ["13-1", "13-2", "13-3", "13-4", "13-5", "13-6", "13-7", "13-8", "13-9", "13-10", "13-11"] },
  { id: 13, subStages: ["14-1", "14-2", "14-3", "14-4", "14-5", "14-6", "14-7", "14-8", "14-9", "14-10", "14-11"] },
  { id: 14, subStages: ["15-1", "15-2", "15-3", "15-4", "15-5", "15-6", "15-7", "15-8", "15-9", "15-10", "15-11"] },
  { id: 15, subStages: ["16-1", "16-2", "16-3", "16-4", "16-5", "16-6", "16-7", "16-8", "16-9", "16-10", "16-11"] },
  { id: 16, subStages: ["17-1", "17-2", "17-3", "17-4", "17-5", "17-6", "17-7", "17-8", "17-9", "17-10", "17-11"] },
];

// -----------------------------
// PHASES FILE (padrão: ./data/phases.json)
const PHASES_FILE = path.resolve("./data/phases.json");
let PHASES = {};
try {
  if (fs.existsSync(PHASES_FILE)) {
    PHASES = JSON.parse(fs.readFileSync(PHASES_FILE, "utf-8") || "{}");
  } else {
    console.warn("[mapSystem] phases.json não encontrado — carregando vazio.");
    PHASES = {};
  }
} catch (e) {
  console.error("[mapSystem] erro lendo phases.json:", e);
  PHASES = {};
}

// -----------------------------
// UTIL: garante estrutura de progresso do usuário
export function initUserMapProgress(user) {
  if (!user) throw new Error("Usuário inválido.");
  if (!user.mapProgress || typeof user.mapProgress !== "object") {
    user.mapProgress = {
      completed: [], // lista de phaseId (ex: "1-1")
      discovered: [], // descobertos (possuem unlock visual)
      stars: {}, // stars por phaseId
      openedChests: {}, // contagem por worldId
      buffs: [], // buffs temporários
      debuffs: [], // debuffs temporários
    };
    markUserDirty(user.id);
  }
}

// -----------------------------
// VERIFICAÇÕES SIMPLES
export function hasCompleted(user, id) {
  initUserMapProgress(user);
  return Array.isArray(user.mapProgress.completed) && user.mapProgress.completed.includes(id);
}

export function markSceneCompleted(user, id, stars = 3) {
  initUserMapProgress(user);
  if (!hasCompleted(user, id)) user.mapProgress.completed.push(id);
  user.mapProgress.stars[id] = Math.max(0, Math.min(3, Number(stars) || 0));
  markUserDirty(user.id);
}

// -----------------------------
// DISCOVER / NEXT SCENES
function discover(user, id) {
  initUserMapProgress(user);
  if (!user.mapProgress.discovered.includes(id)) user.mapProgress.discovered.push(id);
  markUserDirty(user.id);
}

export function discoverNextScenes(user) {
  initUserMapProgress(user);
  
  // marca a primeira fase do jogo como descoberta se nada existir
  if (!user.mapProgress.discovered.length) {
    const first = Object.keys(PHASES)[0];
    if (first) discover(user, first);
  }
  
  for (const phaseId of Object.keys(PHASES)) {
    if (hasCompleted(user, phaseId)) continue;
    
    const [world, stage] = phaseId.split("-").map(n => Number(n));
    if (!world || !stage) continue;
    
    // regra simples: a fase 1-1 fica disponível sempre
    if (world === 1 && stage === 1) {
      discover(user, phaseId);
      continue;
    }
    
    // determina id da fase anterior
    const prevStageId = (() => {
      if (stage === 1) {
        // pega último subStage do world-1 se existir
        const prevWorld = world - 1;
        const prevMap = MAP_PHASES.find(p => p.id === prevWorld);
        if (!prevMap) return null;
        const last = prevMap.subStages[prevMap.subStages.length - 1];
        return last;
      }
      return `${world}-${stage - 1}`;
    })();
    
    if (prevStageId && hasCompleted(user, prevStageId)) discover(user, phaseId);
  }
}

export function getNextAvailableScenes(user) {
  discoverNextScenes(user);
  return Object.keys(PHASES).filter(id => !hasCompleted(user, id) && user.mapProgress.discovered.includes(id));
}

// -----------------------------
// ENTER SCENE - lógica principal
export async function enterScene(user, phaseId, difficulty = "Fácil") {
  initUserMapProgress(user);
  
  if (!PHASES[phaseId]) return `❌ Fase inválida: ${phaseId}`;
  if (!DIFFICULTIES.includes(difficulty)) return `❌ Dificuldade inválida. Use: ${DIFFICULTIES.join(", ")}`;
  
  // só permite entrar em fases desbloqueadas
  const next = getNextAvailableScenes(user);
  if (!next.includes(phaseId)) return `⚠️ Você não pode ir para ${phaseId} ainda.`;
  
  // consome energia por tentativa
  if (!spendEnergy(user, ENERGY_TYPES.ADVENTURE, ENERGY_PER_BATTLE)) {
    return `⚠️ Energia insuficiente (custa ${ENERGY_PER_BATTLE}).`;
  }
  
  const phaseData = PHASES[phaseId];
  if (!phaseData || !Array.isArray(phaseData.enemies)) return `⚠️ Fase ${phaseId} sem dados de inimigos.`;
  
  // stars começam como 3, vão caindo se perde batalhas
  let stars = 3;
  let victory = true;
  
  // loop de inimigos sequenciais
  for (let i = 0; i < phaseData.enemies.length; i++) {
    const rawEnemy = phaseData.enemies[i];
    
    // permite que PHASES defina variantes por dificuldade
    const enemy = (() => {
      if (rawEnemy.variants && rawEnemy.variants[difficulty]) return rawEnemy.variants[difficulty];
      return rawEnemy.base || rawEnemy;
    })();
    
    // integra CardController no initBattle
    const init = battleSystem.initBattle(user, enemy, { mapStage: phaseId, index: i, difficulty }, CardController);
    const res = battleSystem.runBattle(init);
    
    // formato de retorno suportado: { state, winner } ou { winner }
    const winner = res?.winner ?? (res?.state?.winner ?? null);
    if (winner !== "player") {
      victory = false;
      stars = Math.max(0, 3 - (i + 1)); // penaliza por derrota
      break;
    }
  }
  
  if (victory) {
    markSceneCompleted(user, phaseId, stars);
    grantPhaseRewards(user, phaseId);
    return `🏆 Vitória em ${phaseId}! Estrelas: ${stars}`;
  }
  
  return `💀 Você perdeu em ${phaseId}.`;
}

// -----------------------------
// RECOMPENSAS - leve e configurável por phase
export function grantPhaseRewards(user, phaseId) {
  const phaseData = PHASES[phaseId];
  if (!phaseData?.reward) return;
  
  const { gold = 0, gems = 0, card = null, items = [] } = phaseData.reward;
  
  if (gold) addGold(user, gold);
  if (gems) addItem(user, "gem", gems);
  if (card) addItem(user, card, 1);
  
  if (Array.isArray(items) && items.length) {
    for (const it of items) {
      if (!it || !it.id) continue;
      addItem(user, it.id, it.amount || 1);
    }
  }
  
  markUserDirty(user.id);
}

// -----------------------------
// OPEN CHEST - por worldId (1..WORLDS)
export function openChest(user, worldId) {
  initUserMapProgress(user);
  const world = Number(worldId);
  if (!Number.isInteger(world) || world < 1 || world > WORLDS) return "World inválido.";
  
  user.mapProgress.openedChests[world] = user.mapProgress.openedChests[world] || 0;
  const opened = user.mapProgress.openedChests[world];
  if (opened >= 3) return "⚠️ Todos os baús dessa sequência já foram abertos.";
  
  // conta estrelas das fases desse world (usa MAP_PHASES)
  const phaseMeta = MAP_PHASES.find(p => p.id === world);
  if (!phaseMeta) return "World sem fases configuradas.";
  
  const totalStars = Object.entries(user.mapProgress.stars)
    .filter(([stage]) => phaseMeta.subStages.includes(stage))
    .reduce((acc, [_, s]) => acc + (Number(s) || 0), 0);
  
  const required = (opened + 1) * 3;
  if (totalStars < required) return `⚠️ Precisa de ${required} estrelas para abrir este baú.`;
  
  user.mapProgress.openedChests[world]++;
  const gold = 50 * (opened + 1);
  const gem = 1 * (opened + 1);
  
  addGold(user, gold);
  addItem(user, "gem", gem);
  markUserDirty(user.id);
  
  return `🎁 Baú aberto! Você recebeu: ${gold} ouro, ${gem} gemas.`;
}

// -----------------------------
// VISUALIZAÇÃO DO MAPA
export function visualizeMap(user) {
  initUserMapProgress(user);
  discoverNextScenes(user);
  
  let text = `🌍 MAPA — Exploração\n`;
  for (const world of MAP_PHASES) {
    text += `\n🌐 World ${world.id}: `;
    for (const stage of world.subStages) {
      let icon = "⬛"; // sem dado
      if (!user.mapProgress.discovered.includes(stage)) icon = "❔";
      else if (hasCompleted(user, stage)) icon = "✅";
      else if (getNextAvailableScenes(user).includes(stage)) icon = "🎯";
      else icon = "⬜";
      text += `${icon} `;
    }
  }
  text += `\n\nLegenda: 🎯 Disponível | ✅ Completo | ❔ Não descoberto | ⬜ Não disponível`;
  return text;
}

// -----------------------------
// HELPERS EXPOSITOS
export function getNextAvailableScenesForUser(user) { return getNextAvailableScenes(user); }
export function getPhaseInfo(phaseId) { return PHASES[phaseId] || null; }