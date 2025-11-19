// src/systems/cardSystem.js
//------------------------------------------------------------
//  SISTEMA DE CARTAS/GUARDIÕES — EXPANSÃO E INTEGRAÇÃO (REFACTOR)
//------------------------------------------------------------
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";
// Assumindo que estes sistemas estão disponíveis
import { markUserDirty } from "./userCacheSystem.js"; 
import { spendGold } from "./economySystem.js";

// Setup de caminhos
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "../../data");

// --- Caminhos de Dados ---
const CARD_DEFINITIONS_PATH = path.join(DATA_DIR, "cards.json");
const GUARDIAN_DEFINITIONS_PATH = path.join(DATA_DIR, "guardians.json"); 

// --- Carregamento de Dados Comum ---
/**
 * Carrega e analisa um arquivo JSON de definições.
 * @param {string} filePath - Caminho completo do arquivo.
 * @param {string} defaultContent - Conteúdo JSON padrão se o arquivo não existir.
 * @returns {Array<Object>} O array de definições carregadas.
 */
function loadDefinitions(filePath, defaultContent = "[]") {
  if (!fs.existsSync(filePath)) {
    console.warn(`${path.basename(filePath)} não encontrado! Criando arquivo vazio.`);
    fs.writeFileSync(filePath, defaultContent);
  }
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Erro ao carregar ${path.basename(filePath)}:`, err);
    return [];
  }
}

// --- Definições e Índices ---

/** @type {Array<import('./types').CardTemplate>} */
export const cardDefinitions = loadDefinitions(CARD_DEFINITIONS_PATH);
/** @type {Map<string, import('./types').CardTemplate>} */
export const cardIndex = new Map(cardDefinitions.map(c => [c.id, c]));

/** @type {Array<import('./types').GuardianTemplate>} */
export const guardianDefinitions = loadDefinitions(GUARDIAN_DEFINITIONS_PATH);
/** @type {Map<string, import('./types').GuardianTemplate>} */
export const guardianIndex = new Map(guardianDefinitions.map(g => [g.id, { ...g, type: "guardian" }]));

// ---------- META: grades & elements ----------

// Configurações de Bônus de Status por Grade
export const GRADES = {
  common: { multHp: 1, multAtk: 1, meldBonus: 0 },
  uncommon: { multHp: 1.08, multAtk: 1.06, meldBonus: 5 },
  rare: { multHp: 1.18, multAtk: 1.15, meldBonus: 10 },
  epic: { multHp: 1.35, multAtk: 1.3, meldBonus: 20 },
  mythical: { multHp: 1.5, multAtk: 1.45, meldBonus: 30 },
  legendary: { multHp: 1.8, multAtk: 1.7, meldBonus: 40 },
  relic: { multHp: 2.2, multAtk: 2.0, meldBonus: 60 },
};

// Configurações de Vantagem/Desvantagem Elementar
export const ELEMENTS = {
  neutral: { weak: null, resist: null },
  fire: { weak: "water", resist: "wind" },
  water: { weak: "electric", resist: "fire" },
  earth: { weak: "wind", resist: "electric" },
  light: { weak: "dark", resist: null },
  dark: { weak: "light", resist: null },
  wind: { weak: "fire", resist: "earth" },
  electric: { weak: "earth", resist: "water" },
};

export function getGrade(grade) {
  return GRADES[grade] || GRADES.common;
}
export function getElement(name) {
  return ELEMENTS[name] || ELEMENTS.neutral;
}

// ---------- HELPERS: growth curves ----------
function rarityMultiplier(grade) {
  return getGrade(grade).multAtk ?? 1;
}
function gradeHpMult(grade) {
  return getGrade(grade).multHp ?? 1;
}

/**
 * Aplica a curva de crescimento ao status base.
 * @param {number} base - O valor base (e.g., HP ou ATK).
 * @param {number} level - O nível atual da carta.
 * @param {number} [growth=0.05] - A taxa de crescimento por nível.
 * @param {string} [curve="linear"] - O tipo de curva ("linear", "smooth", "aggressive").
 * @param {string} [grade="common"] - A grade da carta.
 * @returns {number} O status calculado.
 */
export function applyGrowth(base, level, growth = 0.05, curve = "linear", grade = "common") {
  const g = Math.max(0, growth);
  const baseValue = base * gradeHpMult(grade);
  if (level <= 1) return Math.floor(baseValue); // Nível 1 não aplica crescimento
  
  const effectiveLevel = level - 1;

  switch (curve) {
    case "smooth":
      return Math.floor(baseValue * Math.pow(1 + g, effectiveLevel));
    case "aggressive":
      return Math.floor(baseValue * (1 + effectiveLevel * g * 1.6));
    case "linear":
    default:
      return Math.floor(baseValue * (1 + effectiveLevel * g));
  }
}

// ---------- GETTERS (UNIFICADOS) ----------
/** * Retorna o template de Carta ou Guardião pelo ID. 
 * @param {string} id
 * @returns {import('./types').CardTemplate | import('./types').GuardianTemplate | null}
 */
export function getCardTemplate(id) { 
  return cardIndex.get(id) || guardianIndex.get(id) || null; 
}

/** * Retorna a lista de Cartas ou a lista unificada de Cartas e Guardiões.
 * @param {object} [options]
 * @param {boolean} [options.includeGuardians=false]
 * @returns {Array<Object>}
 */
export function getCardList(options = {}) { 
  if (options.includeGuardians) return [...cardDefinitions, ...guardianDefinitions];
  return cardDefinitions;
}

// ---------- FACTORY BASE ----------
/**
 * Cria a instância base compartilhada entre Cartas e Guardiões.
 * @param {import('./types').CardTemplate | import('./types').GuardianTemplate} template
 * @returns {object} A instância base.
 */
function createBaseInstance(template) {
  // Guardiões usam 'level' no template; Cartas normais usam 'rarity' (mapeado para level no template original).
  const levelOrRarity = template.level ?? template.rarity ?? 1;
  
  return {
    uniqueId: uuidv4(),
    id: template.id,
    name: template.name,
    rarity: levelOrRarity, // Mantido para compatibilidade em algumas lógicas (e.g., meld cost)
    level: levelOrRarity, 
    grade: template.grade || "common",
    type: template.type ?? "card",
    image: template.image || null,
    // Guardião usa 'faction' como 'element'
    element: template.element || template.faction || "neutral", 
    growth: template.growth ?? 0.05,
    growthCurve: template.growthCurve || "linear",
    xp: 0,
    xpToNext: template.xpToNext || 100,
    tags: template.tags || [],
  };
}

// ---------- FACTORIES ESPECÍFICAS ----------

/**
 * Cria uma instância de Carta Normal.
 * @param {import('./types').CardTemplate} template
 * @returns {import('./types').CardInstance}
 */
function createNormalCard(template) {
  const base = createBaseInstance(template);
  
  const baseHp = template.hp || 100;
  const baseAttack = template.attack || 10;

  const maxHp = applyGrowth(baseHp, base.level, base.growth, base.growthCurve, base.grade);
  // Attack base é multiplicado pelo multiplicador de raridade (rarityMultiplier)
  const attack = Math.floor(applyGrowth(baseAttack, base.level, base.growth, base.growthCurve, base.grade) * rarityMultiplier(base.grade) / gradeHpMult(base.grade)); 
  
  return {
    ...base,
    hp: maxHp,
    maxHp,
    baseHp,
    attack,
    baseAttack,
    effects: [...(template.effects || [])],
    unlockedEvolution: !!template.unlockedEvolution,
    evolutionSteps: JSON.parse(JSON.stringify(template.evolutions || [])),
    meldChance: template.meldChance || 0,
    runeSlots: { core: null, support: null, burst: null },
    perks: template.perks || [],
  };
}

/**
 * Cria uma instância de Guardião.
 * @param {import('./types').GuardianTemplate} template
 * @returns {import('./types').GuardianInstance}
 */
function createGuardian(template) {
  const base = createBaseInstance(template);
  
  const guardianMaxHp = template.maxHp || 1000;
  // Guardiões não usam o sistema de crescimento de level de carta normal,
  // seu HP é definido diretamente pelo template e level.
  
  return {
    ...base,
    isGuardian: true,
    type: "guardian",
    guardianLevel: base.level,
    guardianMaxHp,
    guardianCurrentHp: guardianMaxHp,
    // Combina passives e effects do template
    effects: [...(template.passive || []), ...(template.effects || [])], 
    attack: 0, // Ataque é tipicamente calculado em tempo real
    perks: template.perks || [],
    runeSlots: { core: null, support: null, burst: null },
  };
}

/**
 * Cria uma instância de Shard (Fragmento).
 * @param {string} cardId - O ID da carta a que o shard pertence.
 * @param {number} quantity - Quantidade inicial.
 * @returns {object | null} A instância do shard ou null se o template não for encontrado.
 */
function createShard(cardId, quantity = 1) {
  const template = getCardTemplate(cardId);
  if (!template) return null;

  return {
    uniqueId: uuidv4(),
    id: `shard_${cardId}`,
    name: `Shard de ${template.name}`,
    shardOf: cardId,
    quantity,
    type: "shard",
    rarity: template.rarity || 1,
    shardsToCraft: template.shardsToCraft || 50
  };
}

function createP2WCard(template) {
  const card = createNormalCard(template);
  return {
    ...card,
    isP2W: true,
    type: "p2w"
  };
}

// ---------- OPERAÇÕES PÚBLICAS ----------

/**
 * Adiciona uma carta (ou Guardião) à coleção do usuário.
 * @param {object} user - O objeto de usuário do bot.
 * @param {string} cardId - O ID do template da carta/guardião.
 * @returns {{ duplicate: boolean, instance: object | null, success: boolean, message?: string }}
 */
export function giveCardToUser(user, cardId) {
  const template = getCardTemplate(cardId);
  if (!template) return { duplicate: false, instance: null, success: false, message: "Template não encontrado." };
  
  if (!user.cards) user.cards = [];
  let instance = null;
  let duplicate = false;

  switch (template.type) {
    case "guardian": 
      // Guardiões são únicos por ID.
      duplicate = user.cards.some(c => c.id === cardId && c.type === "guardian");
      if (duplicate) {
        // Se duplicata, a lógica de Shards é tratada no sistema de Summon (ou fora daqui).
        return { duplicate: true, instance: template, success: false, message: "Guardião já possuído." };
      }
      instance = createGuardian(template); 
      break;
    case "shard": 
      // Shards são gerenciados por uma função separada.
      return addShardsToUser(user, cardId, 1);
    case "p2w": 
      instance = createP2WCard(template); 
      break;
    default: 
      instance = createNormalCard(template); 
      break;
  }
  
  user.cards.push(instance);
  markUserDirty(user.id);
  
  return { duplicate, instance, success: true };
}

/**
 * Remove uma carta da coleção do usuário pelo uniqueId.
 * @param {object} user - O objeto de usuário.
 * @param {string} uniqueId - O uniqueId da carta.
 * @returns {{ success: boolean, removedCard?: object, message?: string }}
 */
export function removeCardFromUser(user, uniqueId) {
  if (!user.cards) return { success: false, message: "Nenhuma carta." };
  const idx = user.cards.findIndex(c => c.uniqueId === uniqueId);
  if (idx === -1) return { success: false, message: "Carta não encontrada." };
  
  const removed = user.cards.splice(idx, 1)[0];
  markUserDirty(user.id);
  
  return { success: true, removedCard: removed };
}

// ---------- MELD / EVOLUTION ----------

/**
 * Calcula o custo do meld (baseado em raridade e grade).
 * @param {object} card - A instância da carta.
 * @returns {number} O custo em ouro.
 */
export function calculateMeldCost(card) {
  const gradeBonus = (card?.grade && GRADES[card.grade]) ? GRADES[card.grade].meldBonus || 0 : 0;
  const rarity = Math.max(1, card?.rarity || 1);
  return Math.round(3000 * Math.pow(rarity, 2) + gradeBonus * 50);
}

/**
 * Tenta realizar o meld de uma carta doadora em uma carta base.
 * @param {object} user - O objeto de usuário.
 * @param {string} baseUid - uniqueId da carta a receber o meld.
 * @param {string} donorUid - uniqueId da carta doadora.
 * @returns {{ success: boolean, message: string }}
 */
export function tryMeld(user, baseUid, donorUid) {
  const card = findUserCardByUnique(user, baseUid);
  const donor = findUserCardByUnique(user, donorUid);
  
  if (!card || !donor) return { success: false, message: "Cartas inválidas." };
  if (card.type !== "card" || donor.type !== "card") return { success: false, message: "Apenas cartas normais podem receber meld." };
  if (!card.unlockedEvolution) return { success: false, message: "Evolução bloqueada. Desbloqueie primeiro." };
  
  const donorTemplate = getCardTemplate(donor.id);
  const donorEffect = donorTemplate?.evolutionEffectId;
  
  if (!donorEffect) return { success: false, message: "Doador sem efeito de evolução válido." };
  if ((card.effects || []).includes(donorEffect)) return { success: false, message: "Carta já possui este efeito." };

  const cost = calculateMeldCost(card);
  if (!spendGold(user, cost)) return { success: false, message: `Ouro insuficiente (${cost}).` };

  const baseChance = Math.min((card.meldChance || 0) + (GRADES[card.grade]?.meldBonus || 0), 95);
  const roll = Math.random() * 100;
  
  // Consome o doador, independentemente do sucesso
  const rem = removeCardFromUser(user, donorUid);
  if (!rem.success) return { success: false, message: "Falha ao consumir carta doadora." };

  if (roll < baseChance) {
    card.effects = [...new Set([...(card.effects || []), donorEffect])];
    card.meldChance = 0; // Reseta a chance após o sucesso
    markUserDirty(user.id);
    return { success: true, message: `Meld OK — ${card.name} recebeu ${donorEffect}.` };
  } else {
    // Aumenta a chance se falhar
    card.meldChance = Math.min(99, (card.meldChance || 0) + 10);
    markUserDirty(user.id);
    return { success: false, message: `Falhou. Chance acumulada agora: ${card.meldChance}%.` };
  }
}

/**
 * Tenta evoluir a carta se os requisitos forem atendidos.
 * @param {object} user - O objeto de usuário.
 * @param {string} uid - uniqueId da carta.
 * @returns {{ success: boolean, message: string }}
 */
export function evolveCard(user, uid) {
  const card = findUserCardByUnique(user, uid);
  if (!card || card.type === "guardian") return { success: false, message: "Carta inválida para evolução." };
  
  const step = card.evolutionSteps?.[0];
  if (!step) return { success: false, message: "Sem evolução disponível." };

  const levelReqMet = (card.level || 1) >= (step.levelReq || 10);
  if (!levelReqMet) return { success: false, message: `Requer Nível ${step.levelReq || 10}.` };
  
  const cost = step.cost || Math.round(1000 * Math.pow(card.rarity || 1, 2));
  if (!spendGold(user, cost)) {
    return { success: false, message: `Ouro insuficiente (${cost}).` };
  }
  
  card.evolutionSteps.shift(); // Remove a etapa concluída
  
  if (step.addEffects) card.effects = [...new Set([...(card.effects || []), ...step.addEffects])];
  if (step.increaseHp) { card.maxHp = (card.maxHp || 0) + step.increaseHp; card.hp = card.maxHp; }
  if (step.increaseAtk) card.attack = (card.attack || 0) + step.increaseAtk;
  if (step.upgradeGrade) card.grade = step.upgradeGrade;
  if (step.unlock?.evolution) card.unlockedEvolution = true;

  markUserDirty(user.id);
  recalcCardStats(card); // Recalcula após mudanças de grade/status
  return { success: true, message: `${card.name} evoluiu!` };
}

// ---------- RUNAS REWORK ----------

function validateRuneObject(rune) {
  // Simplificação: apenas verifica as propriedades mínimas.
  if (!rune || typeof rune !== "object" || !rune.name || !rune.slot) return false;
  return ["core", "support", "burst"].includes(rune.slot);
}

export function addRune(user, uid, rune) {
  const card = findUserCardByUnique(user, uid);
  if (!card) return { success: false, message: "Carta inexistente." };
  if (!validateRuneObject(rune)) return { success: false, message: "Runa inválida ou faltando slot." };
  
  const slot = rune.slot;
  card.runeSlots = card.runeSlots || { core: null, support: null, burst: null };
  
  if (card.runeSlots[slot]) return { success: false, message: `Slot ${slot} ocupado.` };
  
  card.runeSlots[slot] = { ...rune, level: rune.level || 1 };
  markUserDirty(user.id);
  recalcCardStats(card);
  return { success: true, message: `Runa aplicada (${slot}) em ${card.name}.` };
}

export function removeRune(user, uid, slot) {
  const card = findUserCardByUnique(user, uid);
  if (!card) return { success: false, message: "Carta inexistente." };
  
  card.runeSlots = card.runeSlots || { core: null, support: null, burst: null };
  if (!card.runeSlots[slot]) return { success: false, message: "Slot vazio." };
  
  const removed = card.runeSlots[slot];
  card.runeSlots[slot] = null;
  markUserDirty(user.id);
  recalcCardStats(card);
  return { success: true, message: `Runa removida (${removed.name}).`, removedRune: removed };
}

export function upgradeRune(user, uid, slot, cost) {
  const card = findUserCardByUnique(user, uid);
  if (!card) return { success: false, message: "Carta inexistente." };
  
  const rune = card.runeSlots?.[slot];
  if (!rune) return { success: false, message: "Runa não encontrada." };
  if (!spendGold(user, cost)) return { success: false, message: "Ouro insuficiente." };
  
  rune.level = (rune.level || 1) + 1;
  markUserDirty(user.id);
  recalcCardStats(card);
  return { success: true, message: `Runa ${rune.name} upada para lv ${rune.level}.` };
}

// ---------- PERKS / PASSIVAS ----------
/**
 * Aplica os efeitos de Perks e Runas diretamente na entidade (modifica in-place).
 * Geralmente usado antes de iniciar o combate.
 * @param {import('./types').CardInstance | import('./types').GuardianInstance | object} entity - A carta ou entidade a ser modificada.
 */
export function applyPerksToEntity(entity) {
  if (!entity || !entity.perks?.length) return;
  
  // Nota: Esta função é primariamente para aplicar modificações *temporárias* de combate (como auras)
  // ou para re-aplicar modificações permanentes que deveriam ter sido feitas em recalcCardStats.
  // Em um refatoramento mais profundo, modificadores estáticos de HP/ATK devem ocorrer em recalcCardStats.
  
  for (const p of entity.perks) {
    if (!p || !p.type) continue;
    
    // Efeitos que manipulam HP/ATK/etc. (para efeitos que não são puramente recalculáveis)
    if (p.type === "flatAtk") entity.attack = (entity.attack || 0) + (p.value || 0);
    
    // Efeito de Aura (exemplo: buffar aliados)
    if (p.type === "aura" && Array.isArray(entity.team)) {
      // aura object: { target: "ally", effect: { type, value } }
      for (const t of entity.team) {
        if (!t) continue;
        if (p.effect?.type === "flatAtk") t.attack = (t.attack || 0) + (p.effect.value || 0);
      }
    }
  }
}

// ---------- RECALCULATION (CRÍTICO) ----------
/**
 * Recalcula todos os stats de uma carta com base em seu level, grade, runas e perks.
 * É essencial para manter a consistência do estado da carta.
 * @param {import('./types').CardInstance | import('./types').GuardianInstance} card - A instância da carta/guardião.
 */
export function recalcCardStats(card) {
  if (!card) return;
  
  const isGuardian = card.type === "guardian";
  const { runeMods, perkMods } = extractModifiers(card);

  let flatAtkBonus = (runeMods.flatAtk || 0) + (perkMods.flatAtk || 0);
  let percentHpBonus = (runeMods.percentHp || 0) + (perkMods.percentHp || 0);

  if (isGuardian) {
    const baseHpTemplate = getCardTemplate(card.id)?.maxHp || 1000;
    
    // Aplica modificadores percentuais ao HP base do guardião
    const newMaxHp = Math.floor(baseHpTemplate * (1 + percentHpBonus));
    card.guardianMaxHp = newMaxHp;
    
    // Garante que o HP atual não exceda o novo Máximo
    card.guardianCurrentHp = Math.min(card.guardianCurrentHp || newMaxHp, newMaxHp);
    
    // Recalcula o ATK base (Guardiões geralmente têm 0, mas aplica-se o flatAtk)
    card.attack = Math.max(0, flatAtkBonus); 
    return;
  }
  
  // --- Lógica para Cartas Normais ---
  card.baseHp = card.baseHp || (getCardTemplate(card.id)?.hp) || 100;
  card.baseAttack = card.baseAttack || (getCardTemplate(card.id)?.attack) || 10;
  
  // 1. Recalcula HP base (com growth e grade)
  let newMaxHp = applyGrowth(card.baseHp, card.level || 1, card.growth || 0.05, card.growthCurve || "linear", card.grade || "common");

  // 2. Aplica modificadores percentuais ao MaxHp
  newMaxHp = Math.floor(newMaxHp * (1 + percentHpBonus));
  card.maxHp = newMaxHp;
  
  // Garante que o HP atual não exceda o novo Máximo
  card.hp = Math.min(card.hp || newMaxHp, newMaxHp);

  // 3. Recalcula ATK base (com growth e multiplicador de raridade)
  const baseAtkCalc = Math.floor(
    (card.baseAttack || 10) * rarityMultiplier(card.grade || "common") * (1 + ((card.level || 1) - 1) * (card.growth || 0.05))
  );
  
  // 4. Aplica modificadores de ataque (apenas flatAtk, percentual não está no template original)
  card.attack = Math.max(0, Math.floor(baseAtkCalc + flatAtkBonus));
}

/**
 * Utilitário interno para extrair e somar modificadores de Runas e Perks.
 * @param {object} entity
 * @returns {{ runeMods: { flatAtk: number, percentHp: number }, perkMods: { flatAtk: number, percentHp: number } }}
 */
function extractModifiers(entity) {
  const runeMods = { flatAtk: 0, percentHp: 0 };
  const perkMods = { flatAtk: 0, percentHp: 0 };
  
  // --- Runas ---
  for (const s of ["core", "support", "burst"]) {
    const r = entity.runeSlots?.[s];
    if (!r || !r.modifiers) continue;
    
    for (const m of r.modifiers) {
      if (!m) continue;
      const scale = 1 + ((r.level || 1) - 1) * (m.scalePerLevel || 0);
      if (m.type === "flatAtk") runeMods.flatAtk += (m.value || 0) * scale;
      if (m.type === "percentHp") runeMods.percentHp += (m.value || 0) * scale;
    }
  }

  // --- Perks ---
  for (const p of entity.perks || []) {
    if (!p) continue;
    if (p.type === "flatAtk") perkMods.flatAtk += p.value || 0;
    if (p.type === "percentHp") perkMods.percentHp += p.value || 0;
    // Outros perks como "regen" ou "aura" são ignorados no recalculate stats, pois não afetam MaxHp/Attack.
  }
  
  return { runeMods, perkMods };
}

// ---------- FORMAT / UI ----------
/**
 * Formata as informações principais de uma carta/guardião para exibição.
 * @param {object} card - A instância da carta/guardião.
 * @returns {string} Informação formatada.
 */
export function formatCardInfo(card) {
  if (!card) return "Carta inexistente.";
  
  if (card.type === "guardian") {
    return `🛡️ Guardião ${card.name} (Lv ${card.level} - ${card.rarity}★)\nHP: ${card.guardianCurrentHp}/${card.guardianMaxHp}\nElemento: ${card.element}\nGrade: ${card.grade}\nEfeitos Passivos: ${(card.effects||[]).join(", ") || "Nenhum"}`;
  }
  
  if (card.type === "shard") {
    return `🧩 Fragmento de ${card.name} (${card.shardOf})\nQuantidade: ${card.quantity}/${card.shardsToCraft || 50}`;
  }
  
  const runes = card.runeSlots ? 
    Object.entries(card.runeSlots)
      .map(([k,v]) => v ? `${k}:${v.name}(lv${v.level})` : `${k}:vazio`)
      .join(" | ") 
    : "Nenhuma";
    
  const perks = card.perks?.length ? 
    card.perks.map(p => p.name || p.type).join(", ") 
    : "Nenhuma";
    
  const nextEvo = card.evolutionSteps?.[0];
  const evoStatus = nextEvo 
    ? `Próx: Lv ${nextEvo.levelReq || 10} (${nextEvo.cost}g)` 
    : "Concluída";

  return `📜 ${card.name} (Lv ${card.level})\nGrade: ${card.grade} | Elemento: ${card.element}\n❤️ HP: ${card.hp}/${card.maxHp} | ⚔️ ATK: ${card.attack}\nEfeitos: ${(card.effects||[]).join(", ") || "Nenhum"}\nRunas: ${runes}\nEvolução: ${evoStatus}\nPerks: ${perks}`;
}

// ---------- UTILITÁRIOS RÁPIDOS ----------
export function findUserCardByUnique(user, uid) {
  return user.cards?.find(c => c.uniqueId === uid) || null;
}

// ---------- GESTÃO DE SHARDS ----------
/**
 * Adiciona uma quantidade de Shards (Fragmentos) ao inventário do usuário.
 * @param {object} user - O objeto de usuário.
 * @param {string} cardId - O ID da carta que o shard representa.
 * @param {number} [quantity=1] - Quantidade a adicionar.
 * @returns {{ success: boolean, message: string }}
 */
export function addShardsToUser(user, cardId, quantity = 1) {
  if (quantity <= 0) return { success: false, message: "Quantidade inválida." };
  if (!user.cards) user.cards = [];
  
  const existingShard = user.cards.find(c => c.type === "shard" && c.shardOf === cardId);
  
  if (existingShard) {
    existingShard.quantity += quantity;
  } else {
    const newShard = createShard(cardId, quantity);
    if (!newShard) return { success: false, message: "Template de carta base para o shard não encontrado." };
    user.cards.push(newShard);
  }
  
  markUserDirty(user.id);
  const cardName = getCardTemplate(cardId)?.name || cardId;
  return { success: true, message: `Adicionados ${quantity} Shards de ${cardName}.` };
}

// export function giveShardToUser(user, cardId, quantity = 1) { return addShardsToUser(user, cardId, quantity); } // Alias removido, usar addShardsToUser

// ---------- GET RANDOM CARD BY RARITY ----------
/** * Obtém um ID de carta randômico pela raridade/nível.
 * @param {number} rarity - A raridade (ou level) desejada.
 * @param {object} [options={}] - Opções de filtro.
 * @param {boolean} [options.allowGuardians=false] - Incluir Guardiões na busca.
 * @param {string} [options.cardType] - Filtrar por tipo (e.g., "card", "p2w").
 * @returns {string} O ID da carta sorteada.
 */
export function getRandomCardIdByRarity(rarity, options = {}) {
  let list = getCardList(options);
  
  list = list.filter(c => {
    // Usa rarity para cards e level para guardians (ambos mapeados para .level no template)
    const itemRarity = c.rarity || c.level; 
    return itemRarity === rarity;
  });
  
  if (options.allowGuardians === false)
    list = list.filter(c => c.type !== "guardian");
  
  if (options.cardType)
    list = list.filter(c => c.type === options.cardType);
  
  if (!list.length) throw new Error(`Nenhuma carta R${rarity} encontrada com os filtros especificados.`);
  return list[Math.floor(Math.random() * list.length)].id;
}


// ---------- EXPORT DEFAULT (API do Módulo) ----------
export default {
  // Configurações e Meta
  GRADES,
  ELEMENTS,
  getGrade,
  getElement,
  cardDefinitions,
  guardianDefinitions,
  // Templates e Listas
  getCardTemplate,
  getCardList,
  // Fábricas (Internas, mas útil para testes)
  createNormalCard,
  createGuardian,
  // Operações de Usuário
  giveCardToUser,
  removeCardFromUser,
  findUserCardByUnique,
  // Stats e Modificadores
  applyGrowth,
  recalcCardStats,
  applyPerksToEntity,
  // Meld e Evolução
  tryMeld,
  calculateMeldCost,
  evolveCard,
  // Runas
  addRune,
  removeRune,
  upgradeRune,
  // Shards
  addShardsToUser,
  // Utilitários
  formatCardInfo,
  getRandomCardIdByRarity,
};