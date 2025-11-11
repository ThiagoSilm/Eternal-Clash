// src/systems/summonSystem.js
import { getCardTemplate, giveCardToUser } from "./cardSystem.js";
import { saveUser } from "./economySystem.js";
import altars from "../data/altars.json" with {type: 'json'};

// Taxas de drop por raridade
const dropRates = {
  1: 45, // Comum
  2: 30, // Incomum
  3: 15, // Rara
  4: 7,  // Épica
  5: 3   // Lendária
};

// Preços de invocação
const summonCosts = {
  gold: 15000,
  gems: 1,
  coupons: 1
};

/**
 * Invoca uma única carta
 */
export function summonCard(user, type = "gold") {
  const cost = summonCosts[type];
  if (!cost) return "❌ Tipo de invocação inválido.";

  // Verifica se o usuário tem recurso suficiente
  if (type === "gold" && user.gold < cost) return "💰 Ouro insuficiente.";
  if (type === "gems" && user.gems < cost) return "💎 Gemas insuficientes.";
  if (type === "coupons" && user.coupons < cost) return "🎟️ Cupom insuficiente.";

  // Cobra o custo
  if (type === "gold") user.gold -= cost;
  else if (type === "gems") user.gems -= cost;
  else if (type === "coupons") user.coupons -= cost;

  // Determina raridade
  const roll = Math.random() * 100;
  let accumulated = 0;
  let rarity = 1;

  for (const [r, rate] of Object.entries(dropRates)) {
    accumulated += rate;
    if (roll <= accumulated) {
      rarity = parseInt(r);
      break;
    }
  }

  // Busca todas as cartas disponíveis dessa raridade
  const available = [];
  for (let id = 1; id <= 999; id++) {
    const card = getCardTemplate(id);
    if (card && card.rarity === rarity) available.push(card);
  }

  if (available.length === 0) return "⚠️ Nenhuma carta cadastrada nessa raridade.";

  // Aplica altar ativo (se houver)
  const activeAltar = altars.find(a => a.active);
  if (activeAltar && activeAltar.bonusRarity === rarity) {
    if (Math.random() * 100 < activeAltar.bonusChance) {
      const featured = getCardTemplate(activeAltar.featuredCards[0]);
      const newCard = giveCardToUser(user, featured.id);
      saveUser(user);
      return `🔥 Sorte divina do ${activeAltar.name}! Você recebeu **${featured.name}** (${featured.rarity}★)!`;
    }
  }

  // Sorteia uma carta aleatória
  const chosen = available[Math.floor(Math.random() * available.length)];
  const newCard = giveCardToUser(user, chosen.id);
  saveUser(user);

  return `✨ Invocação bem-sucedida! Você recebeu **${chosen.name}** (${rarity}★)!`;
}

/**
 * Invoca múltiplas cartas de uma vez
 */
export function summonMultiple(user, type = "gold", count = 5) {
  const results = [];
  for (let i = 0; i < count; i++) {
    results.push(summonCard(user, type));
  }
  return results.join("\n");
}