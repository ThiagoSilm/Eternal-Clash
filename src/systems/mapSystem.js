// src/systems/mapSystem.js

import { runBattle } from "./battleSystem.js";

// ----------------------------------------------------
// 🔹 CONFIGURAÇÃO DO MAPA
// ----------------------------------------------------
const WORLDS = 17;
const STAGES_PER_WORLD = 11;

// Cria o mapa base (17x11)
export const mapScenes = (() => {
  const scenes = [];
  for (let w = 1; w <= WORLDS; w++) {
    for (let s = 1; s <= STAGES_PER_WORLD; s++) {
      let type = "normal";
      if (s === STAGES_PER_WORLD) type = "boss"; // último stage é chefe
      else if (Math.random() < 0.1) type = "event"; // 10% chance de evento
      const difficulty = Math.floor(w * 2 + s); // dificuldade desigual
      scenes.push({ id: `${w}-${s}`, world: w, stage: s, type, difficulty });
    }
  }
  return scenes;
})();

// ----------------------------------------------------
// 🔹 FUNÇÕES DE PROGRESSO DO JOGADOR
// ----------------------------------------------------
export function initUserMapProgress(user) {
  if (!user.mapProgress) user.mapProgress = { completed: [] };
}

export function hasCompleted(user, sceneId) {
  initUserMapProgress(user);
  return user.mapProgress.completed.includes(sceneId);
}

export function markSceneCompleted(user, sceneId) {
  initUserMapProgress(user);
  if (!user.mapProgress.completed.includes(sceneId)) {
    user.mapProgress.completed.push(sceneId);
  }
}

// ----------------------------------------------------
// 🔹 OBTEM PRÓXIMAS CENAS DISPONÍVEIS
// ----------------------------------------------------
export function getNextAvailableScenes(user) {
  initUserMapProgress(user);
  
  const available = [];
  for (const scene of mapScenes) {
    const prevStage = scene.stage - 1 > 0 ? `${scene.world}-${scene.stage - 1}` : null;
    const prevWorld = scene.stage === 1 && scene.world > 1 ? `${scene.world - 1}-${STAGES_PER_WORLD}` : null;
    
    if (hasCompleted(user, scene.id)) continue;
    if ((prevStage && !hasCompleted(user, prevStage)) || (prevWorld && !hasCompleted(user, prevWorld))) continue;
    
    available.push(scene);
  }
  
  return available;
}

// ----------------------------------------------------
// 🔹 ENTRA EM UMA CENA
// ----------------------------------------------------
export async function enterScene(user, sceneId) {
  const scene = mapScenes.find(s => s.id === sceneId);
  if (!scene) return `❌ Cena inválida.`;
  
  // Só permite avançar
  const nextScenes = getNextAvailableScenes(user);
  if (!nextScenes.find(s => s.id === sceneId)) return `⚠️ Você ainda não pode acessar essa cena. Complete as anteriores primeiro.`;
  
  // Roda a batalha
  const result = await runBattle(user, scene);
  
  if (result.victory) {
    markSceneCompleted(user, sceneId);
    return `🏆 Batalha vencida em ${scene.id}! Próximas batalhas desbloqueadas.`;
  } else {
    return `💀 Você perdeu a batalha em ${scene.id}. Tente novamente.`;
  }
}

// ----------------------------------------------------
// 🔹 VISUALIZADOR DE MAPA
// ----------------------------------------------------
export function visualizeMap(user) {
  initUserMapProgress(user);
  
  let output = `🌍 **Mapa do Mundo**\n`;
  
  for (let w = 1; w <= WORLDS; w++) {
    let line = `**W${w}**: `;
    for (let s = 1; s <= STAGES_PER_WORLD; s++) {
      const sceneId = `${w}-${s}`;
      if (hasCompleted(user, sceneId)) line += "✅ ";
      else if (getNextAvailableScenes(user).some(s => s.id === sceneId)) line += "🎯 ";
      else line += "⬜ ";
    }
    output += line + "\n";
  }
  
  output += "\nLegenda: ✅ Completo | 🎯 Disponível | ⬜ Bloqueado";
  return output;
}