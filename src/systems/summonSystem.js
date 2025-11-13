// src/systems/summonSystem.js
import { getCardTemplate, giveCardToUser } from "./cardSystem.js";
import { saveUser } from "./economySystem.js";
import altars from "../data/altars.json" with { type: "json" };
import boosters from "../data/boosters.json" with { type: "json" };

// Taxas de drop por raridade (em %)
const dropRates = {
  1: 45, // Comum
  2: 30, // Incomum
  3: 15, // Rara
  4: 7,  // Épica
  5: 3   // Lendária
};

// Preços de invocação
const summonCosts = {
  gold: { single: 5000, multi: 22500 },  // ouro
  gems: { single: 150, multi: 675 },     // gemas
  coupons: { single: 1, multi: 5 }       // cupons
};

// Calcula a força do deck do usuário (soma dos ataques base)
function calculateUserDeckForce(user) {
  if (!user.decks || !user.decks.main) return 0;
  return user.decks.main.reduce((acc, card) => acc + (card.attack || 0), 0);
}

/**
 * Sorteia a raridade de uma carta baseada na força do deck vs força do maze
 */
function determineRarity(type, user, options = {}) {
  if (type === "mazeBoss") {
    const mapForce = options.mapForce || 1;
    const userForce = calculateUserDeckForce(user);
    const baseChance = 10 + Math.min(40, ((userForce / mapForce) * 50));
    const roll = Math.random() * 100;
    return roll <= baseChance ? 5 : (roll <= baseChance + 20 ? 4 : 3);
  } else {
    const roll = Math.random() * 100;
    let accumulated = 0;
    for (const [r, rate] of Object.entries(dropRates)) {
      accumulated += rate;
      if (roll <= accumulated) return parseInt(r);
    }
    return 1;
  }
}

/**
 * Filtra cartas disponíveis por raridade, tipo e boosters/altar
 */
function getAvailableCards(rarity, type, options = {}) {
  const allCards = [];
  for (let id = 1; id <= 999; id++) {
    const card = getCardTemplate(id);
    if (!card) continue;
    // Filtros por summon type
    if (type === "mazeBoss" && !card.isMazeReward) continue;
    if (type === "gems" || type === "gold" || type === "coupons") {
      // nada específico aqui, apenas raridade
    }
    if (card.rarity === rarity) allCards.push(card);
  }
  return allCards;
}

/**
 * Invoca cartas (1 ou múltiplas) por tipo
 */
export function summonCard(user, type = "gold", options = {}) {
  const cost = summonCosts[type]?.single;
  if (!cost) return "❌ Tipo de invocação inválido.";

  // Checa recursos
  if (type === "gold" && user.gold < cost) return "💰 Ouro insuficiente.";
  if (type === "gems" && user.gems < cost) return "💎 Gemas insuficientes.";
  if (type === "coupons" && user.coupons < cost) return "🎟️ Cupom insuficiente.";

  // Cobra custo
  if (type === "gold") user.gold -= cost;
  else if (type === "gems") user.gems -= cost;
  else if (type === "coupons") user.coupons -= cost;

  const rarity = determineRarity(type, user, options);
  const available = getAvailableCards(rarity, type, options);
  if (available.length === 0) return "⚠️ Nenhuma carta disponível nessa raridade.";

  // Carta aleatória
  const chosen = available[Math.floor(Math.random() * available.length)];
  giveCardToUser(user, chosen.id);
  saveUser(user);

  return `✨ Você recebeu **${chosen.name}** (${rarity}★)!`;
}

/**
 * Invoca múltiplas cartas
 */
export function summonMultiple(user, type = "gold", count = 5, options = {}) {
  const results = [];
  const multiCost = summonCosts[type]?.multi || 0;
  if (multiCost && ((type === "gold" && user.gold < multiCost) || (type === "gems" && user.gems < multiCost) || (type === "coupons" && user.coupons < multiCost))) {
    return `❌ Recursos insuficientes para invocação múltipla de ${type}.`;
  }
  // Cobra custo
  if (multiCost) {
    if (type === "gold") user.gold -= multiCost;
    else if (type === "gems") user.gems -= multiCost;
    else if (type === "coupons") user.coupons -= multiCost;
  }

  for (let i = 0; i < count; i++) {
    results.push(summonCard(user, type, options));
  }
  return results.join("\n");
}

/**
 * Invoca um booster
 */
export function summonBooster(user, boosterId) {
  const booster = boosters.find(b => b.id === boosterId);
  if (!booster) return "❌ Booster inválido.";

  // Cobra 675 gemas
  if (user.gems < 675) return "💎 Gemas insuficientes.";
  user.gems -= 675;

  const cards = [];
  // Garante 1 carta tema de 4-5★
  const themeCard = getCardTemplate(booster.themeCardId);
  cards.push(giveCardToUser(user, themeCard.id));

  // Sorteia o restante
  for (let id of booster.cardIds) {
    const card = getCardTemplate(id);
    if (card) cards.push(giveCardToUser(user, card.id));
    if (cards.length >= 5) break;
  }

  saveUser(user);
  return `🎁 Booster aberto! Você recebeu: ${cards.map(c => c.name).join(", ")}`;
}