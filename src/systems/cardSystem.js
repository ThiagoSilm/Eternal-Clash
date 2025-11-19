// src/systems/cardSystem.js
//------------------------------------------------------------
//  SISTEMA DE CARTAS — EXPANSÃO
//------------------------------------------------------------
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";
import { markUserDirty } from "./userCacheSystem.js";
import { spendGold } from "./economySystem.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CARD_DEFINITIONS_PATH = path.join(__dirname, "../../data/cards.json");

function loadCardDefinitions() {
  if (!fs.existsSync(CARD_DEFINITIONS_PATH)) {
    console.warn("cards.json não encontrado! Criando arquivo vazio.");
    fs.writeFileSync(CARD_DEFINITIONS_PATH, "[]");
  }
  try {
    const raw = fs.readFileSync(CARD_DEFINITIONS_PATH, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    console.error("Erro ao carregar cards.json:", err);
    return [];
  }
}
export const cardDefinitions = loadCardDefinitions();
export const cardIndex = new Map();
for (const c of cardDefinitions) cardIndex.set(c.id, c);

// ---------- META: grades & elements ----------
export const GRADES = {
  common: { multHp: 1, multAtk: 1, meldBonus: 0 },
  uncommon: { multHp: 1.08, multAtk: 1.06, meldBonus: 5 },
  rare: { multHp: 1.18, multAtk: 1.15, meldBonus: 10 },
  epic: { multHp: 1.35, multAtk: 1.3, meldBonus: 20 },
  mythical: { multHp: 1.5, multAtk: 1.45, meldBonus: 30 },
  legendary: { multHp: 1.8, multAtk: 1.7, meldBonus: 40 },
  relic: { multHp: 2.2, multAtk: 2.0, meldBonus: 60 },
};

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
export function applyGrowth(base, level, growth = 0.05, curve = "linear", grade = "common") {
  const g = Math.max(0, growth);
  if (curve === "linear") return Math.floor(base * (1 + (level - 1) * g) * gradeHpMult(grade));
  if (curve === "smooth") return Math.floor(base * Math.pow(1 + g, level - 1) * gradeHpMult(grade));
  if (curve === "aggressive") return Math.floor(base * (1 + (level - 1) * g * 1.6) * gradeHpMult(grade));
  return Math.floor(base * (1 + (level - 1) * g) * gradeHpMult(grade));
}

// ---------- GETTERS ----------
export function getCardTemplate(id) { return cardIndex.get(id) || null; }
export function getCardList() { return cardDefinitions; }

// ---------- BASE INSTANCE ----------
function createBaseInstance(template) {
  return {
    uniqueId: uuidv4(),
    id: template.id,
    name: template.name,
    rarity: template.rarity ?? 1,
    grade: template.grade || "common",
    type: template.type ?? "card",
    image: template.image || null,
    element: template.element || "neutral",
    growth: template.growth ?? 0.05,
    growthCurve: template.growthCurve || "linear",
    level: 1,
    xp: 0,
    xpToNext: template.xpToNext || 100,
    tags: template.tags || [],
  };
}

// ---------- FACTORIES ----------
function createNormalCard(template) {
  const base = createBaseInstance(template);
  const hp = applyGrowth(template.hp || 100, base.level, base.growth, base.growthCurve, base.grade);
  const attack = Math.floor((template.attack || 10) * (rarityMultiplier(base.grade)));
  return {
    ...base,
    hp,
    maxHp: hp,
    baseHp: template.hp || 100,
    attack,
    baseAttack: template.attack || 10,
    effects: [...(template.effects || [])],
    unlockedEvolution: !!template.unlockedEvolution,
    evolutionSteps: JSON.parse(JSON.stringify(template.evolutions || [])),
    meldChance: template.meldChance || 0,
    runeSlots: { core: null, support: null, burst: null },
    perks: template.perks || [],
  };
}

function createGuardian(template) {
  const base = createBaseInstance(template);
  const hp = applyGrowth(template.hp || 1000, base.level, base.growth, base.growthCurve, base.grade);
  return {
    ...base,
    isGuardian: true,
    guardianType: template.guardianType ?? "G00",
    guardianMaxHp: hp,
    guardianCurrentHp: hp,
    attack: template.attack || 0,
    effects: [...(template.effects || [])],
    perks: template.passives || [],
    runeSlots: { core: null, support: null, burst: null },
  };
}

function createShard(template) {
  const base = createBaseInstance(template);
  return {
    ...base,
    shardOf: template.shardOf,
    quantity: 1,
    type: "shard",
  };
}

function createP2WCard(template) {
  const card = createNormalCard(template);
  card.perks = template.perks || [];
  card.isP2W = true;
  return card;
}

// ---------- PUBLIC CREATION ----------
export function giveCardToUser(user, cardId) {
  const template = getCardTemplate(cardId);
  if (!template) return null;
  let instance;
  switch (template.type) {
    case "guardian": instance = createGuardian(template); break;
    case "shard": instance = createShard(template); break;
    case "p2w": instance = createP2WCard(template); break;
    default: instance = createNormalCard(template); break;
  }
  if (!user.cards) user.cards = [];
  user.cards.push(instance);
  markUserDirty(user.id);
  return instance;
}

// ---------- REMOVE ----------
export function removeCardFromUser(user, uniqueId) {
  if (!user.cards) return { success: false, message: "Nenhuma carta." };
  const idx = user.cards.findIndex(c => c.uniqueId === uniqueId);
  if (idx === -1) return { success: false, message: "Carta não encontrada." };
  const removed = user.cards.splice(idx, 1)[0];
  markUserDirty(user.id);
  return { success: true, removedCard: removed };
}

// ---------- MELD / EVOLUTION (improved) ----------
export function calculateMeldCost(card) {
  const gradeBonus = (card?.grade && GRADES[card.grade]) ? GRADES[card.grade].meldBonus || 0 : 0;
  const rarity = Math.max(1, card?.rarity || 1);
  return Math.round(3000 * Math.pow(rarity, 2) + gradeBonus * 50);
}

export function tryMeld(user, baseUid, donorUid) {
  const card = user.cards?.find(c => c.uniqueId === baseUid);
  const donor = user.cards?.find(c => c.uniqueId === donorUid);
  if (!card || !donor) return { success: false, message: "Cartas inválidas." };
  if (card.type !== "card") return { success: false, message: "Apenas cartas normais podem receber meld." };
  if (!card.unlockedEvolution) return { success: false, message: "Evolução bloqueada." };
  if (donor.type !== "card") return { success: false, message: "Carta doadora inválida." };
  const donorTemplate = getCardTemplate(donor.id);
  const donorEffect = donorTemplate?.evolutionEffectId;
  if (!donorEffect) return { success: false, message: "Doador sem efeito de evolução." };
  if ((card.effects || []).includes(donorEffect)) return { success: false, message: "Carta já possui o efeito." };

  const cost = calculateMeldCost(card);
  if (!spendGold(user, cost)) return { success: false, message: `Ouro insuficiente (${cost}).` };

  // chance logic
  const baseChance = Math.min((card.meldChance || 0) + (GRADES[card.grade]?.meldBonus || 0), 95);
  const roll = Math.random() * 100;
  // remove donor (consume) regardless of success
  const rem = removeCardFromUser(user, donorUid);
  if (!rem.success) return { success: false, message: "Falha ao consumir carta doadora." };

  if (roll < baseChance) {
    card.effects = [...new Set([...(card.effects || []), donorEffect])];
    card.meldChance = 0;
    markUserDirty(user.id);
    return { success: true, message: `Meld OK — ${card.name} recebeu ${donorEffect}.` };
  } else {
    card.meldChance = Math.min(99, (card.meldChance || 0) + 10);
    markUserDirty(user.id);
    return { success: false, message: `Falhou — chance agora ${card.meldChance}%.` };
  }
}

// ---------- RUNAS REWORK ----------
function validateRuneObject(rune) {
  if (!rune || typeof rune !== "object") return false;
  if (!rune.name || !rune.slot) return false;
  if (!["core", "support", "burst"].includes(rune.slot)) return false;
  // expected shape: { name, slot, modifiers: [{type:'flatAtk'|'percentHp', value:0.05}], level }
  return true;
}

export function addRune(user, uid, rune) {
  const card = user.cards?.find(c => c.uniqueId === uid);
  if (!card) return { success: false, message: "Carta inexistente." };
  if (!validateRuneObject(rune)) return { success: false, message: "Runa inválida." };
  const slot = rune.slot || "support";
  card.runeSlots = card.runeSlots || { core: null, support: null, burst: null };
  if (card.runeSlots[slot]) return { success: false, message: `Slot ${slot} ocupado.` };
  card.runeSlots[slot] = { ...rune, level: rune.level || 1 };
  markUserDirty(user.id);
  return { success: true, message: `Runa aplicada (${slot}) em ${card.name}.` };
}

export function removeRune(user, uid, slot) {
  const card = user.cards?.find(c => c.uniqueId === uid);
  if (!card) return { success: false, message: "Carta inexistente." };
  card.runeSlots = card.runeSlots || { core: null, support: null, burst: null };
  if (!card.runeSlots[slot]) return { success: false, message: "Slot vazio." };
  const removed = card.runeSlots[slot];
  card.runeSlots[slot] = null;
  markUserDirty(user.id);
  return { success: true, message: `Runa removida (${removed.name}).`, removedRune: removed };
}

export function upgradeRune(user, uid, slot, cost) {
  const card = user.cards?.find(c => c.uniqueId === uid);
  if (!card) return { success: false, message: "Carta inexistente." };
  const rune = card.runeSlots?.[slot];
  if (!rune) return { success: false, message: "Runa não encontrada." };
  if (!spendGold(user, cost)) return { success: false, message: "Ouro insuficiente." };
  rune.level = (rune.level || 1) + 1;
  markUserDirty(user.id);
  return { success: true, message: `Runa ${rune.name} upada para lv ${rune.level}.` };
}

// ---------- PERKS / PASSIVAS ----------
export function applyPerksToEntity(entity) {
  if (!entity || !entity.perks || !entity.perks.length) return;
  for (const p of entity.perks) {
    if (!p || !p.type) continue;
    if (p.type === "flatAtk") entity.attack = (entity.attack || 0) + (p.value || 0);
    if (p.type === "percentHp") {
      entity.maxHp = Math.floor((entity.maxHp || 1) * (1 + (p.value || 0)));
      entity.hp = Math.min(entity.hp || entity.maxHp, entity.maxHp);
    }
    if (p.type === "regen") { entity.regen = (entity.regen || 0) + (p.value || 0); }
    // aura example (apply if entity.team present)
    if (p.type === "aura" && entity.team && Array.isArray(entity.team)) {
      // aura object: { target: "ally", effect: { type, value } }
      for (const t of entity.team) {
        if (!t) continue;
        if (p.effect?.type === "flatAtk") t.attack = (t.attack || 0) + (p.effect.value || 0);
      }
    }
  }
}

// ---------- EVOLUÇÃO / ASCENSION ----------
export function canEvolve(card) {
  if (!card || !card.evolutionSteps || !card.evolutionSteps.length) return false;
  const step = card.evolutionSteps[0];
  return (card.level || 1) >= (step.levelReq || 10);
}

export function evolveCard(user, uid) {
  const card = user.cards?.find(c => c.uniqueId === uid);
  if (!card) return { success: false, message: "Carta não encontrada." };
  if (!card.evolutionSteps || !card.evolutionSteps.length) return { success: false, message: "Sem evolução disponível." };
  const step = card.evolutionSteps.shift();
  const cost = step.cost || Math.round(1000 * Math.pow(card.rarity || 1, 2));
  if (!spendGold(user, cost)) {
    // push step back
    card.evolutionSteps.unshift(step);
    return { success: false, message: `Ouro insuficiente (${cost}).` };
  }
  if (step.addEffects) card.effects = [...new Set([...(card.effects || []), ...step.addEffects])];
  if (step.increaseHp) { card.maxHp = (card.maxHp || 0) + step.increaseHp; card.hp = card.maxHp; }
  if (step.increaseAtk) card.attack = (card.attack || 0) + step.increaseAtk;
  if (step.upgradeGrade) card.grade = step.upgradeGrade;
  if (step.unlock) {
    if (step.unlock.evolution) card.unlockedEvolution = true;
  }
  markUserDirty(user.id);
  return { success: true, message: `${card.name} evoluiu!` };
}

// ---------- FORMAT / UI ----------
export function formatCardInfo(card) {
  if (!card) return "Carta inexistente.";
  if (card.type === "guardian") {
    return `🛡️ Guardião ${card.name} (Lv ${card.level})\nHP: ${card.guardianCurrentHp}/${card.guardianMaxHp}\nElemento: ${card.element}\nGrade: ${card.grade}`;
  }
  if (card.type === "shard") {
    return `🧩 Fragmento de ${card.shardOf}\nQuantidade: ${card.quantity}`;
  }
  const runes = card.runeSlots ? Object.entries(card.runeSlots).map(([k,v]) => v ? `${k}:${v.name}(lv${v.level})` : `${k}:empty`).join(" | ") : "Nenhuma";
  const perks = card.perks?.length ? card.perks.map(p => p.name || p.type).join(", ") : "Nenhuma";
  return `📜 ${card.name} (Lv ${card.level})\nGrade: ${card.grade} | Elemento: ${card.element}\n❤️ HP: ${card.hp}/${card.maxHp} | ⚔️ ATK: ${card.attack}\nEfeitos: ${(card.effects||[]).join(", ") || "Nenhum"}\nRunas: ${runes}\nPerks: ${perks}\nEvolução: ${card.evolutionSteps?.length ? `${card.evolutionSteps.length} steps` : "Nenhuma" }`;
}

// ---------- UTILITÁRIOS RÁPIDOS ----------
// recalcula stats quando level/grade/runas/perks mudam
export function recalcCardStats(card) {
  if (!card) return;
  // base hp/atk from template fallback
  card.baseHp = card.baseHp || (getCardTemplate(card.id)?.hp) || 100;
  card.baseAttack = card.baseAttack || (getCardTemplate(card.id)?.attack) || 10;

  card.maxHp = applyGrowth(card.baseHp, card.level || 1, card.growth || 0.05, card.growthCurve || "linear", card.grade || "common");
  // apply rune modifiers and perks
  let flatAtkBonus = 0;
  let percentHpBonus = 0;

  // runes
  card.runeSlots = card.runeSlots || { core: null, support: null, burst: null };
  for (const s of ["core","support","burst"]) {
    const r = card.runeSlots[s];
    if (!r || !r.modifiers) continue;
    for (const m of r.modifiers) {
      if (!m) continue;
      // modifiers: { type: 'flatAtk'|'percentHp', value: number, scalePerLevel: 0.1 }
      const scale = 1 + ((r.level || 1) - 1) * (m.scalePerLevel || 0);
      if (m.type === "flatAtk") flatAtkBonus += (m.value || 0) * scale;
      if (m.type === "percentHp") percentHpBonus += (m.value || 0) * scale;
    }
  }

  // perks that modify hp/atk
  for (const p of card.perks || []) {
    if (!p) continue;
    if (p.type === "flatAtk") flatAtkBonus += p.value || 0;
    if (p.type === "percentHp") percentHpBonus += p.value || 0;
  }

  card.maxHp = Math.floor(card.maxHp * (1 + percentHpBonus));
  card.hp = Math.min(card.hp || card.maxHp, card.maxHp);

  const baseAtkCalc = Math.floor((card.baseAttack || 10) * (rarityMultiplier(card.grade || "common")) * (1 + ((card.level || 1) - 1) * (card.growth || 0.05)));
  card.attack = Math.max(0, Math.floor(baseAtkCalc + flatAtkBonus));
}

// ---------- BACKWARDS-COMPATIBILITY HELPERS ----------
export function findUserCardByUnique(user, uid) {
  return user.cards?.find(c => c.uniqueId === uid) || null;
}

// ---------- NOVAS FUNÇÕES DE SHARD ----------
export function addShardsToUser(user, shardId, quantity = 1) {
  if (!user.cards) user.cards = [];
  const existing = user.cards.find(c => c.type === "shard" && c.shardOf === shardId);
  if (existing) {
    existing.quantity += quantity;
  } else {
    const template = getCardTemplate(shardId);
    if (!template) return null;
    const shard = createShard(template);
    shard.quantity = quantity;
    user.cards.push(shard);
  }
  markUserDirty(user.id);
  return true;
}

export function giveShardToUser(user, shardId, quantity = 1) {
  return addShardsToUser(user, shardId, quantity);
}

// --- ADICIONAR NO FINAL DE cardSystem.js ---
// ---------- GET RANDOM CARD BY RARITY ----------
export function getRandomCardIdByRarity(rarity, options = {}) {
  let list = getCardList().filter(c => c.rarity === rarity);
  
  if (options.allowGuardians === false)
    list = list.filter(c => !c.isGuardian && c.type !== "guardian");
  
  if (options.cardType)
    list = list.filter(c => c.type === options.cardType);
  
  if (!list.length) throw new Error(`Nenhuma carta R${rarity}.`);
  return list[Math.floor(Math.random() * list.length)].id;
}

// ---------- ATUALIZAÇÃO DO EXPORT DEFAULT ----------
export default {
  getCardTemplate,
  getCardList,
  giveCardToUser,
  removeCardFromUser,
  tryMeld,
  calculateMeldCost,
  addRune,
  removeRune,
  upgradeRune,
  evolveCard,
  formatCardInfo,
  recalcCardStats,
  applyPerksToEntity,
  findUserCardByUnique,
  applyGrowth,
  getElement,
  getGrade,
  addShardsToUser,
  giveShardToUser,
  getRandomCardIdByRarity // <<< adicionado
};