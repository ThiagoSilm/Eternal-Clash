// src/systems/mapExplorationSystem.js

import fs from "fs";
import path from "path";
// Importa funções específicas do sistema de economia.
import { spendEnergy, ENERGY_TYPES, addGold, addItem } from "./economySystem.js"; 
import { battleSystem } from "./battleSystem.js"; // Assume que battleSystem tem .initBattle e .runBattle
import { CardController } from "../controllers/CardController.js"; // Assume que CardController é necessário para a batalha
import { markUserDirty } from "./userCacheSystem.js";

// =========================================================
// ⚙️ CONFIGURAÇÃO & CONSTANTES
// =========================================================
export const MAP_CONFIG = Object.freeze({
  worlds: 17,
  energyCost: 3, // Custo de energia por tentativa de fase
  energyType: ENERGY_TYPES.ADVENTURE, // Tipo de energia a ser gasta
  difficulties: ["Fácil", "Médio", "Difícil"],
  phasesFile: path.resolve("./data/phases.json") // Caminho para os dados estáticos das fases
});

// --- Tipagem de Estado ---
/**
 * @typedef {object} MapProgress
 * @property {string[]} completed - IDs das fases completadas (ex: '1-1', '2-5').
 * @property {string[]} discovered - IDs das fases desbloqueadas (visíveis no mapa).
 * @property {Object.<string, number>} stars - Estrelas obtidas por fase (Chave: phaseId, Valor: 1-3).
 * @property {Object.<number, number>} openedChests - Baús abertos por mundo (Chave: WorldId, Valor: 1-3).
 * @property {string[]} buffs - Buffs ativos no mapa.
 * @property {string[]} debuffs - Debuffs ativos no mapa.
 */

/**
 * @typedef {object} UserState
 * @property {string} id
 * @property {MapProgress} [mapProgress] - Progresso do usuário no mapa.
 */

// --- Funções de Segurança e Carregamento ---
const SAFE = Object.freeze({
  assertUser: (u) => { if (!u || typeof u !== 'object') throw new Error("Utilizador inválido"); },
  loadJSON: (p) => {
    try {
      return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf-8")) : {};
    } catch (e) { console.error("Erro ao carregar mapa JSON:", e); return {}; }
  }
});

// Dados estáticos das fases (PHASES['1-1'] contém dados de inimigos e recompensas)
const PHASES = SAFE.loadJSON(MAP_CONFIG.phasesFile);

// Estrutura de Metadados do Mapa (Define a ordem e ligação)
export const MAP_PHASES = [
  { id: 1, subStages: ["1-1", "1-2", "1-3", "1-4", "1-5", "1-6"] },
  { id: 2, subStages: ["2-1", "2-2", "2-3", "2-4", "2-5", "2-6"] }, // Adicionado W2 para lógica
  { id: 3, subStages: ["3-1", "3-2", "3-3", "3-4", "3-5", "3-6"] },
  // ... resto
];

// =========================================================
// 🔄 GESTÃO E INICIALIZAÇÃO DE ESTADO
// =========================================================

/**
 * Inicializa o objeto de progresso de mapa do usuário se não existir.
 * @param {UserState} user - Objeto do usuário (mutável).
 * @returns {MapProgress} O objeto de progresso.
 */
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

/**
 * Verifica se uma fase específica foi completada.
 * @param {UserState} user
 * @param {string} phaseId - ID da fase (ex: '1-1').
 * @returns {boolean}
 */
export function hasCompleted(user, phaseId) {
  const prog = initUserMapProgress(user);
  return prog.completed.includes(phaseId);
}

/**
 * Marca uma fase como completada e registra o número máximo de estrelas obtidas.
 * @param {UserState} user - Objeto do usuário (mutável).
 * @param {string} id - ID da fase.
 * @param {number} stars - Número de estrelas obtidas (1 a 3).
 */
function markSceneCompleted(user, id, stars) {
  const prog = initUserMapProgress(user);
  
  if (!prog.completed.includes(id)) {
      prog.completed.push(id);
  }
  
  const newStars = Math.max(0, Math.min(3, Number(stars) || 0));
  const currentStars = prog.stars[id] || 0;
  
  // Só salva se for um novo recorde de estrelas
  if (newStars > currentStars) {
      prog.stars[id] = newStars;
      markUserDirty(user.id);
  }
}

// =========================================================
// 🗺️ LÓGICA DE DESCOBERTA E ACESSO
// =========================================================

/**
 * Tenta desbloquear fases adjacentes que o usuário tem acesso.
 * @param {UserState} user - Objeto do usuário (mutável).
 */
export function discoverNextScenes(user) {
  const prog = initUserMapProgress(user);
  let hasChanged = false;
  
  // 1. Inicialização: Garante que a primeira fase (se existir) está visível
  if (!prog.discovered.length) {
    const firstId = MAP_PHASES[0]?.subStages[0] || "1-1";
    if (!prog.discovered.includes(firstId)) {
      prog.discovered.push(firstId);
      hasChanged = true;
    }
  }

  // 2. Itera sobre todas as fases para checar desbloqueio
  for (const phaseId of Object.keys(PHASES)) {
    if (checkAndUnlockPhase(user, phaseId)) {
        hasChanged = true;
    }
  }
  
  if (hasChanged) markUserDirty(user.id);
}

/**
 * Verifica e desbloqueia uma fase específica se o pré-requisito for atendido.
 * @param {UserState} user - Objeto do usuário (mutável).
 * @param {string} phaseId - ID da fase.
 * @returns {boolean} True se a fase foi desbloqueada.
 */
function checkAndUnlockPhase(user, phaseId) {
  const prog = user.mapProgress; // Assume já inicializado por discoverNextScenes
  
  if (prog.completed.includes(phaseId) || prog.discovered.includes(phaseId)) return false;

  // 1-1 é desbloqueada na inicialização de discoverNextScenes
  if (phaseId === (MAP_PHASES[0]?.subStages[0] || "1-1")) return false; 

  const prevId = getPreviousStageId(phaseId);
  
  if (prevId && prog.completed.includes(prevId)) {
    prog.discovered.push(phaseId);
    return true;
  }
  return false;
}

/**
 * Retorna o ID da fase anterior sequencialmente no mapa.
 * @param {string} currentId - ID da fase atual (ex: 'W-S').
 * @returns {string | null} O ID da fase anterior, ou null.
 */
function getPreviousStageId(currentId) {
  const parts = currentId.split("-").map(Number);
  if (parts.length !== 2) return null;
  
  const [w, s] = parts;

  // 1. Fase anterior no mesmo mundo (W-S -> W-S-1)
  if (s > 1) return `${w}-${s - 1}`;
  
  // 2. Última fase do mundo anterior (Se S=1)
  const prevWorld = MAP_PHASES.find(p => p.id === w - 1);
  if (prevWorld?.subStages?.length) {
    return prevWorld.subStages[prevWorld.subStages.length - 1];
  }
  return null;
}

/**
 * Retorna a lista de fases que o usuário pode acessar, mas ainda não completou.
 * @param {UserState} user - Objeto do usuário.
 * @returns {string[]} IDs das fases disponíveis.
 */
export function getNextAvailableScenes(user) {
  discoverNextScenes(user); // Garante que a lógica de desbloqueio foi rodada
  const prog = user.mapProgress;
  
  return prog.discovered.filter(id => !prog.completed.includes(id));
}

// =========================================================
// ⚔️ ENTRAR NA CENA (CORE)
// =========================================================

/**
 * Função principal para iniciar uma tentativa de fase.
 * @param {UserState} user - Objeto do usuário (mutável).
 * @param {string} phaseId - ID da fase a ser jogada.
 * @param {string} [difficulty="Fácil"] - Dificuldade selecionada.
 * @returns {Promise<string>} Mensagem de resultado da batalha.
 */
export async function enterScene(user, phaseId, difficulty = "Fácil") {
  try {
    const phaseData = validateEntry(user, phaseId, difficulty);
    
    // 1. Tenta gastar energia
    if (!spendEnergy(user, MAP_CONFIG.energyType, MAP_CONFIG.energyCost)) {
      return `⚠️ Energia insuficiente. Custo: **${MAP_CONFIG.energyCost}** ${MAP_CONFIG.energyType}.`;
    }

    // 2. Executa as batalhas (pode ser uma sequência)
    const result = await runStageBattles(user, phaseData, difficulty, phaseId);
    
    // 3. Finaliza
    if (result.victory) {
      finalizeVictory(user, phaseId, result.stars);
      // Força a rodar o discoverNextScenes para atualização imediata do status de desbloqueio
      discoverNextScenes(user); 
      return `🏆 Vitória em **${phaseId}** na dificuldade ${difficulty}! Estrelas: **${result.stars}**`;
    }
    return `💀 Derrota em ${phaseId}. Tente novamente!`;
    
  } catch (e) {
    return `Erro: ${e.message}`;
  }
}

/**
 * Valida se o usuário pode tentar a fase.
 * @param {UserState} user
 * @param {string} phaseId
 * @param {string} difficulty
 * @returns {object} Dados da fase (phaseData).
 * @throws {Error} Se a fase estiver bloqueada ou for inválida.
 */
function validateEntry(user, phaseId, difficulty) {
  initUserMapProgress(user);
  if (!PHASES[phaseId]) throw new Error(`Fase ${phaseId} inexistente.`);
  if (!MAP_CONFIG.difficulties.includes(difficulty)) throw new Error("Dificuldade inválida.");
  
  // Permite jogar se a fase for desbloqueada/disponível OU se já foi completada (para farming)
  const isAvailable = getNextAvailableScenes(user).includes(phaseId);
  const isCompleted = hasCompleted(user, phaseId);
  
  if (!isAvailable && !isCompleted) {
    throw new Error(`Fase ${phaseId} bloqueada. Complete a fase anterior primeiro.`);
  }
  return PHASES[phaseId];
}

/**
 * Simula a sequência de batalhas dentro de uma fase.
 * @param {UserState} user
 * @param {object} phaseData
 * @param {string} difficulty
 * @param {string} phaseId
 * @returns {Promise<{victory: boolean, stars: number}>}
 */
async function runStageBattles(user, phaseData, difficulty, phaseId) {
  const enemies = phaseData.enemies || [];
  let stars = 3; // Estrelas iniciais (podem ser reduzidas pelo sistema de batalha)

  for (let i = 0; i < enemies.length; i++) {
    const enemyDef = resolveEnemyVariant(enemies[i], difficulty);
    
    // Configuração de opções de batalha (passadas para battleSystem)
    const opts = { mapStage: phaseId, index: i, difficulty };
    
    // Assume que initBattle e runBattle interagem com CardController e devolvem o resultado
    const init = battleSystem.initBattle(user, enemyDef, opts, CardController);
    const res = await battleSystem.runBattle(init);
    
    const winner = res?.winner ?? res?.state?.winner;
    
    if (winner !== "player") return { victory: false, stars: 0 };
    
    // Aqui deveria haver lógica para reduzir estrelas (ex: se perdeu HP, se demorou, etc.)
    // Por simplicidade, mantemos 3 estrelas se todas as batalhas forem vencidas.
  }
  
  return { victory: true, stars };
}

/**
 * Retorna a definição de inimigo ajustada para a dificuldade.
 * @param {object} rawEnemy - Definição de inimigo.
 * @param {string} difficulty
 * @returns {object} Definição final do inimigo.
 */
function resolveEnemyVariant(rawEnemy, difficulty) {
  // Se houver variantes específicas por dificuldade, usa-as.
  if (rawEnemy.variants && rawEnemy.variants[difficulty]) {
    return rawEnemy.variants[difficulty];
  }
  // Caso contrário, usa a definição base.
  return rawEnemy.base || rawEnemy;
}

/**
 * Concede recompensas e atualiza o progresso após a vitória.
 * @param {UserState} user - Objeto do usuário (mutável).
 * @param {string} phaseId
 * @param {number} stars
 */
function finalizeVictory(user, phaseId, stars) {
  markSceneCompleted(user, phaseId, stars);
  grantPhaseRewards(user, PHASES[phaseId]);
}

// =========================================================
// 💰 RECOMPENSAS, ITENS E BAÚS
// =========================================================

/**
 * Concede as recompensas estáticas da fase ao usuário.
 * @param {UserState} user - Objeto do usuário (mutável).
 * @param {object} phaseData
 */
function grantPhaseRewards(user, phaseData) {
  if (!phaseData?.reward) return;
  const { gold, gems, card, items } = phaseData.reward;

  if (gold) addGold(user, gold);
  // Nota: O original usava `addItem` para gemas, o que as trata como item de inventário em vez de moeda.
  // Mantive a implementação original, mas o ideal seria usar `addGems` do economySystem.
  if (gems) addItem(user, "gem", gems); 
  
  if (card) addItem(user, card, 1);
  
  if (Array.isArray(items)) {
    items.forEach(it => it.id && addItem(user, it.id, it.amount || 1));
  }
  markUserDirty(user.id);
}

/**
 * Tenta abrir um baú de marco de mundo (requer estrelas totais).
 * @param {UserState} user - Objeto do usuário (mutável).
 * @param {(string|number)} worldId - ID do mundo (1 a N).
 * @returns {string} Mensagem de status ou sucesso.
 */
export function openChest(user, worldId) {
  initUserMapProgress(user);
  const world = Number(worldId);
  
  if (!world || world < 1 || world > MAP_CONFIG.worlds) return "Mundo inválido.";

  const prog = user.mapProgress;
  prog.openedChests[world] = prog.openedChests[world] || 0;
  
  const currentLevel = prog.openedChests[world];
  if (currentLevel >= 3) return "⚠️ Todos os baús de marco neste mundo já foram abertos (Máx: 3).";

  const nextLevel = currentLevel + 1;
  const neededStars = nextLevel * 3; // Ex: Nv 1 requer 3, Nv 2 requer 6, Nv 3 requer 9.
  const currentStars = calculateWorldStars(user, world);

  if (currentStars < neededStars) {
    return `⚠️ Requer **${neededStars} estrelas** para o Baú Nv.${nextLevel} (Possui: ${currentStars}).`;
  }

  prog.openedChests[world] = nextLevel;
  
  // Recompensas escalam com o nível do baú
  const rewardGold = 50 * nextLevel;
  const rewardGems = 1 * nextLevel;
  
  addGold(user, rewardGold);
  addItem(user, "gem", rewardGems);
  
  markUserDirty(user.id);
  return `🎁 Baú Nv.**${nextLevel}** do Mundo ${world} aberto! Ganhos: **${rewardGold} ouro** e **${rewardGems} gem**!`;
}

/**
 * Calcula o número total de estrelas obtidas em todas as fases de um mundo.
 * @param {UserState} user
 * @param {number} worldId - ID do mundo.
 * @returns {number} Total de estrelas.
 */
function calculateWorldStars(user, worldId) {
  const worldMeta = MAP_PHASES.find(p => p.id === worldId);
  if (!worldMeta) return 0;
  
  // Assume que user.mapProgress.stars está inicializado
  return worldMeta.subStages.reduce((acc, stageId) => {
    return acc + (user.mapProgress.stars[stageId] || 0);
  }, 0);
}

// =========================================================
// 📊 VISUALIZAÇÃO E EXPORTS
// =========================================================

/**
 * Gera uma representação visual do mapa de progresso do usuário.
 * @param {UserState} user
 * @returns {string} Visualização formatada do mapa.
 */
export function visualizeMap(user) {
  initUserMapProgress(user);
  discoverNextScenes(user);
  
  const lines = ["🌍 **MAPA — Exploração**"];
  for (const world of MAP_PHASES) {
    const icons = world.subStages.map(stage => getStageIcon(user, stage));
    lines.push(`🌐 **Mundo ${world.id}:** ${icons.join(" ")}`);
  }
  
  lines.push("\n---");
  lines.push("Legenda: ✅ (Completo) | 🎯 (Disponível) | ❔ (Bloqueado)");
  return lines.join("\n");
}

/**
 * Retorna o ícone de status para uma fase específica.
 * @param {UserState} user
 * @param {string} stageId
 * @returns {string} Ícone.
 */
function getStageIcon(user, stageId) {
  const prog = user.mapProgress;
  // Exibe o número de estrelas para fases completadas
  if (prog.completed.includes(stageId)) {
      const stars = prog.stars[stageId] || 0;
      return `[${stars}★]`;
  }
  if (prog.discovered.includes(stageId)) return "🎯";
  return "❔";
}

// Exports adicionais para acessibilidade
export const getNextAvailableScenesForUser = (u) => getNextAvailableScenes(u);
export const getPhaseInfo = (id) => PHASES[id] || null;
