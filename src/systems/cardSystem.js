// src/systems/cardSystem.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const templatesPath = path.join(__dirname, "../data/cardTemplates.json");

// Carrega os templates de cartas
function loadTemplates() {
  if (!fs.existsSync(templatesPath)) fs.writeFileSync(templatesPath, "[]");
  return JSON.parse(fs.readFileSync(templatesPath));
}

const templates = loadTemplates();

export function getCardTemplate(id) {
  return templates.find(c => c.id === id);
}

/**
 * Dá uma carta ao usuário com base no template.
 */
export function giveCardToUser(user, cardId) {
  const base = getCardTemplate(cardId);
  if (!base) return null;
  
  const newCard = {
    id: base.id,
    name: base.name,
    level: 1,
    xp: 0,
    rarity: base.rarity,
    hp: base.hp,
    attack: base.attack,
    effects: base.effects,
    evolutionEffect: base.evolutionEffect,
    unlockedEvolution: false,
  };
  
  if (!user.cards) user.cards = [];
  user.cards.push(newCard);
  
  return newCard;
}

/**
 * Adiciona XP à carta e desbloqueia evolução se atingir o limite.
 */
export function addCardXp(card, amount) {
  card.xp += amount;
  const base = getCardTemplate(card.id);
  
  const needed = base.xpToLevel || 100; // fallback de segurança
  if (card.xp >= needed && !card.unlockedEvolution) {
    card.unlockedEvolution = true;
    return `🌟 ${card.name} evoluiu e desbloqueou o 4º efeito: ${card.evolutionEffect}!`;
  }
  
  return null;
}

/**
 * Calcula o custo de meld (fusão) baseado na raridade.
 */
export function calculateMeldCost(card) {
  const rarityFactor = Math.pow(card.rarity, 2);
  return Math.round(5000 * rarityFactor);
}

/**
 * Tenta fundir duas cartas (meld).
 */
export function tryMeld(user, cardIndex, donorIndex) {
  const card = user.cards[cardIndex];
  const donor = user.cards[donorIndex];
  
  if (!card || !donor) return "❌ Índices inválidos.";
  if (!card.unlockedEvolution) return "⚠️ Essa carta ainda não evoluiu.";
  if (cardIndex === donorIndex) return "❌ Não pode usar a mesma carta como doadora.";
  
  const goldCost = calculateMeldCost(card);
  if (user.gold < goldCost) return "❌ Ouro insuficiente.";
  
  // Define chance de sucesso
  if (card.meldChance === undefined) card.meldChance = 0;
  const successChance = card.meldChance + 20;
  const success = Math.random() * 100 < successChance;
  
  user.gold -= goldCost;
  
  if (success) {
    card.effects[3] = donor.evolutionEffect;
    user.cards.splice(donorIndex, 1); // remove carta doadora
    card.meldChance = 0;
    return `🔥 Meld bem-sucedido! ${card.name} agora possui o 4º efeito "${donor.evolutionEffect}"!`;
  } else {
    card.meldChance = successChance;
    return `⚡ Meld falhou! Chance aumentada para ${successChance}%.`;
  }
}