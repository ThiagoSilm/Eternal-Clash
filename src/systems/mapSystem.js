import fs from "fs";
import path from "path";
import { runBattle } from "./battleSystem.js";
import { addGold, addXP, addItem } from "./economySystem.js";

// -----------------------------
// CONFIGURAÇÃO BASE
export const WORLDS = 17;
export const STAGES_PER_WORLD = 11;
export const ENERGY_PER_BATTLE = 3;
export const DIFFICULTIES = ["Fácil", "Médio", "Difícil"];

// -----------------------------
// MAP PHASES (sequências)
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
// LOAD PHASES.JSON
const PHASES_FILE = path.resolve("./data/phases.json");
export const PHASES = JSON.parse(fs.readFileSync(PHASES_FILE, "utf-8"));

// -----------------------------
// USUÁRIO MAP PROGRESS
export function initUserMapProgress(user) {
  if (!user.mapProgress) {
    user.mapProgress = {
      completed: [],
      discovered: [],
      stars: {},
      openedChests: {},
      buffs: [],
      debuffs: [],
    };
  }
}

export function hasCompleted(user, id) {
  initUserMapProgress(user);
  return user.mapProgress.completed.includes(id);
}

export function markSceneCompleted(user, id, stars = 3) {
  initUserMapProgress(user);
  if (!hasCompleted(user, id)) user.mapProgress.completed.push(id);
  user.mapProgress.stars[id] = stars;
}

function discover(user, id) {
  if (!user.mapProgress.discovered.includes(id)) {
    user.mapProgress.discovered.push(id);
  }
}

// -----------------------------
// DESCUBRIR FASES DISPONÍVEIS
export function discoverNextScenes(user) {
  initUserMapProgress(user);
  for (const phaseId in PHASES) {
    if (hasCompleted(user, phaseId)) continue;
    
    const [world, stage] = phaseId.split("-").map(Number);
    
    if (world === 1 && stage === 1) {
      discover(user, phaseId); // primeira fase desbloqueada automaticamente
      continue;
    }
    
    const prevStageId = stage === 1 ?
      `${world - 1}-${MAP_PHASES[world-2]?.subStages?.slice(-1)[0]}` :
      `${world}-${stage - 1}`;
    
    if (hasCompleted(user, prevStageId)) discover(user, phaseId);
  }
}

export function getNextAvailableScenes(user) {
  discoverNextScenes(user);
  return Object.keys(PHASES).filter(id => !hasCompleted(user, id) && user.mapProgress.discovered.includes(id));
}

// -----------------------------
// ENTRAR EM UMA FASE
export async function enterScene(user, phaseId) {
  initUserMapProgress(user);
  const phaseData = PHASES[phaseId];
  if (!phaseData) return `❌ Fase inválida: ${phaseId}`;
  
  if (!getNextAvailableScenes(user).includes(phaseId)) {
    return `⚠️ Você não pode ir para ${phaseId} ainda.`;
  }
  
  if ((user.energy ?? 0) < ENERGY_PER_BATTLE) {
    return `⚠️ Energia insuficiente para entrar em ${phaseId}.`;
  }
  
  user.energy -= ENERGY_PER_BATTLE;
  
  let stars = 3;
  let victory = true;
  
  for (const enemy of phaseData.enemies) {
    const battleState = battleSystem.initBattle(user, enemy, { mapStage: phaseId });
    const { state, winner } = battleSystem.runBattle(battleState);
    if (winner !== "player") {
      victory = false;
      stars = 0;
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
// RECOMPENSAS
function grantPhaseRewards(user, phaseId) {
  const phaseData = PHASES[phaseId];
  if (!phaseData?.reward) return;
  
  const { gold = 0, gems = 0, card = null, items = [] } = phaseData.reward;
  addGold(user, gold);
  addItem(user, "gem", gems);
  if (card) addItem(user, card, 1); // adiciona carta ao inventário
  
  if (items.length) {
    for (const i of items) addItem(user, i.id, i.amount);
  }
}

// -----------------------------
// ABRIR BAÚS POR ESTRELAS
export function openChest(user, worldId) {
  initUserMapProgress(user);
  if (!user.mapProgress.openedChests[worldId]) user.mapProgress.openedChests[worldId] = 0;
  const opened = user.mapProgress.openedChests[worldId];
  if (opened >= 3) return "⚠️ Todos os baús dessa sequência já foram abertos.";
  
  const totalStars = Object.entries(user.mapProgress.stars)
    .filter(([stage]) => MAP_PHASES.find(p => p.id === worldId)?.subStages.includes(stage))
    .reduce((acc, [_, s]) => acc + s, 0);
  
  const requiredStars = (opened + 1) * 3;
  if (totalStars < requiredStars) return `⚠️ Precisa de ${requiredStars} estrelas para abrir este baú.`;
  
  user.mapProgress.openedChests[worldId]++;
  const gold = 50 * (opened + 1);
  const gem = 1 * (opened + 1);
  
  addGold(user, gold);
  addItem(user, "gem", gem);
  
  return `🎁 Baú aberto! Você recebeu: ${gold} ouro, ${gem} gemas`;
}

// -----------------------------
// VISUALIZADOR DE MAPA
export function visualizeMap(user) {
  initUserMapProgress(user);
  discoverNextScenes(user);
  
  let text = `🌍 **MAPA — Exploração**\n`;
  for (const world of MAP_PHASES) {
    text += `\n**🌐 World ${world.id}**\n`;
    for (const stage of world.subStages) {
      let icon = "⬛";
      if (!user.mapProgress.discovered.includes(stage)) icon = "❔";
      else if (hasCompleted(user, stage)) icon = "✅";
      else if (getNextAvailableScenes(user).includes(stage)) icon = "🎯";
      else icon = "⬜";
      text += `${icon} `;
    }
  }
  
  return text + `\n\nLegenda: 🎯 Disponível | ✅ Completo | ❔ Não descoberto | ⬜ Não disponível`;
}