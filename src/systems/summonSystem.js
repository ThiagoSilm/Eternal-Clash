//------------------------------------------------------------
//  SISTEMA DE INVOCAÇÃO — COMPLETO E OTIMIZADO
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

// rate-up configurável por altar
const rateUpConfig = {
  active: true,
  rateUpBonus: 12, // % adicional no rate-up
};

// ----------------------------------------------------
//  FUNÇÕES DE SORTE
// ----------------------------------------------------
export function getSummonLuck(user) {
  return user.summonLuck || 0;
}

export function increaseSummonLuck(user, amount) {
  user.summonLuck = Math.min(100, Math.max(0, (user.summonLuck || 0) + amount));
  return user.summonLuck;
}

export function resetSummonLuck(user) {
  user.summonLuck = 0;
}

// ----------------------------------------------------
//  LOG DE INVOCAÇÃO
// ----------------------------------------------------
function logSummon(user, cardId, rarity) {
  user.summonLog = user.summonLog || [];
  user.summonLog.push({ cardId, rarity, at: Date.now() });

  if (user.summonLog.length > 200) user.summonLog.shift();

  markUserDirty(user.id);
}

// ----------------------------------------------------
//  DROP RATES MODIFICADOS
// ----------------------------------------------------
function getDropRates(type, user, options = {}) {
  const rates = { ...dropRatesBase };

  if (options.altarId && altars[options.altarId]) {
    const altar = altars[options.altarId];
    for (const [rar, boost] of Object.entries(altar.dropBoost || {}))
      rates[rar] = (rates[rar] || 0) + boost;

    if (altar.rateUpCardId) options.rateUpId = altar.rateUpCardId;
  }

  user.pity = user.pity || 0;
  rates[5] += Math.min(user.pity, pityConfig.pityMax) * pityConfig.pityIncrement;

  return rates;
}

// ----------------------------------------------------
//  PEGAR CARTA ALEATÓRIA POR RARIDADE
// ----------------------------------------------------
export function getRandomCardIdByRarity(rarity, options = {}) {
  let list = getCardList().filter(c => c.rarity === rarity);

  if (options.allowGuardians === false)
    list = list.filter(c => !c.isGuardian && c.type !== "guardian");

  if (options.cardType)
    list = list.filter(c => c.type === options.cardType);

  if (!list.length) throw new Error(`Nenhuma carta R${rarity}.`);
  return list[Math.floor(Math.random() * list.length)].id;
}

// ----------------------------------------------------
//  DETERMINAR RARIDADE
// ----------------------------------------------------
function determineRarity(type, user, options = {}) {
  const rates = getDropRates(type, user, options);
  const total = Object.values(rates).reduce((a, b) => a + b, 0);
  const roll = Math.random() * total;

  let cumulative = 0;
  for (let rarity = 1; rarity <= 5; rarity++) {
    cumulative += rates[rarity] || 0;
    if (roll <= cumulative) {
      if (rarity === 5) user.pity = 0;
      else user.pity++;
      increaseSummonLuck(user, 5); // aumenta a sorte a cada summon
      return rarity;
    }
  }

  user.pity++;
  increaseSummonLuck(user, 5);
  return 1;
}

// ----------------------------------------------------
//  LISTA DE CARTAS DISPONÍVEIS
// ----------------------------------------------------
function getAvailableCards(rarity, type, options = {}) {
  let list = getCardList().filter(c => c.rarity === rarity);

  if (options.allowGuardians === false)
    list = list.filter(c => !c.isGuardian && c.type !== "guardian");

  if (options.cardType)
    list = list.filter(c => c.type === options.cardType);

  return list;
}

// ----------------------------------------------------
//  DUPLICATAS
// ----------------------------------------------------
function handleDuplicate(user, card) {
  if (card.type === "shard") return;

  const shards = Math.floor(10 + card.rarity * 5);
  addShardsToUser(user, card.id, shards);

  return `💠 Duplicata convertida em **${shards} shards** de ${card.name}!`;
}

// ----------------------------------------------------
//  SUMMON INDIVIDUAL
// ----------------------------------------------------
export function summonCard(user, currency = "gold", options = {}) {
  if (!["gold", "gems", "coupons"].includes(currency))
    return `❌ Moeda inválida. Use gold, gems ou coupons.`;

  const cost = summonCosts[currency]?.single || 0;
  if (!options.skipCost && cost > 0)
    if (!spendCurrency(user, currency, cost))
      return `💰 Você não tem ${cost} ${currency}.`;

  const rarity = determineRarity(currency, user, options);
  const pool = getAvailableCards(rarity, currency, options);
  if (!pool.length) return `⚠️ Nenhuma carta R${rarity}.`;

  let chosen;
  if (rateUpConfig.active && rarity === 5 && options.rateUpId && Math.random() < 0.55)
    chosen = getCardTemplate(options.rateUpId);
  else
    chosen = pool[Math.floor(Math.random() * pool.length)];

  const received = giveCardToUser(user, chosen.id);
  logSummon(user, chosen.id, rarity);

  let msg = `✨ Você invocou **${chosen.name}** (${rarity}★) usando ${currency}!`;
  if (received.duplicate) msg += "\n" + handleDuplicate(user, chosen);

  return msg;
}

// ----------------------------------------------------
//  SUMMON MÚLTIPLO
// ----------------------------------------------------
export function summonMultiple(user, currency = "gold", count = 5, options = {}) {
  const results = [];
  const rarityCount = { 1:0,2:0,3:0,4:0,5:0 };

  for (let i = 0; i < count; i++) {
    const msg = summonCard(user, currency, { ...options, skipCost: true });
    results.push(msg);

    const match = msg.match(/\((\d)★\)/);
    if (match) rarityCount[match[1]]++;
  }

  const summary = `\n📊 Estatísticas: ${Object.entries(rarityCount).map(([r,c]) => `${r}★:${c}`).join(", ")}`;
  return results.join("\n") + summary;
}

// ----------------------------------------------------
//  JACKPOT DO ALTAR
// ----------------------------------------------------
export function altarJackpotRoll(user) {
  const luck = getSummonLuck(user);
  const chance = Math.min(5 + luck * 0.2, 40);
  const roll = Math.random() * 100;

  if (roll <= chance) {
    const cardId = getRandomCardIdByRarity(5); // 5★ = lendária
    increaseSummonLuck(user, -10);
    return { jackpot: true, card: `🌟 Carta Lendária: **${cardId}**` };
  }

  increaseSummonLuck(user, 5);
  return { jackpot: false };
}