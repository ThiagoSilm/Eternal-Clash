// src/systems/luckySpinSystem.js
import { loadUser, saveUser } from "./userCacheSystem.js";
import { giveCardToUser, getAllGuardians } from "./cardSystem.js";
import boosters from "../data/boosters.json" assert { type: "json" };

// Probabilidades base (em %)
const spinItemsNormal = [
  { type: "gold", value: 200, chance: 25 },
  { type: "gold", value: 500, chance: 20 },
  { type: "xp", value: 100, chance: 20 },
  { type: "xp", value: 250, chance: 10 },
  { type: "card", value: null, chance: 20 },
  { type: "gems", value: 1, chance: 5 }
];

const spinItemsMega = [
  { type: "gold", value: 500, chance: 15 },
  { type: "gold", value: 1000, chance: 10 },
  { type: "xp", value: 200, chance: 15 },
  { type: "xp", value: 500, chance: 10 },
  { type: "card", value: null, chance: 25 },
  { type: "gems", value: 5, chance: 10 },
  { type: "lottery", value: null, chance: 10 },
  { type: "guardian", value: null, chance: 5 }
];

function rollItem(items) {
  const roll = Math.random() * 100;
  let accumulated = 0;
  for (const item of items) {
    accumulated += item.chance;
    if (roll <= accumulated) return item;
  }
  return items[0];
}

function executeSpin(user, isMega = false) {
  const items = isMega ? spinItemsMega : spinItemsNormal;
  const selected = rollItem(items);
  let message = "";

  switch (selected.type) {
    case "gold":
      user.gold += selected.value;
      message = `${selected.value} de ouro 💰`;
      break;
    case "xp":
      user.xp += selected.value;
      message = `${selected.value} XP ✨`;
      break;
    case "gems":
      user.gems = (user.gems || 0) + selected.value;
      message = `${selected.value} gema(s) 💎`;
      break;
    case "card":
      let cardId;
      if (Math.random() < 0.2 && boosters.length > 0) {
        const booster = boosters[Math.floor(Math.random() * boosters.length)];
        cardId = booster.cards[Math.floor(Math.random() * booster.cards.length)];
      } else {
        cardId = Math.floor(Math.random() * 200) + 1;
      }
      const card = giveCardToUser(user, cardId);
      message = `Carta: ${card.name} 🎴`;
      break;
    case "lottery":
      if (Math.random() < 0.5) {
        const cardId5 = Math.floor(Math.random() * 10) + 1;
        const card5 = giveCardToUser(user, cardId5);
        message = `🎰 Loteria! Carta 5★: ${card5.name}`;
      } else {
        const gemsPrize = 50;
        user.gems += gemsPrize;
        message = `🎰 Loteria! ${gemsPrize} gemas 💎`;
      }
      break;
    case "guardian":
      const allGuardians = getAllGuardians();
      const available = allGuardians.filter(g => !user.guardians?.includes(g.id));
      if (available.length === 0) {
        message = "Nenhum guardian disponível para receber 😅";
      } else {
        const guardian = available[Math.floor(Math.random() * available.length)];
        if (!user.guardians) user.guardians = [];
        user.guardians.push(guardian.id);
        message = `🛡️ Guardian obtido: ${guardian.name}!`;
      }
      break;
  }

  return message;
}

export function spinLucky(user, count = 1) {
  if (!user.luckySpinCount) user.luckySpinCount = 0;
  const messages = [];

  for (let i = 0; i < count; i++) {
    const isMega = (user.luckySpinCount + 1) % 10 === 0;
    if (!isMega && user.gold < 100) {
      messages.push("💰 Ouro insuficiente para continuar girando.");
      break;
    }
    if (!isMega) user.gold -= 100;

    const msg = executeSpin(user, isMega);
    messages.push(isMega ? `🌟 Mega Spin! ${msg}` : `🎉 Spin! ${msg}`);
    user.luckySpinCount += 1;
  }

  const spinsLeft = 10 - (user.luckySpinCount % 10);
  messages.push(`🌀 Giros até o próximo Mega Spin: ${spinsLeft}`);

  saveUser(user);
  return messages.join("\n");
}