// src/systems/cardSystem.js
//------------------------------------------------------------
//  SISTEMA DE CARTAS — REESCRITO DO ZERO
//  Suporte completo para:
//  - Cartas normais
//  - Guardiões (G00 - G99)
//  - Shards (fragmentos de carta)
//  - Cartas P2W (Boosters VIP, cartas pagas, perks)
//------------------------------------------------------------

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";
import { markUserDirty } from "./userCacheSystem.js";
import { spendGold } from "./economySystem.js";

//------------------------------------------------------------
//  CARREGAR DEFINIÇÕES
//------------------------------------------------------------
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

//------------------------------------------------------------
//  CRIAR ÍNDICE PARA PERFORMANCE (100x mais rápido)
//------------------------------------------------------------
export const cardIndex = new Map();
for (const c of cardDefinitions) {
  cardIndex.set(c.id, c);
}

//------------------------------------------------------------
//  GETTERS
//------------------------------------------------------------
export function getCardTemplate(id) {
  return cardIndex.get(id);
}

export function getCardList() {
  return cardDefinitions;
}

//------------------------------------------------------------
//  CONSTRUTORES DE CARTA
//------------------------------------------------------------

function createBaseInstance(template) {
  return {
    uniqueId: uuidv4(),
    id: template.id,
    name: template.name,
    rarity: template.rarity ?? 1,
    type: template.type ?? "card",
    image: template.image || null,
    
    // progressão universal
    level: 1,
    xp: 0,
    xpToNext: 100, // pode ser alterado depois
  };
}

// ------------------ CARTA NORMAL ------------------
function createNormalCard(template) {
  return {
    ...createBaseInstance(template),
    
    hp: template.hp,
    attack: template.attack,
    effects: [...(template.effects || [])],
    
    // evolução
    unlockedEvolution: false,
    evolutionEffectId: template.evolutionEffectId || null,
    meldChance: 0,
    
    // runas
    runes: [],
  };
}

// ------------------ GUARDIÃO ------------------
function createGuardian(template) {
  return {
    ...createBaseInstance(template),
    isGuardian: true,
    
    guardianType: template.guardianType ?? "G00",
    guardianMaxHp: template.hp ?? 1000,
    guardianCurrentHp: template.hp ?? 1000,
    
    // guardiões não usam ataque, runas, evolução
    attack: 0,
    effects: [],
    runes: [],
    unlockedEvolution: false,
    evolutionEffectId: null,
  };
}

// ------------------ SHARD ------------------
function createShard(template) {
  return {
    ...createBaseInstance(template),
    shardOf: template.shardOf, // ID da carta original
    quantity: 1, // somável no inventário
  };
}

// ------------------ P2W / CARTAS PREMIUM ------------------
function createP2WCard(template) {
  return {
    ...createBaseInstance(template),
    hp: template.hp,
    attack: template.attack,
    effects: [...(template.effects || [])],
    perks: template.perks || [],
  };
}

//------------------------------------------------------------
//  FUNÇÃO PRINCIPAL PARA CRIAÇÃO
//------------------------------------------------------------
export function giveCardToUser(user, cardId) {
  const template = getCardTemplate(cardId);
  if (!template) return null;
  
  let instance;
  
  switch (template.type) {
    case "guardian":
      instance = createGuardian(template);
      break;
    case "shard":
      instance = createShard(template);
      break;
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
  
  return instance;
}

//------------------------------------------------------------
//  REMOVER CARTA
//------------------------------------------------------------
export function removeCardFromUser(user, uniqueId) {
  const index = user.cards.findIndex(c => c.uniqueId === uniqueId);
  if (index === -1) return { success: false, message: "Carta não encontrada." };
  
  const removed = user.cards.splice(index, 1)[0];
  markUserDirty(user.id);
  return { success: true, removedCard: removed };
}

//------------------------------------------------------------
//  MELD / EVOLUÇÃO
//------------------------------------------------------------
export function calculateMeldCost(card) {
  return Math.round(5000 * Math.pow(card.rarity, 2));
}

export function tryMeld(user, baseUid, donorUid) {
  const card = user.cards.find(c => c.uniqueId === baseUid);
  const donor = user.cards.find(c => c.uniqueId === donorUid);
  
  if (!card || !donor) return { success: false, message: "❌ Cartas inválidas." };
  if (card.type !== "card") return { success: false, message: "❌ Apenas cartas normais podem receber meld." };
  if (!card.unlockedEvolution) return { success: false, message: "🔒 Evolução ainda bloqueada." };
  if (donor.type !== "card") return { success: false, message: "❌ Apenas cartas podem doar efeitos." };
  
  const donorEffect = getCardTemplate(donor.id)?.evolutionEffectId;
  if (!donorEffect) return { success: false, message: "❌ Carta doadora não possui efeito de evolução." };
  
  if (card.effects.includes(donorEffect)) {
    return { success: false, message: "⚠️ Sua carta já possui esse efeito." };
  }
  
  const cost = calculateMeldCost(card);
  if (!spendGold(user, cost)) return { success: false, message: `❌ Ouro insuficiente (${cost}).` };
  
  const chance = Math.min(card.meldChance + 20, 100);
  const success = Math.random() * 100 < chance;
  
  // sempre consome
  removeCardFromUser(user, donorUid);
  
  if (success) {
    card.effects.push(donorEffect);
    card.meldChance = 0;
    markUserDirty(user.id);
    return { success: true, message: `🔥 Meld concluído! ${card.name} ganhou o efeito ${donorEffect}.` };
  } else {
    card.meldChance = chance;
    markUserDirty(user.id);
    return { success: false, message: `⚡ Falhou! Chance aumentou para ${chance}%.` };
  }
}

//------------------------------------------------------------
//  RUNAS
//------------------------------------------------------------
export function addRune(user, uid, rune) {
  const card = user.cards.find(c => c.uniqueId === uid);
  if (!card) return { success: false, message: "❌ Carta inexistente." };
  if (card.type !== "card") return { success: false, message: "❌ Apenas cartas aceitam runas." };
  
  if (card.runes.length >= 3) {
    return { success: false, message: "❌ Limite máximo de runas: 3." };
  }
  
  card.runes.push(rune);
  markUserDirty(user.id);
  return { success: true, message: `🔮 Runa aplicada em ${card.name}.` };
}

export function removeRune(user, uid, runeId) {
  const card = user.cards.find(c => c.uniqueId === uid);
  if (!card) return { success: false, message: "❌ Carta não existe." };
  
  const index = card.runes.findIndex(r => r.id === runeId);
  if (index === -1) return { success: false, message: "❌ Runa não encontrada." };
  
  const rune = card.runes.splice(index, 1)[0];
  markUserDirty(user.id);
  
  return { success: true, message: `💀 Runa removida (${rune.name}).` };
}

//------------------------------------------------------------
//  FORMATAÇÃO (INVENTÁRIO)
//------------------------------------------------------------
export function formatCardInfo(card) {
  if (card.type === "guardian") {
    return (
      `🛡️ **Guardião ${card.name}**\n` +
      `ID: ${card.id} (${card.guardianType})\n` +
      `❤️ HP: ${card.guardianCurrentHp}/${card.guardianMaxHp}\n`
    );
  }
  
  if (card.type === "shard") {
    return (
      `🧩 **Fragmento de Carta: ${card.shardOf}**\n` +
      `Quantidade: ${card.quantity}\n`
    );
  }
  
  const runes = card.runes?.length ? card.runes.map(r => r.name).join(", ") : "Nenhuma";
  
  return (
    `📜 **${card.name}** (Lv ${card.level})\n` +
    `⭐ Raridade: ${card.rarity}\n` +
    `❤️ HP: ${card.hp} | ⚔️ ATK: ${card.attack}\n` +
    `✨ Efeitos: ${card.effects.join(", ") || "Nenhum"}\n` +
    `🔮 Runas: ${runes}\n` +
    `🔓 Evolução: ${card.unlockedEvolution ? "Liberada" : "Bloqueada"}\n`
  );
}