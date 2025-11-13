// src/systems/summonSystem.js

import { 
  getCardTemplate, 
  giveCardToUser, 
  getCardList 
} from "./cardSystem.js";

import { spendCurrency } from "./economySystem.js";

import altars from "../../data/altars.json" with { type: "json" };
import boosters from "../../data/boosters.json" with { type: "json" };

// ----------------------------------------------------
// 🔹 CONFIGURAÇÕES BÁSICAS
// ----------------------------------------------------
const dropRatesBase = { 1: 45, 2: 30, 3: 15, 4: 7, 5: 3 };

const summonCosts = {
  gold:    { single: 5000,  multi: 22500 },
  gems:    { single: 150,   multi: 675 },
  coupons: { single: 1,     multi: 5 },
};

// ----------------------------------------------------
// 🔹 CALCULAR DROP RATES (ALTARES, EVENTOS, ETC.)
// ----------------------------------------------------
function getDropRates(type, user, options) {
  let rates = { ...dropRatesBase };

  // Boost de altar (EXEMPLO)
  if (options.altarId && altars[options.altarId]) {
    const altar = altars[options.altarId];
    Object.entries(altar.dropBoost || {}).forEach(([rar, boost]) => {
      rates[rar] = (rates[rar] || 0) + boost;
    });
  }

  return rates;
}

// ----------------------------------------------------
// 🔹 DEFINIR RARIDADE
// ----------------------------------------------------
function determineRarity(type, user, options = {}) {
  const rates = getDropRates(type, user, options);
  const roll = Math.random() * 100;

  let cumulative = 0;
  for (let rarity = 1; rarity <= 5; rarity++) {
    cumulative += rates[rarity] || 0;
    if (roll <= cumulative) return rarity;
  }
  return 1;
}

// ----------------------------------------------------
// 🔹 LISTAR CARTAS DISPONÍVEIS
// ----------------------------------------------------
function getAvailableCards(rarity, type, options = {}) {
  let list = getCardList().filter(c => c.rarity === rarity);

  // Exemplo: evitar guardians quando rarity não for especial
  if (options.allowGuardians === false) {
    list = list.filter(c => !String(c.id).startsWith("G"));
  }

  // Tipo (caso futuro)
  if (type && type !== "gold" && type !== "gems" && type !== "coupons") {
    list = list.filter(c => c.type === type);
  }

  return list;
}

// ----------------------------------------------------
// 🔹 INVOCAR UMA CARTA
// ----------------------------------------------------
export function summonCard(user, type = "gold", options = {}) {
  const cost = summonCosts[type]?.single || 0;

  // Pagamento
  if (!options.skipCost && cost > 0) {
    if (!spendCurrency(user, type, cost)) {
      return `💰 Você não tem **${cost} ${type}** para invocar.`;
    }
  }

  const rarity = determineRarity(type, user, options);
  const available = getAvailableCards(rarity, type, options);

  if (!available.length) {
    return `⚠️ Nenhuma carta disponível na raridade **${rarity}★**.`;
  }

  // Escolher carta
  const chosen = available[Math.floor(Math.random() * available.length)];
  giveCardToUser(user, chosen.id);

  // Shards futuramente:
  // if (options.giveShards) ...

  return `✨ Você invocou **${chosen.name}** (${rarity}★)!`;
}

// ----------------------------------------------------
// 🔹 MULTI-SUMMON (5 OU 10)
// ----------------------------------------------------
export function summonMultiple(user, type = "gold", count = 5, options = {}) {
  const cost = summonCosts[type]?.multi;

  if (cost && !spendCurrency(user, type, cost)) {
    return `💰 Você não tem **${cost} ${type}** para invocação múltipla.`;
  }

  const results = [];
  for (let i = 0; i < count; i++) {
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

  const received = new Set();
  const results = [];

  function addCard(id) {
    if (received.has(id)) return;
    received.add(id);
    const info = giveCardToUser(user, id);
    const card = getCardTemplate(id);
    results.push(card?.name || "Carta Desconhecida");
  }

  // Carta tema obrigatória
  if (booster.themeCardId) addCard(booster.themeCardId);

  // Outras cartas
  for (let id of booster.cardIds) {
    if (results.length >= booster.maxCards || results.length >= 5) break;
    addCard(id);
  }

  return `🎁 Booster aberto! Você recebeu:\n- ${results.join("\n- ")}`;
}

// ----------------------------------------------------
// 🔹 FUNÇÃO DE SUPORTE GLOBAL
// ----------------------------------------------------
export function getRandomCardIdByRarity(rarity) {
  const cards = getCardList().filter(c => c.rarity === rarity);
  if (!cards.length) throw new Error(`Nenhuma carta da raridade ${rarity}.`);
  return cards[Math.floor(Math.random() * cards.length)].id;
}