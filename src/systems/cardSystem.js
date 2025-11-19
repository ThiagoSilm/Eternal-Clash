// src/systems/cardSystem.js
//------------------------------------------------------------
//  SISTEMA DE CARTAS/GUARDIÕES — EXPANSÃO E INTEGRAÇÃO
//------------------------------------------------------------
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";
import { markUserDirty } from "./userCacheSystem.js";
import { spendGold } from "./economySystem.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Caminhos de Dados ---
const CARD_DEFINITIONS_PATH = path.join(__dirname, "../../data/cards.json");
const GUARDIAN_DEFINITIONS_PATH = path.join(__dirname, "../../data/guardians.json"); // NOVO

// --- Carregamento de Dados ---
function loadDefinitions(filePath, defaultContent = "[]", entityName = "definições") {
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

// Cartas (c001, c002, etc.)
export const cardDefinitions = loadDefinitions(CARD_DEFINITIONS_PATH, "[]", "cards");
export const cardIndex = new Map();
for (const c of cardDefinitions) cardIndex.set(c.id, c);

// Guardiões (g001, g002, etc.)
export const guardianDefinitions = loadDefinitions(GUARDIAN_DEFINITIONS_PATH, "[]", "guardians"); // NOVO
export const guardianIndex = new Map(); // NOVO
for (const g of guardianDefinitions) guardianIndex.set(g.id, { ...g, type: "guardian" }); // Define type: "guardian"

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

// ---------- GETTERS (UNIFICADOS) ----------
/** Retorna o template de Carta ou Guardião pelo ID. */
export function getCardTemplate(id) { 
  return cardIndex.get(id) || guardianIndex.get(id) || null; 
}

/** Retorna a lista de Cartas ou a lista de Guardiões (se a opção for passada). */
export function getCardList(options = {}) { 
  if (options.includeGuardians) return [...cardDefinitions, ...guardianDefinitions];
  return cardDefinitions;
}

// ---------- BASE INSTANCE ----------
function createBaseInstance(template) {
  // Ajuste para usar 'level' para Guardiões e 'rarity' para Cartas normais
  const levelOrRarity = template.level ?? template.rarity ?? 1;
  const isGuardian = template.type === "guardian" || template.id.startsWith("g");

  return {
    uniqueId: uuidv4(),
    id: template.id,
    name: template.name,
    rarity: isGuardian ? levelOrRarity : levelOrRarity, // Manter o nome 'rarity' na instância para compatibilidade
    level: levelOrRarity, 
    grade: template.grade || "common",
    type: template.type ?? "card",
    image: template.image || null,
    element: template.element || template.faction || "neutral", // Guardião usa Faction como Element
    growth: template.growth ?? 0.05,
    growthCurve: template.growthCurve || "linear",
    xp: 0,
    xpToNext: template.xpToNext || 100,
    tags: template.tags || [],
  };
}

// ---------- FACTORIES ----------
function createNormalCard(template) {
  const base = createBaseInstance(template);
  // Nota: Cartas normais usam 'hp' e 'attack' do template
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
  // Guardiões usam 'maxHp' do template diretamente, sem growth (já está pré-calculado pelo level)
  const maxHpTemplate = template.maxHp || 1000;
  
  // Guardiões usam passives e effects do template (passives é a lista de efeitos passivos)
  const allEffects = [...(template.passive || []), ...(template.effects || [])]; 

  return {
    ...base,
    isGuardian: true,
    guardianLevel: template.level, // Novo campo para clareza
    guardianMaxHp: maxHpTemplate,
    guardianCurrentHp: maxHpTemplate,
    // Ataque/Habilidades são definidos em tempo real pelo sistema de combate (assumido)
    attack: 0, 
    effects: allEffects, 
    perks: template.perks || [], // Adiciona perks para compatibilidade
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
  
  // Checagem de duplicata
  let duplicate = false;
  if (template.type === "guardian") {
    // Lógica simples: Se o usuário já possui um guardião com este ID, é duplicata.
    duplicate = user.cards?.some(c => c.id === cardId && c.type === "guardian");
  }

  let instance;
  switch (template.type) {
    case "guardian": 
      // Não cria a instância se for duplicata (apenas retorna info, a lógica de shards fica no summon)
      if (duplicate) return { duplicate: true, instance: template };
      instance = createGuardian(template); 
      break;
    case "shard": 
      // Shards são adicionados via addShardsToUser, não via push
      return addShardsToUser(user, cardId, 1);
    case "p2w": 
      instance = createP2WCard(template); 
      break;
    default: 
      instance = createNormalCard(template); 
      break;
  }
  
  if (!user.cards) user.cards = [];
  user.cards.push(instance);
  markUserDirty(user.id);
  
  return { duplicate, instance }; // Retorna o status de duplicata
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
  // Guardiões não recebem meld
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
    // ... (restante da lógica de perks)
    if (p.type === "flatAtk") entity.attack = (entity.attack || 0) + (p.value || 0);
    if (p.type === "percentHp") {
      // Ajustar para Guardiões, usando guardianMaxHp
      const hpKey = entity.type === "guardian" ? "guardianMaxHp" : "maxHp";
      const currentHpKey = entity.type === "guardian" ? "guardianCurrentHp" : "hp";

      entity[hpKey] = Math.floor((entity[hpKey] || 1) * (1 + (p.value || 0)));
      entity[currentHpKey] = Math.min(entity[currentHpKey] || entity[hpKey], entity[hpKey]);
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
  if (!card || card.type === "guardian") return false; // Guardiões não evoluem via steps
  if (!card.evolutionSteps || !card.evolutionSteps.length) return false;
  const step = card.evolutionSteps[0];
  return (card.level || 1) >= (step.levelReq || 10);
}

export function evolveCard(user, uid) {
  const card = user.cards?.find(c => c.uniqueId === uid);
  if (!card) return { success: false, message: "Carta não encontrada." };
  if (card.type === "guardian") return { success: false, message: "Guardiões não usam o sistema de Evolução (Ascensão de Guardião é separada)." };
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
    return `🛡️ Guardião ${card.name} (Lv ${card.level} - ${card.rarity}★)\nHP: ${card.guardianCurrentHp}/${card.guardianMaxHp}\nElemento: ${card.element}\nGrade: ${card.grade}\nEfeitos Passivos: ${(card.effects||[]).join(", ") || "Nenhum"}`;
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
  
  if (card.type === "guardian") {
    // Guardiões não recalculam ATK/HP Base via growth, apenas via Perks/Runas.
    // Lógica simplificada: Apenas aplica Perks e Runas ao HP Máximo Base do Guardião
    let percentHpBonus = 0;
    
    // Runes & Perks HP Bonus (ATK é tipicamente 0, mas mantemos o código)
    card.runeSlots = card.runeSlots || { core: null, support: null, burst: null };
    for (const s of ["core","support","burst"]) {
      const r = card.runeSlots[s];
      if (!r || !r.modifiers) continue;
      for (const m of r.modifiers) {
        if (!m) continue;
        const scale = 1 + ((r.level || 1) - 1) * (m.scalePerLevel || 0);
        if (m.type === "percentHp") percentHpBonus += (m.value || 0) * scale;
      }
    }
    for (const p of card.perks || []) {
      if (p.type === "percentHp") percentHpBonus += p.value || 0;
    }
    
    // Reaplicar ao HP Base do Guardião
    const baseHpTemplate = getCardTemplate(card.id)?.maxHp || 1000;
    card.guardianMaxHp = Math.floor(baseHpTemplate * (1 + percentHpBonus));
    card.guardianCurrentHp = Math.min(card.guardianCurrentHp || card.guardianMaxHp, card.guardianMaxHp);
    return;
  }
  
  // Lógica para Cartas Normais
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
    // Tenta obter o template da carta para criar o shard
    const template = getCardTemplate(shardId); 
    if (!template) return null;
    const shard = createShard(template);
    shard.quantity = quantity;
    shard.shardOf = shardId; // Garante que o ID da carta esteja correto
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
/** Obtém um ID de carta randômico pela raridade/nível. */
export function getRandomCardIdByRarity(rarity, options = {}) {
  let list = getCardList().filter(c => {
    // Usa rarity para cards e level para guardians, se ambos estiverem no pool
    const itemRarity = c.rarity || c.level; 
    return itemRarity === rarity;
  });
  
  if (options.allowGuardians === false)
    list = list.filter(c => !c.id.startsWith("g"));
  
  if (options.cardType)
    list = list.filter(c => c.type === options.cardType);
  
  if (!list.length) throw new Error(`Nenhuma carta R${rarity}.`);
  return list[Math.floor(Math.random() * list.length)].id;
}

// ---------- NOVAS FUNÇÕES DE SHARD ----------
export function addShardsToUser(user, shardId, quantity = 1) {
  if (!user.cards) user.cards = [];
  const existing = user.cards.find(c => c.type === "shard" && c.shardOf === shardId);
  if (existing) {
    existing.quantity += quantity;
  } else {
    // Tenta obter o template da carta para criar o shard
    const template = getCardTemplate(shardId); 
    if (!template) return { success: false, message: "Template de carta base para o shard não encontrado." };

    const newShard = {
        uniqueId: uuidv4(),
        id: `shard_${shardId}`,
        name: `Shard de ${template.name}`,
        shardOf: shardId,
        quantity: quantity,
        type: "shard",
        rarity: template.rarity || 1,
        // Informações adicionais necessárias
        shardsToCraft: template.shardsToCraft || 50 // Assumindo custo base no template
    };
    user.cards.push(newShard);
  }

  markUserDirty(user.id);
  return { success: true, message: `Adicionados ${quantity} Shards de ${getCardTemplate(shardId)?.name || shardId}.` };
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
  getRandomCardIdByRarity,
  // Novos exports de dados
  cardDefinitions,
  guardianDefinitions,
  addShardsToUser
};
