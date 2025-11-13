// src/systems/cardSystem.js

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from 'uuid'; 
// Importamos o markUserDirty para sinalizar que o objeto do usuário foi modificado
import { markUserDirty } from "./userCacheSystem.js"; 
// Importamos a função de economia, pois tryMeld precisa dela.
import { spendGold } from "./economySystem.js"; 

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 🔹 PONTO DE CARGA COERENTE COM SEU ARQUIVO DE DADOS
// Subir dois níveis: 'src/systems' -> 'src' -> '..' (data)
const CARD_DEFINITIONS_PATH = path.join(__dirname, "../../data/cards.json"); 

// 🔹 Carrega definições de cartas (o JSON que contém todas as cartas do jogo)
function loadCardDefinitions() {
  if (!fs.existsSync(CARD_DEFINITIONS_PATH)) fs.writeFileSync(CARD_DEFINITIONS_PATH, "[]");
  return JSON.parse(fs.readFileSync(CARD_DEFINITIONS_PATH, "utf-8"));
}

export const cardDefinitions = loadCardDefinitions(); 

// ------------------------------------
// 🔹 FUNÇÕES DE ACESSO A DEFINIÇÃO
// ------------------------------------

export function getCardTemplate(id) {
  return cardDefinitions.find(c => c.id === id);
}

export function getCardList() {
    return cardDefinitions;
}

// ------------------------------------
// 🔹 GESTÃO DE INSTÂNCIAS (Criação e Remoção)
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
  
  // 🟢 Sinaliza a modificação do usuário
  markUserDirty(user.id);
  
  return newCard;
}

/**
 * Remove uma carta pelo uniqueId do inventário do usuário.
 * 🎯 NOVA FUNÇÃO exigida pelo xpSystem.js (burnCardForXp)
 */
export function removeCardFromUser(user, cardUniqueId) {
    const cardIndex = user.cards.findIndex(c => c.uniqueId === cardUniqueId);
    
    if (cardIndex === -1) {
        return { success: false, message: "Carta não encontrada." };
    }
    
    const removedCard = user.cards.splice(cardIndex, 1)[0];
    
    // 🟢 Sinaliza a modificação do usuário
    markUserDirty(user.id);
    
    return { success: true, removedCard: removedCard };
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
 * Faz a fusão de duas cartas.
 */
export function tryMeld(user, baseUniqueId, donorUniqueId) {
  const cardIndex = user.cards.findIndex(c => c.uniqueId === baseUniqueId);
  const donorIndex = user.cards.findIndex(c => c.uniqueId === donorUniqueId);
  
  const card = user.cards[cardIndex];
  const donor = user.cards[donorIndex];
  
  if (!card || !donor) return { success: false, message: "❌ Carta base ou doadora inválida." };
  if (!card.unlockedEvolution) return { success: false, message: "⚠️ Essa carta ainda não evoluiu." };
  if (baseUniqueId === donorUniqueId) return { success: false, message: "❌ Não pode usar a mesma carta como doadora." };
  
  const donorEffectId = getCardTemplate(donor.id)?.evolutionEffectId;
  if (!donorEffectId) return { success: false, message: `❌ A carta doadora (${donor.name}) não possui efeito de evolução para meld.` };

  const goldCost = calculateMeldCost(card);
  
  // 🎯 CORREÇÃO: Usa spendGold com o objeto 'user'. Retorna objeto de erro se falhar.
  if (!spendGold(user, goldCost)) {
      return { success: false, message: `❌ Ouro insuficiente. Custo: ${goldCost}.` };
  }

  // Chance de sucesso e acúmulo
  if (card.meldChance === undefined) card.meldChance = 0;
  const successChance = Math.min(card.meldChance + 20, 100); 
  const success = Math.random() * 100 < successChance;
  
  // Remove a carta doadora do inventário (antes de marcar como dirty)
  const donorCardRemoved = removeCardFromUser(user, donorUniqueId);
  if (!donorCardRemoved.success) {
      // Isso nunca deve acontecer se o donorIndex foi encontrado antes, mas é um bom *guard*.
      return { success: false, message: "Erro interno: Falha ao remover a carta doadora." };
  }

  if (success) {
    if (!card.effects.includes(donorEffectId)) {
        card.effects.push(donorEffectId); 
    }
    
    card.meldChance = 0;
    // 🟢 O markUserDirty já foi chamado dentro de removeCardFromUser e será chamado em qualquer comando que faça I/O.
    return { success: true, message: `🔥 Meld bem-sucedido! ${card.name} agora possui o 4º efeito (ID: ${donorEffectId})!` };
  } else {
    card.meldChance = successChance;
    // 🟢 Sinaliza a modificação do usuário (meldChance mudou)
    markUserDirty(user.id);
    return { success: false, message: `⚡ Meld falhou! Chance aumentada para ${successChance}%.` };
  }
}

// ------------------------------------
// 🔹 GESTÃO DE RUNAS
// ------------------------------------

/**
 * Adiciona uma runa a uma carta.
 */
export function addRune(user, uniqueId, rune) {
    const card = user.cards.find(c => c.uniqueId === uniqueId);
    if (!card) return { success: false, message: "❌ Carta não encontrada." };
    
    if (!card.runes) card.runes = [];
    if (card.runes.length >= 3) return { success: false, message: "❌ Limite de 3 runas por carta." };
    card.runes.push(rune);
    
    // 🟢 Sinaliza a modificação do usuário
    markUserDirty(user.id);
    return { success: true, message: `🔮 Runa "${rune.name}" adicionada à carta ${card.name}.` };
}

/**
 * Remove uma runa de uma carta.
 */
export function removeRune(user, uniqueId, runeId) {
    const card = user.cards.find(c => c.uniqueId === uniqueId);
    if (!card) return { success: false, message: "❌ Carta não encontrada." };

    if (!card.runes) return { success: false, message: "⚠️ Essa carta não tem runas." };
    const index = card.runes.findIndex(r => r.id === runeId);
    if (index === -1) return { success: false, message: "❌ Runa não encontrada." };
    
    const removed = card.runes.splice(index, 1)[0];
    
    // 🟢 Sinaliza a modificação do usuário
    markUserDirty(user.id);
    return { success: true, message: `💀 Runa "${removed.name}" removida da carta ${card.name}.` };
}

// ------------------------------------
// 🔹 HELPER DE EXIBIÇÃO 
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
      // Não duplica se o efeito já foi fundido (Meld), mas o status está ativo.
      const evolutionEffectDisplay = card.effects.includes(template.evolutionEffectId) 
          ? `(Evoluída)` 
          : `(Evolução: [${template.evolutionEffectId}])`;
          
      effectsList += ` ${evolutionEffectDisplay}`;
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
