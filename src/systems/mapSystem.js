// src/systems/mapSystem.js
//------------------------------------------------------------
import { runBattle } from "./battleSystem.js";
import { addGold, addXp } from "./economySystem.js";

//------------------------------------------------------------
// CONFIG BASE
//------------------------------------------------------------
const WORLDS = 17;
const STAGES_PER_WORLD = 11;

const BIOMES = [
  "forest", "desert", "tundra", "volcano",
  "swamp", "ruins", "void", "sky", "abyss"
];

const EVENT_TYPES = [
  "heal", "treasure", "shop", "curse", "buff", "follower"
];

//------------------------------------------------------------
// GERADOR DE MUNDO (procedural const deterministic)
//------------------------------------------------------------
function seededRandom(seed) {
  return Number("0." + Math.sin(seed).toString().substr(6));
}

export const mapScenes = (() => {
  const scenes = [];
  
  for (let w = 1; w <= WORLDS; w++) {
    const seed = w * 99999;
    
    for (let s = 1; s <= STAGES_PER_WORLD; s++) {
      const rnd = seededRandom(seed + s);
      
      let type = "normal";
      if (s === STAGES_PER_WORLD) type = "boss";
      else if (rnd < 0.08) type = "elite";
      else if (rnd < 0.18) type = "event";
      
      scenes.push({
        id: `${w}-${s}`,
        world: w,
        stage: s,
        biome: BIOMES[w % BIOMES.length],
        type,
        difficulty: Math.floor(w * 3 + s * 1.5),
        branchLeft: seededRandom(seed + s) > 0.65, // caminhos alternativos
        branchRight: seededRandom(seed + s) < 0.35,
        fog: true, // Fog of War
      });
    }
  }
  return scenes;
})();

//------------------------------------------------------------
// PROGRESSO DO JOGADOR
//------------------------------------------------------------
export function initUserMapProgress(user) {
  if (!user.mapProgress) {
    user.mapProgress = {
      completed: [],
      discovered: [],
      buffs: [],
      debuffs: [],
    };
  }
}

export function hasCompleted(user, id) {
  initUserMapProgress(user);
  return user.mapProgress.completed.includes(id);
}

export function markSceneCompleted(user, id) {
  initUserMapProgress(user);
  if (!hasCompleted(user, id)) user.mapProgress.completed.push(id);
}

function discover(user, id) {
  if (!user.mapProgress.discovered.includes(id)) {
    user.mapProgress.discovered.push(id);
  }
}

//------------------------------------------------------------
// PRÓXIMAS CENAS (com branching + fog)
//------------------------------------------------------------
export function getNextAvailableScenes(user) {
  initUserMapProgress(user);
  
  const available = [];
  for (const scene of mapScenes) {
    const prev = `${scene.world}-${scene.stage - 1}`;
    const prevWorld = `${scene.world - 1}-${STAGES_PER_WORLD}`;
    
    // Checagem linear
    const linearOK =
      (scene.stage === 1 && hasCompleted(user, prevWorld)) ||
      hasCompleted(user, prev);
    
    // Checagem dos branches
    const branchOK =
      scene.branchLeft ||
      scene.branchRight ||
      scene.stage === 1;
    
    if (!hasCompleted(user, scene.id) && linearOK && branchOK) {
      discover(user, scene.id); // remove fog
      available.push(scene);
    }
  }
  
  return available;
}

//------------------------------------------------------------
// ENTRAR EM CENA
//------------------------------------------------------------
export async function enterScene(user, sceneId) {
  initUserMapProgress(user);
  
  const scene = mapScenes.find(s => s.id === sceneId);
  if (!scene) return `❌ Cena inválida.`;
  
  const allowed = getNextAvailableScenes(user).some(s => s.id === sceneId);
  if (!allowed) return `⚠️ Você não pode ir para ${sceneId} ainda.`;
  
  // EVENTOS
  if (scene.type === "event") {
    return runMapEvent(user, scene);
  }
  
  // BATALHA
  const result = await runBattle(user, scene);
  
  if (result.victory) {
    markSceneCompleted(user, sceneId);
    grantMapRewards(user, scene);
    return `🏆 Vitória em ${sceneId}!`;
  }
  
  return `💀 Você perdeu em ${sceneId}.`;
}

//------------------------------------------------------------
// EVENTOS DE MAPA
//------------------------------------------------------------
export function runMapEvent(user, scene) {
  const event = EVENT_TYPES[Math.floor(Math.random() * EVENT_TYPES.length)];
  
  switch (event) {
    case "heal":
      user.hp = Math.min(user.maxHp, user.hp + 20);
      return `💖 Evento de cura: você recuperou 20 de HP!`;
      
    case "treasure":
      addGold(user, 50);
      return `💰 Baú encontrado! +50 ouro`;
      
    case "shop":
      return `🛒 Um mercador aparece! (em construção)`;
      
    case "curse":
      user.mapProgress.debuffs.push({ id: "curseAtk", value: -5, duration: 3 });
      return `☠️ Maldição: -5 ATK por 3 batalhas`;
      
    case "buff":
      user.mapProgress.buffs.push({ id: "blessing", value: +5, duration: 3 });
      return `✨ Bênção: +5 ATK por 3 batalhas`;
      
    case "follower":
      return `👤 Seguidor misterioso se junta a você...`;
      
    default:
      return `❓ Evento desconhecido.`;
  }
}

//------------------------------------------------------------
// RECOMPENSAS DO MAPA
//------------------------------------------------------------
function grantMapRewards(user, scene) {
  const xp = 20 + scene.difficulty * 2;
  const gold = 10 + scene.difficulty;
  
  addXp(user, xp);
  addGold(user, gold);
}

//------------------------------------------------------------
// VISUALIZADOR DE MAPA (com fog + biomas)
//------------------------------------------------------------
export function visualizeMap(user) {
  initUserMapProgress(user);
  
  let text = `🌍 **MAPA — Exploração**\n`;
  
  for (let w = 1; w <= WORLDS; w++) {
    let line = `\n**🌐 World ${w} — ${BIOMES[w % BIOMES.length]}**\n`;
    
    for (let s = 1; s <= STAGES_PER_WORLD; s++) {
      const id = `${w}-${s}`;
      const sc = mapScenes.find(x => x.id === id);
      
      let icon = "⬛";
      
      if (!user.mapProgress.discovered.includes(id)) icon = "❔";
      else if (hasCompleted(user, id)) icon = "✅";
      else if (getNextAvailableScenes(user).some(x => x.id === id)) icon = "🎯";
      else icon = sc.type === "elite" ? "🔥" : sc.type === "boss" ? "💀" : "⬜";
      
      line += `${icon} `;
    }
    text += line;
  }
  
  return text + `\n\nLegenda: 🎯 Disponível | 🔥 Elite | 💀 Boss | ❔ Não descoberto`;
}