//------------------------------------------------------------
//  SISTEMA DE INVOCAÇÃO — OTIMIZADO E BLINDADO (REESCRITO)
//------------------------------------------------------------

import {
  getCardTemplate,
  giveCardToUser,
  getCardList,
  addShardsToUser,
} from "./cardSystem.js";


import { spendCurrency } from "./economySystem.js";
import { markUserDirty } from "./userCacheSystem.js";

// === NOVAS DEPENDÊNCIAS DE GUARDIÕES (MOCK REESCRITO) ===
import guardiansData from "../../data/guardians.json" with { type: "json" }; 

// Mock: Funções de Guardião padronizadas
const getGuardianList = () => guardiansData.filter(g => !g.isDisabled); // Garante que a lista só tenha guardiões ativos
const getGuardianTemplate = id => guardiansData.find(g => g.id === id);
const giveGuardianToUser = (user, guardianId) => { 
  // Implementação de concessão/duplicata de Guardião
  return { duplicate: false, granted: true }; 
};
const handleGuardianDuplicate = (user, guardian) => {
  const shards = Math.floor(50 + (guardian.level || 1) * 10);
  // addSpecialShardsToUser(user, guardian.id, shards); // Assumindo que esta função está no escopo
  return `💠 Duplicata convertida em **${shards} shards** de Guardião de ${guardian.name}!`;
};
// ===================================================

import altars from "../../data/altars.json" with { type: "json" };
import boosters from "../../data/boosters.json" with { type: "json" };

// ----------------------------------------------
// CONFIGURAÇÕES
// ----------------------------------------------
// Base drop rate (Raridade/Nível 1 a 5)
const DROP_RATES_BASE = { 1: 45, 2: 30, 3: 15, 4: 7, 5: 3 };

export const summonCosts = {
  gold: { single: 5000, multi: 22500, currency: "gold" },
  gems: { single: 150, multi: 675, currency: "gems" },
  coupons: { single: 1, multi: 5, currency: "coupons" },
  guardian: { single: 300, currency: "gems" }, 
};

const PITY_CONFIG = { pityMax: 50, pityIncrement: 0.3 };
const RATE_UP_CONFIG = { active: true, rateUpChance: 0.55 }; // 55% de chance de Rate Up

// ----------------------------------------------
// UTILITÁRIOS DE SORTE E PITY
// ----------------------------------------------

/** Obtém a sorte atual do usuário (0-100). */
export const getSummonLuck = user => user.summonLuck || 0;

/** Aumenta/diminui a sorte do usuário. */
export function increaseSummonLuck(user, amount) {
  user.summonLuck = Math.min(100, Math.max(0, (user.summonLuck || 0) + amount));
  markUserDirty(user.id);
  return user.summonLuck;
}

/** Reseta a sorte (após jackpot). */
export function resetSummonLuck(user) {
  user.summonLuck = 0;
  markUserDirty(user.id);
}

/** Incrementa o pity (a cada drop não-máximo). */
function incrementPity(user) {
  user.pity = (user.pity || 0) + 1;
  user.pity = Math.min(user.pity, PITY_CONFIG.pityMax);
  // Garante que a sorte é incrementada no drop não-máximo
  increaseSummonLuck(user, 5);
  markUserDirty(user.id);
}

/** Reseta o pity (no drop máximo). */
function resetPity(user) {
  user.pity = 0;
  markUserDirty(user.id);
}

// ----------------------------------------------
// LOG
// ----------------------------------------------
function logSummon(user, itemId, rarity, type) {
  if (!user.summonLog) user.summonLog = [];
  user.summonLog.push({ itemId, rarity, type, at: Date.now() });
  if (user.summonLog.length > 200) user.summonLog.shift();
  markUserDirty(user.id);
}

// ----------------------------------------------
// DROP RATES (PITY + ALTAR)
// ----------------------------------------------
/** * Calcula as taxas de drop finais, aplicando bônus de altar e pity.
 * @param {string} type Tipo de invocação (gold, gems, guardian).
 * @param {object} user Objeto do usuário.
 * @param {object} options Opções de invocação (altarId, rateUpId, etc.).
 * @returns {object} Taxas de drop calculadas.
 */
function getFinalDropRates(type, user, options = {}) {
  const rates = { ...DROP_RATES_BASE };

  // 1. Aplica Bônus do Altar
  if (options.altarId && altars[options.altarId]) {
    const altar = altars[options.altarId];
    for (const [rar, boost] of Object.entries(altar.dropBoost || {})) {
      if (rates[rar]) rates[rar] += boost;
    }
    if (altar.rateUpCardId) options.rateUpId = altar.rateUpCardId;
  }

  // 2. Aplica Bônus de Pity (garante que PityMax é o limite)
  const currentPity = Math.min(user.pity || 0, PITY_CONFIG.pityMax);
  rates[5] += currentPity * PITY_CONFIG.pityIncrement;

  return rates;
}

// ----------------------------------------------
// DEFINIR RARIDADE/NÍVEL (GENÉRICO)
// ----------------------------------------------
/**
 * Determina a Raridade (Cartas) ou o Nível (Guardiões) baseado nas taxas de drop e Pity.
 * @param {string} type Tipo de invocação (determina o cálculo das taxas).
 * @param {object} user Objeto do usuário.
 * @param {object} options Opções (para Altar/Rate Up).
 * @returns {number} A raridade ou nível (1 a 5) sorteado.
 */
function determineRarityOrLevel(type, user, options = {}) {
  const rates = getFinalDropRates(type, user, options);
  const total = Object.values(rates).reduce((a, b) => a + b, 0);

  let r = Math.random() * total;
  // A iteração funciona tanto para Raridade (Cartas) quanto Nível (Guardiões)
  for (let rank = 1; rank <= 5; rank++) {
    r -= rates[rank];
    if (r <= 0) {
      if (rank === 5) {
        resetPity(user);
        // Garante que a sorte é incrementada no drop máximo, se não for feito no resetPity
        increaseSummonLuck(user, 5); 
      } else {
        incrementPity(user);
      }
      return rank;
    }
  }

  // Fallback (deve ser 1 na maioria dos casos)
  incrementPity(user);
  return 1;
}

// ----------------------------------------------
// POOLS DE ITENS
// ----------------------------------------------

/** Obtém a pool de itens disponíveis (Cartas ou Guardiões). */
function getAvailablePool(isGuardian, rarityOrLevel, options = {}) {
  if (isGuardian) {
    return getGuardianList().filter(g => g.level === rarityOrLevel);
  } else {
    return getCardList().filter(c => {
      if (c.rarity !== rarityOrLevel) return false;
      // Garante que guardiões (se marcados como c.type === 'guardian') não entrem na pool de cartas
      if (c.type === "guardian") return false; 
      if (options.cardType && c.type !== options.cardType) return false;
      return true;
    });
  }
}

/** Obtém um ID de item aleatório da pool filtrada. */
export function getItemIdByRarity(rarityOrLevel, isGuardian, options = {}) {
    const pool = getAvailablePool(isGuardian, rarityOrLevel, options);

    if (!pool.length) {
        const itemType = isGuardian ? "Guardião" : "Carta";
        throw new Error(`Nenhum item ${itemType} R${rarityOrLevel} disponível.`);
    }
    return pool[Math.floor(Math.random() * pool.length)].id;
}


// ----------------------------------------------
// DUPLICATAS -> SHARDS (UNIFICADO)
// ----------------------------------------------

function handleItemDuplicate(user, item, isGuardian) {
  if (isGuardian) {
    return handleGuardianDuplicate(user, item);
  }
  // Lógica de duplicata de cartas (Raridade/Level)
  const shards = Math.floor(10 + (item.rarity || 1) * 5);
  addShardsToUser(user, item.id, shards);
  return `💠 Duplicata convertida em **${shards} shards** de ${item.name}!`;
}

// ----------------------------------------------
// SUMMON INDIVIDUAL (CARTAS)
// ----------------------------------------------
export function summonCard(user, currency = "gold", options = {}) {
  const config = summonCosts[currency];
  if (!config || currency === "guardian") return "❌ Moeda inválida para cartas.";

  const cost = config.single;
  if (!options.skipCost && !spendCurrency(user, config.currency, cost))
    return `💰 Você não tem ${cost} ${config.currency}.`;

  const rarity = determineRarityOrLevel(currency, user, options);
  const pool = getAvailablePool(false, rarity, options); // false = não é Guardião
  if (!pool.length) return `⚠️ Nenhuma carta R${rarity}.`;

  let chosen;
  // Lógica de Rate Up
  if (
    RATE_UP_CONFIG.active &&
    rarity === 5 &&
    options.rateUpId &&
    Math.random() < RATE_UP_CONFIG.rateUpChance
  ) {
    chosen = getCardTemplate(options.rateUpId);
  } else {
    chosen = pool[Math.floor(Math.random() * pool.length)];
  }

  const received = giveCardToUser(user, chosen.id);
  logSummon(user, chosen.id, rarity, 'card');

  let msg = `✨ Você invocou **${chosen.name}** (${rarity}★) usando ${currency}!`;
  if (received.duplicate) msg += "\n" + handleItemDuplicate(user, chosen, false);

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

  const level = determineRarityOrLevel("guardian", user);
  const guardianId = getItemIdByRarity(level, true); // true = é Guardião
  const guardian = getGuardianTemplate(guardianId);

  const received = giveGuardianToUser(user, guardian.id);
  logSummon(user, guardian.id, level, 'guardian');

  let msg = `🔥 Guardião Invocado! Você recebeu **${guardian.name}** (${level}★) por ${cost} ${currency}.`;
  
  if (received.duplicate) msg += "\n" + handleItemDuplicate(user, guardian, true);

  return msg;
}

// ----------------------------------------------
// SUMMON MÚLTIPLO
// ----------------------------------------------
export function summonMultiple(user, currency = "gold", count = 5, options = {}) {
  const results = [];
  const rarCount = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  for (let i = 0; i < count; i++) {
    const msg = summonCard(user, currency, { ...options, skipCost: true }); // Garante skipCost para múltiplos
    
    // Se a primeira invocação falhar (ex: moeda inválida), paramos
    if (i === 0 && msg.startsWith("❌")) return msg;
    // Se o custo não foi pulado (o que não deve acontecer aqui), paramos
    if (msg.startsWith("💰 Você não tem")) break; 

    results.push(msg);
    const rarMatch = msg.match(/\((\d)★\)/);
    if (rarMatch) rarCount[rarMatch[1]]++;
  }

  // Prepara as estatísticas separadamente
  const statsSummary =
    `\n📊 Estatísticas: ` +
    Object.entries(rarCount).filter(([, c]) => c > 0).map(([r, c]) => `${r}★:${c}`).join(", ");

  return results.join("\n") + statsSummary;
}

// ----------------------------------------------
// JACKPOT DO ALTAR
// ----------------------------------------------
export function altarJackpotRoll(user) {
  const luck = getSummonLuck(user);
  const baseChance = 5;
  const luckBonus = luck * 0.2;
  // Limite máximo de chance de Jackpot
  const chance = Math.min(baseChance + luckBonus, 40); 

  if (Math.random() * 100 <= chance) {
    // Drop garantido de um item de raridade/nível 5
    const cardId = getItemIdByRarity(5, false); // false = carta
    resetSummonLuck(user); // Redefine a sorte ao acertar o Jackpot
    
    // Usamos giveCardToUser para garantir que a carta seja concedida
    const chosenCard = getCardTemplate(cardId);
    const received = giveCardToUser(user, cardId);
    logSummon(user, cardId, 5, 'jackpot');

    let msg = `🌟 Carta Lendária: **${chosenCard.name}** (5★) garantida!`;
    if (received.duplicate) msg += "\n" + handleItemDuplicate(user, chosenCard, false);

    return { jackpot: true, card: msg };
  }

  // Se falhar, penaliza/beneficia a sorte (como no código original)
  increaseSummonLuck(user, -5); // Penalidade por falha no Ritual Corrupto (reduz 5%)
  return { jackpot: false };
}
