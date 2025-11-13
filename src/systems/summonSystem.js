// src/systems/summonSystem.js
//------------------------------------------------------------
//  SISTEMA DE INVOCAÇÃO
//------------------------------------------------------------

import { 
  getCardTemplate, 
  giveCardToUser, 
  getCardList 
} from "./cardSystem.js";

import { spendCurrency } from "./economySystem.js";
import altars from "../../data/altars.json" assert { type: "json" };
import boosters from "../../data/boosters.json" assert { type: "json" };

// ----------------------------------------------------
//  CONFIGURAÇÕES
// ----------------------------------------------------
const dropRatesBase = { 1: 45, 2: 30, 3: 15, 4: 7, 5: 3 };

const summonCosts = {
  gold:    { single: 5000, multi: 22500 },
  gems:    { single: 150,  multi: 675 },
  coupons: { single: 1,    multi: 5 },
};

// ----------------------------------------------------
//  CALCULA DROP RATES COM BASE EM ALTAR / EVENTOS
// ----------------------------------------------------
function getDropRates(type, user, options = {}) {
  const rates = { ...dropRatesBase };

  // Boost de altar
  if (options.altarId && altars[options.altarId]) {
    const altar = altars[options.altarId];
    Object.entries(altar.dropBoost || {}).forEach(([rar, boost]) => {
      rates[rar] = (rates[rar] || 0) + boost;
    });
  }

  return rates;
}

// ----------------------------------------------------
//  DETERMINAR RARIDADE
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
//  FILTRAR CARTAS DISPONÍVEIS
// ----------------------------------------------------
function getAvailableCards(rarity, type, options = {}) {
  let list = getCardList().filter(c => c.rarity === rarity);

  // Excluir guardiões se não permitido
  if (options.allowGuardians === false) {
    list = list.filter(c => !c.isGuardian && c.type !== "guardian");
  }

  // Filtrar por tipo (normal, p2w, shard)
  if (options.cardType) {
    list = list.filter(c => c.type === options.cardType);
  }

  return list;
}

// ----------------------------------------------------
//  INVOCAR CARTA ÚNICA
// ----------------------------------------------------
export function summonCard(user, currency = "gold", options = {}) {
  const cost = summonCosts[currency]?.single || 0;

  if (!options.skipCost && cost > 0) {
    if (!spendCurrency(user, currency, cost)) {
      return `💰 Você não tem ${cost} ${currency} para invocar.`;
    }
  }

  const rarity = determineRarity(currency, user, options);
  const available = getAvailableCards(rarity, currency, options);

  if (!available.length) {
    return `⚠️ Nenhuma carta disponível na raridade ${rarity}★.`;
  }

  const chosen = available[Math.floor(Math.random() * available.length)];
  giveCardToUser(user, chosen.id);

  // Opções futuras: shards, fragmentos, p2w
  if (options.giveShards && chosen.type !== "shard") {
    // 10% chance de dropar fragmento
    if (Math.random() < 0.1) {
      const shard = getCardList().find(c => c.type === "shard" && c.shardOf === chosen.id);
      if (shard) giveCardToUser(user, shard.id);
    }
  }

  return `✨ Você invocou **${chosen.name}** (${rarity}★)!`;
}

// ----------------------------------------------------
//  INVOCAR MÚLTIPLAS CARTAS
// ----------------------------------------------------
export function summonMultiple(user, currency = "gold", count = 5, options = {}) {
  const cost = summonCosts[currency]?.multi;

  if (cost && !options.skipCost) {
    if (!spendCurrency(user, currency, cost)) {
      return `💰 Você não tem ${cost} ${currency} para invocação múltipla.`;
    }
  }

  const results = [];
  for (let i = 0; i < count; i++) {
    results.push(summonCard(user, currency, { ...options, skipCost: true }));
  }

  return results.join("\n");
}

// ----------------------------------------------------
//  BOOSTERS / PACOTES ESPECIAIS
// ----------------------------------------------------
export function summonBooster(user, boosterId) {
  const booster = boosters.find(b => b.id === boosterId);
  if (!booster) return `❌ Booster inválido.`;

  const BOOSTER_COST = booster.costGems || 675;
  if (!spendCurrency(user, "gems", BOOSTER_COST)) {
    return `💰 Você não tem ${BOOSTER_COST} gems para abrir o booster.`;
  }

  const received = new Set();
  const results = [];

  function addCard(cardId) {
    if (received.has(cardId)) return;
    received.add(cardId);
    const info = giveCardToUser(user, cardId);
    const card = getCardTemplate(cardId);
    results.push(card?.name || "Carta Desconhecida");
  }

  // Carta tema obrigatória
  if (booster.themeCardId) addCard(booster.themeCardId);

  // Outras cartas do pacote
  for (let id of booster.cardIds) {
    if (results.length >= (booster.maxCards || 5)) break;
    addCard(id);
  }

  return `🎁 Booster aberto! Você recebeu:\n- ${results.join("\n- ")}`;
}

// ----------------------------------------------------
//  SUPORTE: PEGAR ID ALEATÓRIO POR RARIDADE
// ----------------------------------------------------
export function getRandomCardIdByRarity(rarity, options = {}) {
  const list = getAvailableCards(rarity, null, options);
  if (!list.length) throw new Error(`Nenhuma carta da raridade ${rarity} disponível.`);
  return list[Math.floor(Math.random() * list.length)].id;
}