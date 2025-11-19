//------------------------------------------------------------
//  SISTEMA DE INVOCAÇÃO — OTIMIZADO E BLINDADO
//------------------------------------------------------------

import {
  getCardTemplate,
  giveCardToUser,
  getCardList,
  addShardsToUser,
} from "./cardSystem.js";


import { spendCurrency } from "./economySystem.js";
import { markUserDirty } from "./userCacheSystem.js";

// === NOVAS DEPENDÊNCIAS DE GUARDIÕES (ASSUMIDAS) ===
// Nota: 'guardiansData' deve ser importado de ../data/guardians.json
import guardiansData from "../../data/guardians.json" with { type: "json" }; 

// Mock: Assume-se que estas funções existem ou serão criadas
function getGuardianList() { return guardiansData; }
function getGuardianTemplate(id) { return guardiansData.find(g => g.id === id); }
function giveGuardianToUser(user, guardianId) { 
  // Implementação de concessão/duplicata de Guardião
  return { duplicate: false, granted: true }; 
}
function handleGuardianDuplicate(user, guardian) {
  const shards = Math.floor(50 + guardian.level * 10);
  // addSpecialShardsToUser(user, guardian.id, shards);
  return `💠 Duplicata convertida em **${shards} shards** de Guardião de ${guardian.name}!`;
}
// ===================================================

import altars from "../../data/altars.json" with { type: "json" };
import boosters from "../../data/boosters.json" with { type: "json" };

// ----------------------------------------------
// CONFIGURAÇÕES
// ----------------------------------------------
const dropRatesBase = { 1: 45, 2: 30, 3: 15, 4: 7, 5: 3 };

export const summonCosts = {
  gold: { single: 5000, multi: 22500 },
  gems: { single: 150, multi: 675 },
  coupons: { single: 1, multi: 5 },
  // NOVO ALTAR DE GUARDIÃO: 300 gemas por uma chance.
  guardian: { single: 300, currency: "gems" }, 
};

const pityConfig = { pityMax: 50, pityIncrement: 0.3 };
const rateUpConfig = { active: true, rateUpBonus: 12 };

// ----------------------------------------------
// UTILITÁRIOS DE SORTE
// ----------------------------------------------
export const getSummonLuck = user => user.summonLuck || 0;

export function increaseSummonLuck(user, amount) {
  user.summonLuck = Math.min(100, Math.max(0, (user.summonLuck || 0) + amount));
  markUserDirty(user.id);
  return user.summonLuck;
}

export function resetSummonLuck(user) {
  user.summonLuck = 0;
  markUserDirty(user.id);
}

// ----------------------------------------------
// LOG
// ----------------------------------------------
function logSummon(user, itemId, rarity) {
  if (!user.summonLog) user.summonLog = [];
  user.summonLog.push({ itemId, rarity, at: Date.now() });
  if (user.summonLog.length > 200) user.summonLog.shift();
  markUserDirty(user.id);
}

// ----------------------------------------------
// DROP RATES (COM PITY + ALTAR)
// ----------------------------------------------
function getDropRates(type, user, options = {}) {
  const rates = { ...dropRatesBase };

  if (options.altarId && altars[options.altarId]) {
    const altar = altars[options.altarId];
    for (const [rar, boost] of Object.entries(altar.dropBoost || {}))
      rates[rar] += boost;
    if (altar.rateUpCardId) options.rateUpId = altar.rateUpCardId;
  }

  user.pity = user.pity || 0;
  const pity = Math.min(user.pity, pityConfig.pityMax);
  rates[5] += pity * pityConfig.pityIncrement;

  return rates;
}

// ----------------------------------------------
// CARTA/GUARDIÃO RANDÔMICO
// ----------------------------------------------
/** Obtém um ID de carta/guardião pelo nível/raridade. */
export function getItemIdByRarity(rarity, pool, options = {}) {
    const items = pool.filter(c => {
        // Para cartas, usa 'rarity'. Para guardiões, usa 'level'.
        const itemRarity = c.rarity || c.level; 
        if (itemRarity !== rarity) return false;
        if (options.cardType && c.type !== options.cardType) return false;
        return true;
    });

    if (!items.length) throw new Error(`Nenhum item R${rarity}.`);
    return items[Math.floor(Math.random() * items.length)].id;
}


// ----------------------------------------------
// DEFINIR RARIDADE (CARTAS)
// ----------------------------------------------
function determineRarity(type, user, options = {}) {
  const rates = getDropRates(type, user, options);
  const total = Object.values(rates).reduce((a, b) => a + b, 0);

  let r = Math.random() * total;
  for (let rar = 1; rar <= 5; rar++) {
    r -= rates[rar];
    if (r <= 0) {
      if (rar === 5) user.pity = 0;
      else user.pity++;
      increaseSummonLuck(user, 5);
      return rar;
    }
  }

  user.pity++;
  increaseSummonLuck(user, 5);
  return 1;
}

// ----------------------------------------------
// DEFINIR NÍVEL (GUARDIÕES)
// ----------------------------------------------
function determineGuardianLevel(user) {
  // Guardiões usam a mesma base de drop rate e o mesmo sistema de Pity
  const rates = getDropRates("guardian", user); 
  const total = Object.values(rates).reduce((a, b) => a + b, 0);

  let r = Math.random() * total;
  for (let level = 1; level <= 5; level++) {
    r -= rates[level];
    if (r <= 0) {
      if (level === 5) user.pity = 0; // Pity reseta no 5 Estrelas
      else user.pity++;
      increaseSummonLuck(user, 5);
      return level;
    }
  }

  user.pity++;
  increaseSummonLuck(user, 5);
  return 1;
}

// ----------------------------------------------
// DUPLICATAS -> SHARDS (CARTAS)
// ----------------------------------------------
function handleDuplicate(user, card) {
  const shards = Math.floor(10 + card.rarity * 5);
  addShardsToUser(user, card.id, shards);
  return `💠 Duplicata convertida em **${shards} shards** de ${card.name}!`;
}

// ----------------------------------------------
// SUMMON INDIVIDUAL (CARTAS)
// ----------------------------------------------
export function summonCard(user, currency = "gold", options = {}) {
  if (!summonCosts[currency]) return "❌ Moeda inválida.";

  const cost = summonCosts[currency].single;
  if (!options.skipCost && !spendCurrency(user, currency, cost))
    return `💰 Você não tem ${cost} ${currency}.`;

  const rarity = determineRarity(currency, user, options);
  const pool = getAvailableCards(rarity, currency, options);
  if (!pool.length) return `⚠️ Nenhuma carta R${rarity}.`;

  let chosen;
  if (
    rateUpConfig.active &&
    rarity === 5 &&
    options.rateUpId &&
    Math.random() < 0.55
  ) {
    chosen = getCardTemplate(options.rateUpId);
  } else {
    chosen = pool[Math.floor(Math.random() * pool.length)];
  }

  const received = giveCardToUser(user, chosen.id);
  logSummon(user, chosen.id, rarity);

  let msg = `✨ Você invocou **${chosen.name}** (${rarity}★) usando ${currency}!`;
  if (received.duplicate) msg += "\n" + handleDuplicate(user, chosen);

  return msg;
}

// ----------------------------------------------
// SUMMON GUARDIÃO (NOVO ALTAR)
// ----------------------------------------------
export function summonGuardian(user) {
  const config = summonCosts.guardian;
  const cost = config.single;
  const currency = config.currency; // "gems"

  if (!spendCurrency(user, currency, cost))
    return `💰 Você não tem ${cost} ${currency}.`;

  const level = determineGuardianLevel(user);
  const guardianId = getItemIdByRarity(level, getGuardianList());
  const guardian = getGuardianTemplate(guardianId);

  const received = giveGuardianToUser(user, guardian.id);
  logSummon(user, guardian.id, level);

  let msg = `🔥 Guardião Invocado! Você recebeu **${guardian.name}** (${level}★) por ${cost} ${currency}.`;
  
  if (received.duplicate) msg += "\n" + handleGuardianDuplicate(user, guardian);

  return msg;
}


// ----------------------------------------------
// LISTA (DEPOIS DO summonCard)
// ----------------------------------------------
function getAvailableCards(rarity, type, options) {
  return getCardList().filter(c => {
    if (c.rarity !== rarity) return false;
    if (options.allowGuardians === false && (c.isGuardian || c.type === "guardian")) return false;
    if (options.cardType && c.type !== options.cardType) return false;
    return true;
  });
}

// ----------------------------------------------
// SUMMON MÚLTIPLO
// ----------------------------------------------
export function summonMultiple(user, currency = "gold", count = 5, options = {}) {
  const results = [];
  const rarCount = { 1:0,2:0,3:0,4:0,5:0 };

  for (let i = 0; i < count; i++) {
    // Note: Esta função ainda chama summonCard, não summonGuardian
    const msg = summonCard(user, currency, { ...options });
    if (msg.startsWith("💰 Você não tem")) break;

    results.push(msg);
    const rar = msg.match(/\((\d)★\)/);
    if (rar) rarCount[rar[1]]++;
  }

  const summary =
    `\n📊 Estatísticas: ` +
    Object.entries(rarCount).map(([r,c]) => `${r}★:${c}`).join(", ");

  return results.join("\n") + summary;
}

// ----------------------------------------------
// JACKPOT DO ALTAR
// ----------------------------------------------
export function altarJackpotRoll(user) {
  const luck = getSummonLuck(user);
  const chance = Math.min(5 + luck * 0.2, 40);

  if (Math.random() * 100 <= chance) {
    // Altera para usar a função genérica de busca de ID, mas usando a lista de cartas
    const cardId = getItemIdByRarity(5, getCardList()); 
    increaseSummonLuck(user, -10);
    return { jackpot: true, card: `🌟 Carta Lendária: **${cardId}**` };
  }

  increaseSummonLuck(user, 5);
  return { jackpot: false };
}
