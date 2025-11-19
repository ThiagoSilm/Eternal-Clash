import { runBattle } from "./battleSystem.js";
import { addGold, addXP, addItem } from "./economySystem.js";

// -----------------------------
// CONFIGURAÇÃO BASE
// -----------------------------
export const WORLDS = 17;
export const STAGES_PER_WORLD = 11;
export const DIFFICULTIES = ["Fácil", "Médio", "Difícil"];

export const BIOMES = [
  "Floresta", "Deserto", "Tundra", "Vulcão",
  "Pântano", "Ruínas", "Vazio", "Céu", "Abismo"
];

export const EVENT_TYPES = [
  "heal", "treasure", "shop", "curse", "buff", "follower"
];

// -----------------------------
// MAP PHASES (para baús)
// -----------------------------
export const MAP_PHASES = Array.from({ length: WORLDS }, (_, w) => ({
  id: w + 1,
  subStages: Array.from({ length: STAGES_PER_WORLD }, (_, s) => `${w+1}-${s+1}`)
}));

// -----------------------------
// GERADOR DE CENAS (determinístico)
// -----------------------------
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
        branchLeft: seededRandom(seed + s) > 0.65,
        branchRight: seededRandom(seed + s) < 0.35,
        fog: true,
      });
    }
  }
  return scenes;
})();

// -----------------------------
// PROGRESSO DO JOGADOR
// -----------------------------
export function initUserMapProgress(user) {
  if (!user.mapProgress) {
    user.mapProgress = {
      completed: [],
      discovered: [],
      stars: {}, // estrelas por fase
      openedChests: {}, // baús abertos
      buffs: [],
      debuffs: []
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
// PRÓXIMAS CENAS DISPONÍVEIS
// -----------------------------
export function getNextAvailableScenes(user) {
  initUserMapProgress(user);
  const available = [];
  
  for (const scene of mapScenes) {
    const prev = `${scene.world}-${scene.stage - 1}`;
    const prevWorld = `${scene.world - 1}-${STAGES_PER_WORLD}`;
    const linearOK =
      (scene.stage === 1 && hasCompleted(user, prevWorld)) ||
      hasCompleted(user, prev);
    const branchOK = scene.branchLeft || scene.branchRight || scene.stage === 1;
    
    if (!hasCompleted(user, scene.id) && linearOK && branchOK) {
      discover(user, scene.id);
      available.push(scene);
    }
  }
  
  return available;
}

// -----------------------------
// ENTRAR EM UMA CENA
// -----------------------------
export async function enterScene(user, sceneId) {
  initUserMapProgress(user);
  
  const scene = mapScenes.find(s => s.id === sceneId);
  if (!scene) return `❌ Cena inválida.`;
  
  const allowed = getNextAvailableScenes(user).some(s => s.id === sceneId);
  if (!allowed) return `⚠️ Você não pode ir para ${sceneId} ainda.`;
  
  if (scene.type === "event") {
    return runMapEvent(user, scene);
  }
  
  // Batalha
  const result = await runBattle(user, scene);
  if (result.victory) {
    const stars = result.stars || 3; // stars retornadas pelo runBattle
    markSceneCompleted(user, sceneId, stars);
    grantMapRewards(user, scene);
    return `🏆 Vitória em ${sceneId}! Estrelas: ${stars}`;
  }
  
  return `💀 Você perdeu em ${sceneId}.`;
}

// -----------------------------
// EVENTOS DE MAPA
// -----------------------------
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

// -----------------------------
// RECOMPENSAS DE MAPA
// -----------------------------
function grantMapRewards(user, scene) {
  const xp = 20 + scene.difficulty * 2;
  const gold = 10 + scene.difficulty;
  
  addXP(user, xp);
  addGold(user, gold);
}

// -----------------------------
// ABRIR BAÚS POR ESTRELAS
// -----------------------------
export function openChest(user, phaseId) {
  initUserMapProgress(user);
  if (!user.mapProgress.openedChests[phaseId]) user.mapProgress.openedChests[phaseId] = 0;
  const opened = user.mapProgress.openedChests[phaseId];
  
  if (opened >= 3) return "⚠️ Todos os baús dessa fase já foram abertos.";
  
  const totalStars = Object.entries(user.mapProgress.stars)
    .filter(([stage]) => MAP_PHASES.find(p => p.subStages.includes(stage))?.id === phaseId)
    .reduce((acc, [_, s]) => acc + s, 0);
  
  const requiredStars = (opened + 1) * 3;
  if (totalStars < requiredStars) return `⚠️ Precisa de ${requiredStars} estrelas para abrir este baú.`;
  
  user.mapProgress.openedChests[phaseId]++;
  const gold = 50 * (opened + 1);
  const gem = 1 * (opened + 1);
  const coupon = 1 * (opened + 1);
  
  addGold(user, gold);
  addItem(user, "gem", gem);
  addItem(user, "coupon", coupon);
  
  return `🎁 Baú aberto! Você recebeu: ${gold} ouro, ${gem} gemas, ${coupon} cupom(s)`;
}

// -----------------------------
// VISUALIZADOR DE MAPA
// -----------------------------
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
  
  return text + `\n\nLegenda: 🎯 Disponível | ✅ Completo | ⭐ Estrelas | 🗝 Baú disponível | ❔ Não descoberto`;
}