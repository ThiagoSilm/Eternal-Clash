import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from 'uuid';
import { markUserDirty } from "./userCacheSystem.js";
import { spendGold } from "./economySystem.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CARD_DEFINITIONS_PATH = path.join(__dirname, "../../data/cards.json");

function loadCardDefinitions() {
  if (!fs.existsSync(CARD_DEFINITIONS_PATH)) fs.writeFileSync(CARD_DEFINITIONS_PATH, "[]");
  return JSON.parse(fs.readFileSync(CARD_DEFINITIONS_PATH, "utf-8"));
}

export const cardDefinitions = loadCardDefinitions();

export function getCardTemplate(id) {
  return cardDefinitions.find(c => c.id === id);
}

export function getCardList() {
  return cardDefinitions;
}

export function giveCardToUser(user, cardId) {
  const base = getCardTemplate(cardId);
  if (!base) return null;
  const newCard = {
    uniqueId: uuidv4(),
    level: 1,
    xp: 0,
    unlockedEvolution: false,
    runes: [],
    meldChance: 0,
    id: base.id,
    name: base.name,
    rarity: base.rarity,
    hp: base.hp,
    attack: base.attack,
    effects: [...(base.effects || [])],
    evolutionEffectId: base.evolutionEffectId || null,
    image: base.image || null,
    type: base.type || "card"
  };
  if (!user.cards) user.cards = [];
  user.cards.push(newCard);
  markUserDirty(user.id);
  return newCard;
}

export function removeCardFromUser(user, cardUniqueId) {
  const cardIndex = user.cards.findIndex(c => c.uniqueId === cardUniqueId);
  if (cardIndex === -1) return { success: false, message: "Carta não encontrada." };
  const removedCard = user.cards.splice(cardIndex, 1)[0];
  markUserDirty(user.id);
  return { success: true, removedCard };
}

export function calculateMeldCost(card) {
  const rarityFactor = Math.pow(card.rarity, 2);
  return Math.round(5000 * rarityFactor);
}

export function tryMeld(user, baseUniqueId, donorUniqueId) {
  const card = user.cards.find(c => c.uniqueId === baseUniqueId);
  const donor = user.cards.find(c => c.uniqueId === donorUniqueId);
  if (!card || !donor) return { success: false, message: "❌ Carta base ou doadora inválida." };
  if (!card.unlockedEvolution) return { success: false, message: "⚠️ Essa carta ainda não evoluiu." };
  if (baseUniqueId === donorUniqueId) return { success: false, message: "❌ Não pode usar a mesma carta como doadora." };
  
  const donorEffectId = getCardTemplate(donor.id)?.evolutionEffectId;
  if (!donorEffectId) return { success: false, message: `❌ A carta doadora (${donor.name}) não possui efeito de evolução.` };
  
  const goldCost = calculateMeldCost(card);
  if (!spendGold(user, goldCost)) return { success: false, message: `❌ Ouro insuficiente. Custo: ${goldCost}.` };
  
  if (card.meldChance === undefined) card.meldChance = 0;
  const successChance = Math.min(card.meldChance + 20, 100);
  const success = Math.random() * 100 < successChance;
  
  const donorCardRemoved = removeCardFromUser(user, donorUniqueId);
  if (!donorCardRemoved.success) return { success: false, message: "Erro interno: Falha ao remover a carta doadora." };
  
  if (success) {
    if (!card.effects.includes(donorEffectId)) card.effects.push(donorEffectId);
    card.meldChance = 0;
    return { success: true, message: `🔥 Meld bem-sucedido! ${card.name} agora possui o efeito (ID: ${donorEffectId})!` };
  } else {
    card.meldChance = successChance;
    markUserDirty(user.id);
    return { success: false, message: `⚡ Meld falhou! Chance aumentada para ${successChance}%.` };
  }
}

export function addRune(user, uniqueId, rune) {
  const card = user.cards.find(c => c.uniqueId === uniqueId);
  if (!card) return { success: false, message: "❌ Carta não encontrada." };
  if (!card.runes) card.runes = [];
  if (card.runes.length >= 3) return { success: false, message: "❌ Limite de 3 runas por carta." };
  card.runes.push(rune);
  markUserDirty(user.id);
  return { success: true, message: `🔮 Runa "${rune.name}" adicionada à carta ${card.name}.` };
}

export function removeRune(user, uniqueId, runeId) {
  const card = user.cards.find(c => c.uniqueId === uniqueId);
  if (!card || !card.runes) return { success: false, message: "❌ Carta ou runas não encontradas." };
  const index = card.runes.findIndex(r => r.id === runeId);
  if (index === -1) return { success: false, message: "❌ Runa não encontrada." };
  const removed = card.runes.splice(index, 1)[0];
  markUserDirty(user.id);
  return { success: true, message: `💀 Runa "${removed.name}" removida da carta ${card.name}.` };
}

export function formatCardInfo(card) {
  const runesText = card.runes?.length ? card.runes.map(r => `🔮 ${r.name}`).join(", ") : "Sem runas";
  const template = getCardTemplate(card.id);
  let effectsList = card.effects.map(e => `[${e}]`).join(", ");
  if (card.unlockedEvolution && template?.evolutionEffectId) {
    const evolutionEffectDisplay = card.effects.includes(template.evolutionEffectId) ? `(Evoluída)` : `(Evolução: [${template.evolutionEffectId}])`;
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