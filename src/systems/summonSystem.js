// src/systems/summonSystem.js
//------------------------------------------------------------
//  SISTEMA DE INVOCAÇÃO — EXPANDIDO (CORRIGIDO)
//------------------------------------------------------------

import { 
  getCardTemplate, 
  giveCardToUser, 
  getCardList,
  addShardsToUser
} from "./cardSystem.js";

import { spendCurrency } from "./economySystem.js";
import { markUserDirty } from "./userCacheSystem.js";

// JSON imports ajustados para Node 20+
import altars from "../../data/altars.json" with { type: "json" };
import boosters from "../../data/boosters.json" with { type: "json" };

// ----------------------------------------------------
//  CONFIGURAÇÕES INICIAIS
// ----------------------------------------------------
const dropRatesBase = { 1: 45, 2: 30, 3: 15, 4: 7, 5: 3 };

const summonCosts = {
  gold:    { single: 5000, multi: 22500 },
  gems:    { single: 150,  multi: 675 },
  coupons: { single: 1,    multi: 5 },
};

// pity system configurável
const pityConfig = {
  pityMax: 50,
  pityIncrement: 0.3,
};

// rate-up configurável
const rateUpConfig = {
  active: false,
  rateUpId: null,
  rateUpBonus: 12,
};

export function getSummonLuck(user) {
  return user.summonLuck || 0;
}

export function increaseSummonLuck(user, amount) {
  user.summonLuck = Math.min(100, (user.summonLuck || 0) + amount);
  return user.summonLuck;
}

export function resetSummonLuck(user) {
  user.summonLuck = 0;
}

// ----------------------------------------------------
//  SALVAR HISTÓRICO DE SUMMON
// ----------------------------------------------------
function logSummon(user, cardId, rarity) {
  user.summonLog = user.summonLog || [];
  user.summonLog.push({ cardId, rarity, at: Date.now() });

  if (user.summonLog.length > 200) user.summonLog.shift();

  markUserDirty(user.id);
}

// ----------------------------------------------------
//  CALCULAR DROP RATES MODIFICADOS
// ----------------------------------------------------
function getDropRates(type, user, options = {}) {
  const rates = { ...dropRatesBase };

  if (options.altarId && altars[options.altarId]) {
    const altar = altars[options.altarId];
    for (const [rar, boost] of Object.entries(altar.dropBoost || {}))
      rates[rar] = (rates[rar] || 0) + boost;
  }

  user.pity = user.pity || 0;
  rates[5] += user.pity * pityConfig.pityIncrement;

  if (rateUpConfig.active) rates[5] += rateUpConfig.rateUpBonus;

  return rates;
}

// ----------------------------------------------------
//  PEGAR CARTA ALEATÓRIA POR RARIDADE
// ----------------------------------------------------
export function getRandomCardIdByRarity(rarity, options = {}) {
  const list = getCardList().filter(c => c.rarity === rarity);

  if (options.allowGuardians === false)
    list = list.filter(c => !c.isGuardian && c.type !== "guardian");

  if (options.cardType)
    list = list.filter(c => c.type === options.cardType);

  if (!list.length) throw new Error(`Nenhuma carta R${rarity}.`);
  return list[Math.floor(Math.random() * list.length)].id;
}

// ----------------------------------------------------
//  OUTRAS FUNÇÕES
// ----------------------------------------------------
export function altarJackpotRoll(user) {
  const luck = getSummonLuck(user);
  const chance = Math.min(5 + luck * 0.2, 40);
  const roll = Math.random() * 100;

  if (roll <= chance) {
    const cardId = getRandomCardIdByRarity(5); // 5★ = legendary
    return { jackpot: true, card: `🌟 Carta Lendária: **${cardId}**` };
  }

  increaseSummonLuck(user, -10);
  if (user.summonLuck < 0) user.summonLuck = 0;

  return { jackpot: false };
}

function determineRarity(type, user, options = {}) {
  const rates = getDropRates(type, user, options);
  const roll = Math.random() * 100;
  let cumulative = 0;

  for (let rarity = 1; rarity <= 5; rarity++) {
    cumulative += rates[rarity] || 0;
    if (roll <= cumulative) {
      if (rarity === 5) user.pity = 0;
      else user.pity++;
      return rarity;
    }
  }

  user.pity++;
  return 1;
}

function getAvailableCards(rarity, type, options = {}) {
  let list = getCardList().filter(c => c.rarity === rarity);

  if (options.allowGuardians === false)
    list = list.filter(c => !c.isGuardian && c.type !== "guardian");

  if (options.cardType)
    list = list.filter(c => c.type === options.cardType);

  return list;
}

function handleDuplicate(user, card) {
  if (card.type === "shard") return;

  const shards = Math.floor(10 + card.rarity * 5);
  addShardsToUser(user, card.id, shards);

  return `💠 Duplicata convertida em **${shards} shards** de ${card.name}!`;
}

export function summonCard(user, currency = "gold", options = {}) {
  const cost = summonCosts[currency]?.single || 0;

  if (!options.skipCost && cost > 0)
    if (!spendCurrency(user, currency, cost))
      return `💰 Você não tem ${cost} ${currency}.`;

  const rarity = determineRarity(currency, user, options);
  const pool = getAvailableCards(rarity, currency, options);
  if (!pool.length) return `⚠️ Nenhuma carta R${rarity}.`;

  let chosen;
  if (rateUpConfig.active && rarity === 5 && rateUpConfig.rateUpId && Math.random() < 0.55) {
    chosen = getCardTemplate(rateUpConfig.rateUpId);
  } else {
    chosen = pool[Math.floor(Math.random() * pool.length)];
  }

  const received = giveCardToUser(user, chosen.id);
  logSummon(user, chosen.id, rarity);

  let msg = `✨ Você invocou **${chosen.name}** (${rarity}★)!`;
  if (received.duplicate) msg += "\n" + handleDuplicate(user, chosen);

  if (options.giveShards && chosen.type !== "shard") {
    if (Math.random() < 0.12) {
      const shard = getCardList().find(c => c.type === "shard" && c.shardOf === chosen.id);
      if (shard) {
        giveCardToUser(user, shard.id);
        msg += `\n🔹 Fragmento bônus: **${shard.name}**`;
      }
    }
  }

  return msg;
}

export function summonMultiple(user, currency = "gold", count = 5, options = {}) {
  const cost = summonCosts[currency]?.multi;

  if (cost && !options.skipCost)
    if (!spendCurrency(user, currency, cost))
      return `💰 Você não tem ${cost} ${currency}.`;

  const results = [];
  for (let i = 0; i < count; i++)
    results.push(summonCard(user, currency, { ...options, skipCost: true }));

  return results.join("\n");
}

export function summonBooster(user, boosterId) {
  const booster = boosters.find(b => b.id === boosterId);
  if (!booster) return `❌ Booster inválido.`;

  const cost = booster.costGems || 675;
  if (!spendCurrency(user, "gems", cost)) return `💰 Sem gems.`;

  const received = new Set();
  const results = [];

  function addCard(cardId) {
    if (received.has(cardId)) return;
    received.add(cardId);

    const info = giveCardToUser(user, cardId);
    const card = getCardTemplate(cardId);

    if (info.duplicate) results.push(`${card.name} (Duplicata → Shards!)`);
    else results.push(card.name);
  }

  if (booster.themeCardId) addCard(booster.themeCardId);

  for (const id of booster.cardIds) {
    if (results.length >= (booster.maxCards || 5)) break;
    addCard(id);
  }

  return `🎁 Booster aberto!\n- ${results.join("\n- ")}`;
}