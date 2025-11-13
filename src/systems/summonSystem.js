import { getCardTemplate, giveCardToUser, getCardList } from "./cardSystem.js";
import { spendCurrency } from "./economySystem.js";
import altars from "../../data/altars.json" with { type: "json" };
import boosters from "../../data/boosters.json" with { type: "json" };

const dropRates = { 1: 45, 2: 30, 3: 15, 4: 7, 5: 3 };

const summonCosts = {
  gold: { single: 5000, multi: 22500 },
  gems: { single: 150, multi: 675 },
  coupons: { single: 1, multi: 5 }
};

function determineRarity(type, user, options = {}) { /* lógica existente */ }
function getAvailableCardDefinitions(rarity, type, options = {}) { /* lógica existente */ }

export function summonCard(user, type = "gold", options = {}) {
  const cost = summonCosts[type]?.single;
  if (!cost && type !== "mazeBoss" && type !== "guardian") throw new Error("Tipo de invocação inválido ou sem custo definido.");
  if (cost > 0) spendCurrency(user, type, cost);

  const rarity = determineRarity(type, user, options);
  const availableDefinitions = getAvailableCardDefinitions(rarity, type, options);
  if (!availableDefinitions.length) return "⚠️ Nenhuma definição de carta disponível nessa raridade.";

  const chosenDefinition = availableDefinitions[Math.floor(Math.random() * availableDefinitions.length)];
  giveCardToUser(user, chosenDefinition.id);
  return `✨ Você invocou **${chosenDefinition.name}** (${rarity}★)!`;
}

export function summonMultiple(user, type = "gold", count = 5, options = {}) {
  const singleCost = summonCosts[type]?.single || 0;
  const multiCost = summonCosts[type]?.multi;
  const totalCost = multiCost || singleCost * count;
  if (totalCost > 0) spendCurrency(user, type, totalCost);

  const results = [];
  for (let i = 0; i < count; i++) results.push(summonCard(user, type, options));
  return results.join("\n");
}

export function summonBooster(user, boosterId) {
  const booster = boosters.find(b => b.id === boosterId);
  if (!booster) throw new Error("Booster inválido.");
  const BOOSTER_COST = 675;
  spendCurrency(user, "gems", BOOSTER_COST);

  const cardInstances = [];
  const themeCardDefinition = getCardTemplate(booster.themeCardId);
  if (themeCardDefinition) cardInstances.push(giveCardToUser(user, themeCardDefinition.id));

  for (let id of booster.cardIds) {
    const definition = getCardTemplate(id);
    if (definition) cardInstances.push(giveCardToUser(user, definition.id));
    if (cardInstances.length >= 5) break;
  }

  const receivedNames = cardInstances.map(c => getCardTemplate(c.id).name);
  return `🎁 Booster aberto! Você recebeu: ${receivedNames.join(", ")}`;
}