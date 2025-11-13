// src/systems/summonSystem.js

import { getCardTemplate, giveCardToUser, getCardList } from "./cardSystem.js";
import { spendCurrency } from "./economySystem.js";
import altars from "../../data/altars.json" with { type: "json" };
import boosters from "../../data/boosters.json" with { type: "json" };

// ----------------------------------------------------
// 🔹 CONFIGURAÇÕES
// ----------------------------------------------------
const dropRates = { 1: 45, 2: 30, 3: 15, 4: 7, 5: 3 }; // % de raridade
const summonCosts = {
  gold: { single: 5000, multi: 22500 },
  gems: { single: 150, multi: 675 },
  coupons: { single: 1, multi: 5 }
};

// ----------------------------------------------------
// 🔹 FUNÇÕES AUXILIARES
// ----------------------------------------------------
function determineRarity(type, user, options = {}) {
  // Exemplo: você pode colocar boost de altar ou eventos
  const roll = Math.random() * 100;
  let cumulative = 0;
  for (let rarity = 1; rarity <= 5; rarity++) {
    cumulative += dropRates[rarity] || 0;
    if (roll <= cumulative) return rarity;
  }
  return 1; // fallback
}

function getAvailableCardDefinitions(rarity, type, options = {}) {
  return getCardList().filter(c => c.rarity === rarity && (!type || c.type === type));
}

// ----------------------------------------------------
// 🔹 INVOCAR CARTA
// ----------------------------------------------------
export function summonCard(user, type = "gold", options = {}) {
  const cost = summonCosts[type]?.single || 0;
  if (cost > 0 && !spendCurrency(user, type, cost)) {
    return `💰 Você não tem ${cost} ${type} para invocar.`;
  }

  const rarity = determineRarity(type, user, options);
  const availableCards = getAvailableCardDefinitions(rarity, type, options);

  if (!availableCards.length) {
    return "⚠️ Nenhuma carta disponível nessa raridade.";
  }

  const chosen = availableCards[Math.floor(Math.random() * availableCards.length)];
  giveCardToUser(user, chosen.id);

  return `✨ Você invocou **${chosen.name}** (${rarity}★)!`;
}

// ----------------------------------------------------
// 🔹 INVOCAR VÁRIAS CARTAS
// ----------------------------------------------------
export function summonMultiple(user, type = "gold", count = 5, options = {}) {
  const multiCost = summonCosts[type]?.multi;
  if (multiCost && !spendCurrency(user, type, multiCost)) {
    return `💰 Você não tem ${multiCost} ${type} para invocação múltipla.`;
  }

  const results = [];
  for (let i = 0; i < count; i++) {
    // Invocação individual sem gastar novamente
    results.push(summonCard(user, type, { ...options, skipCost: true }));
  }

  return results.join("\n");
}

// ----------------------------------------------------
// 🔹 BOOSTERS
// ----------------------------------------------------
export function summonBooster(user, boosterId) {
  const booster = boosters.find(b => b.id === boosterId);
  if (!booster) return `❌ Booster inválido.`;

  const BOOSTER_COST = 675;
  if (!spendCurrency(user, "gems", BOOSTER_COST)) {
    return `💰 Você não tem ${BOOSTER_COST} gems para abrir o booster.`;
  }

  const receivedCards = [];

  // Carta tema
  const theme = getCardTemplate(booster.themeCardId);
  if (theme) receivedCards.push(giveCardToUser(user, theme.id));

  // Outras cartas
  for (let id of booster.cardIds) {
    if (receivedCards.length >= 5) break;
    const c = getCardTemplate(id);
    if (c) receivedCards.push(giveCardToUser(user, c.id));
  }

  const names = receivedCards.map(c => getCardTemplate(c.id)?.name || "Carta Desconhecida");
  return `🎁 Booster aberto! Você recebeu: ${names.join(", ")}`;
}

// ----------------------------------------------------
// 🔹 EXPORTS ADICIONAIS
// ----------------------------------------------------
export function getRandomCardIdByRarity(rarity) {
  const cards = getCardList().filter(c => c.rarity === rarity);
  if (!cards.length) throw new Error(`Nenhuma carta encontrada para raridade ${rarity}`);
  return cards[Math.floor(Math.random() * cards.length)].id;
}