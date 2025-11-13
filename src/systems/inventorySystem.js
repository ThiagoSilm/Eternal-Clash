// src/systems/summonSystem.js
import { getCardTemplate, giveCardToUser } from "./cardSystem.js";
import { saveUserCached, loadUserCached } from "./economySystem.js";
import cards from "../data/cards.json" with { type: "json" };
import boosters from "../data/boosters.json" with { type: "json" };

// Drop rates por raridade
const dropRates = { 1: 45, 2: 30, 3: 15, 4: 7, 5: 3 };

// Custos
const summonCosts = {
  card: { unit: 150, multi5: 675 },
  guardian: { unit: 300, multi5: 675 },
  booster: { multi5: 675 }
};

// Helper aleatório
function randomChoice(array) {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Invoca cartas normais
 */
export function summonCards(userId, multi = false) {
  const user = loadUserCached(userId);
  const cost = multi ? summonCosts.card.multi5 : summonCosts.card.unit;
  if (user.gems < cost) return "💎 Gemas insuficientes.";
  user.gems -= cost;

  const results = [];
  const alreadyDrawn = new Set();

  const drawCount = multi ? 5 : 1;
  let guaranteed5StarDone = false;

  for (let i = 0; i < drawCount; i++) {
    let rarity;
    if (multi && !guaranteed5StarDone) {
      rarity = 5;
      guaranteed5StarDone = true;
    } else {
      const roll = Math.random() * 100;
      let accumulated = 0;
      rarity = 1;
      for (const [r, rate] of Object.entries(dropRates)) {
        accumulated += rate;
        if (roll <= accumulated) {
          rarity = parseInt(r);
          break;
        }
      }
    }

    const pool = cards.filter(c => c.rarity === rarity && !alreadyDrawn.has(c.id) && !c.id.startsWith("G"));
    if (!pool.length) continue;

    const chosen = randomChoice(pool);
    giveCardToUser(user, chosen.id);
    alreadyDrawn.add(chosen.id);
    results.push(`${chosen.name} (${chosen.rarity}★)`);
  }

  saveUserCached(userId);
  return `✨ Você recebeu:\n${results.join("\n")}`;
}

/**
 * Invoca guardiões
 */
export function summonGuardians(userId, multi = false) {
  const user = loadUserCached(userId);
  const cost = multi ? summonCosts.guardian.multi5 : summonCosts.guardian.unit;
  if (user.gems < cost) return "💎 Gemas insuficientes.";
  user.gems -= cost;

  const results = [];
  const alreadyDrawn = new Set();

  const drawCount = multi ? 5 : 1;
  let guaranteed4or5StarDone = false;

  for (let i = 0; i < drawCount; i++) {
    let rarity;
    if (multi && !guaranteed4or5StarDone) {
      rarity = 4 + Math.floor(Math.random() * 2); // 4★ ou 5★ garantido
      guaranteed4or5StarDone = true;
    } else {
      const roll = Math.random() * 100;
      let accumulated = 0;
      rarity = 1;
      for (const [r, rate] of Object.entries(dropRates)) {
        accumulated += rate;
        if (roll <= accumulated) {
          rarity = parseInt(r);
          break;
        }
      }
    }

    // Pool de guardiões (IDs que começam com G) que o usuário ainda não possui
    const pool = cards.filter(c => c.rarity === rarity && c.id.startsWith("G") && !user.cards.some(uc => uc.id === c.id) && !alreadyDrawn.has(c.id));
    if (!pool.length) continue;

    const chosen = randomChoice(pool);
    giveCardToUser(user, chosen.id);
    alreadyDrawn.add(chosen.id);
    results.push(`${chosen.name} (${chosen.rarity}★)`);
  }

  saveUserCached(userId);
  return `🛡️ Você recebeu guardiões:\n${results.join("\n")}`;
}

/**
 * Invoca booster
 */
export function summonBooster(userId, boosterId) {
  const user = loadUserCached(userId);
  const booster = boosters.find(b => b.id === boosterId);
  if (!booster) return "⚠️ Booster inválido.";
  const cost = summonCosts.booster.multi5;
  if (user.gems < cost) return "💎 Gemas insuficientes.";
  user.gems -= cost;

  const results = [];
  const alreadyDrawn = new Set();

  // Sorteia 5 cartas do booster, garantindo 1 carta temática
  const drawCount = 5;
  let guaranteedThemeDone = false;

  for (let i = 0; i < drawCount; i++) {
    let pool = booster.cards.filter(cId => !alreadyDrawn.has(cId)).map(id => getCardTemplate(id));

    if (!pool.length) continue;

    let chosen;
    if (!guaranteedThemeDone) {
      chosen = getCardTemplate(booster.theme);
      guaranteedThemeDone = true;
    } else {
      chosen = randomChoice(pool);
    }

    giveCardToUser(user, chosen.id);
    alreadyDrawn.add(chosen.id);
    results.push(`${chosen.name} (${chosen.rarity}★)`);
  }

  saveUserCached(userId);
  return `🎁 Você recebeu do booster **${booster.name}**:\n${results.join("\n")}`;
}