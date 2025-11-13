// src/systems/cardSystem.js

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from 'uuid'; 

// 🚨 CORREÇÃO 1: Remover I/O de usuário e spendGold não alinhado.
// ❌ REMOVIDO: import { loadUser, saveUserData } from "./userSystem.js";
// ❌ REMOVIDO: import { levelUpCard } from "./xpSystem.js"; (Não utilizada)
import { spendGold } from "./economySystem.js"; 

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 🔹 PONTO DE CARGA COERENTE COM SEU ARQUIVO DE DADOS
const CARD_DEFINITIONS_PATH = path.join(__dirname, "../../data/cards.json"); 

// 🔹 Carrega definições de cartas (o JSON que contém todas as cartas do jogo)
function loadCardDefinitions() {
  if (!fs.existsSync(CARD_DEFINITIONS_PATH)) fs.writeFileSync(CARD_DEFINITIONS_PATH, "[]");
  return JSON.parse(fs.readFileSync(CARD_DEFINITIONS_PATH, "utf-8"));
}

export const cardDefinitions = loadCardDefinitions(); 

// ------------------------------------
// 🔹 FUNÇÕES DE ACESSO A DEFINIÇÃO (Inalteradas)
// ------------------------------------

export function getCardTemplate(id) {
  return cardDefinitions.find(c => c.id === id);
}

export function getCardList() {
    return cardDefinitions;
}

// ------------------------------------
// 🔹 GESTÃO DE INSTÂNCIAS (Criação)
// ------------------------------------

// 🔹 Cria uma instância nova de carta pro usuário
export function giveCardToUser(user, cardId) {
  const base = getCardTemplate(cardId);
  if (!base) return null;
  
  const newCard = {
    // Campos Mutáveis
    uniqueId: uuidv4(), 
    level: 1, 
    xp: 0,
    unlockedEvolution: false,
    runes: [], 
    meldChance: 0, 
    
    // Campos Imutáveis (do Template)
    id: base.id, 
    name: base.name,
    rarity: base.rarity,
    hp: base.hp,
    attack: base.attack,
    effects: [...(base.effects || [])], 
    evolutionEffectId: base.evolutionEffectId || null, 
    image: base.image || null, 
    type: base.type || "card", 
  };
  
  if (!user.cards) user.cards = [];
  user.cards.push(newCard);
  
  return newCard;
}

// ------------------------------------
// 🔹 FUSÃO (Meld)
// ------------------------------------

// 🔹 Calcula custo de fusão (meld)
export function calculateMeldCost(card) {
  const rarityFactor = Math.pow(card.rarity, 2);
  return Math.round(5000 * rarityFactor); 
}

/**
 * Faz a fusão de duas cartas
 * 🎯 CORREÇÃO 2: Aceita o objeto 'user'
 */
export function tryMeld(user, baseUniqueId, donorUniqueId) {
  // ❌ REMOVIDO: const user = loadUser(userId);
  
  const cardIndex = user.cards.findIndex(c => c.uniqueId === baseUniqueId);
  const donorIndex = user.cards.findIndex(c => c.uniqueId === donorUniqueId);
  
  const card = user.cards[cardIndex];
  const donor = user.cards[donorIndex];
  
  if (!card || !donor) return "❌ Carta base ou doadora inválida.";
  if (!card.unlockedEvolution) return "⚠️ Essa carta ainda não evoluiu.";
  if (baseUniqueId === donorUniqueId) return "❌ Não pode usar a mesma carta como doadora.";
  
  const donorEffectId = getCardTemplate(donor.id)?.evolutionEffectId;
  if (!donorEffectId) return `❌ A carta doadora (${donor.name}) não possui efeito de evolução para meld.`;

  const goldCost = calculateMeldCost(card);
  
  // 🎯 CORREÇÃO 3: Usa spendGold com o objeto 'user'. Lança erro se falhar.
  try {
      if (!spendGold(user, goldCost)) return `❌ Ouro insuficiente. Custo: ${goldCost}.`; 
  } catch (e) {
      return `❌ Ouro insuficiente. Custo: ${goldCost}.`;
  }

  // Chance de sucesso e acúmulo
  if (card.meldChance === undefined) card.meldChance = 0;
  const successChance = Math.min(card.meldChance + 20, 100); 
  const success = Math.random() * 100 < successChance;
  
  if (success) {
    if (!card.effects.includes(donorEffectId)) {
        card.effects.push(donorEffectId); 
    }
    
    // Remove a carta doadora do inventário
    user.cards.splice(donorIndex, 1); 
    
    card.meldChance = 0;
    // ❌ REMOVIDO: saveUserData(user);
    return `🔥 Meld bem-sucedido! ${card.name} agora possui o 4º efeito (ID: ${donorEffectId})!`;
  } else {
    card.meldChance = successChance;
    // ❌ REMOVIDO: saveUserData(user);
    return `⚡ Meld falhou! Chance aumentada para ${successChance}%.`;
  }
}

// ------------------------------------
// 🔹 GESTÃO DE RUNAS
// ------------------------------------

/**
 * Adiciona uma runa a uma carta.
 * 🎯 CORREÇÃO 4: Aceita o objeto 'user'
 */
export function addRune(user, uniqueId, rune) {
    // ❌ REMOVIDO: const user = loadUser(userId);
    const card = user.cards.find(c => c.uniqueId === uniqueId);
    if (!card) return "❌ Carta não encontrada.";
    
    if (!card.runes) card.runes = [];
    if (card.runes.length >= 3) return "❌ Limite de 3 runas por carta.";
    card.runes.push(rune);
    
    // ❌ REMOVIDO: saveUserData(user);
    return `🔮 Runa "${rune.name}" adicionada à carta ${card.name}.`;
}

/**
 * Remove uma runa de uma carta.
 * 🎯 CORREÇÃO 5: Aceita o objeto 'user'
 */
export function removeRune(user, uniqueId, runeId) {
    // ❌ REMOVIDO: const user = loadUser(userId);
    const card = user.cards.find(c => c.uniqueId === uniqueId);
    if (!card) return "❌ Carta não encontrada.";

    if (!card.runes) return "⚠️ Essa carta não tem runas.";
    const index = card.runes.findIndex(r => r.id === runeId);
    if (index === -1) return "❌ Runa não encontrada.";
    
    const removed = card.runes.splice(index, 1)[0];
    
    // ❌ REMOVIDO: saveUserData(user);
    return `💀 Runa "${removed.name}" removida da carta ${card.name}.`;
}

// ------------------------------------
// 🔹 HELPER DE EXIBIÇÃO (Inalterado)
// ------------------------------------

export function formatCardInfo(card) {
  const runesText = card.runes?.length ?
    card.runes.map(r => `🔮 ${r.name}`).join(", ") :
    "Sem runas";
  
  const template = getCardTemplate(card.id);
  
  // Lista de IDs de efeitos
  let effectsList = card.effects.map(e => `[${e}]`).join(", ");
  
  // Adiciona o ID do efeito de evolução na exibição se a evolução estiver desbloqueada
  if (card.unlockedEvolution && template?.evolutionEffectId) {
      effectsList += ` (Evolução: [${template.evolutionEffectId}])`;
  }

  return (
    `📜 **${card.name}** (Lv. ${card.level})\n` +
    `⭐ Raridade: ${card.rarity} | Tipo: ${card.type}\n` +
    `❤️ HP: ${card.hp} | ⚔️ ATK: ${card.attack}\n` +
    `✨ Efeitos: ${effectsList}\n` +
    `🔓 Evolução: ${card.unlockedEvolution ? "Ativa" : "Bloqueada"}\n` +
    `🔮 Runas: ${runesText}`
  );
}
