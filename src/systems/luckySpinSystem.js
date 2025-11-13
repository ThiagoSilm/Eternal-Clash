// src/systems/luckySpinSystem.js

import { addGold, addXP, addGems, spendGold } from "./economySystem.js";
import { giveCardToUser, getCardList } from "./cardSystem.js";
import { getRandomCardIdByRarity } from "./summonSystem.js";

// Configurações da roleta
const spinItemsNormal = [
  { type: "gold", value: 200, chance: 25 },
  { type: "gold", value: 500, chance: 20 },
  { type: "xp", value: 100, chance: 20 },
  { type: "xp", value: 250, chance: 10 },
  { type: "card", value: 3, chance: 20 },
  { type: "gems", value: 1, chance: 5 }
];

const spinItemsMega = [
  { type: "gold", value: 500, chance: 15 },
  { type: "gold", value: 1000, chance: 10 },
  { type: "xp", value: 200, chance: 15 },
  { type: "xp", value: 500, chance: 10 },
  { type: "card", value: 4, chance: 25 },
  { type: "gems", value: 5, chance: 10 },
  { type: "lottery", value: null, chance: 10 },
  { type: "guardian", value: null, chance: 5 }
];

// --- Helpers ---
function rollItem(items) {
  const totalChance = items.reduce((sum, i) => sum + i.chance, 0);
  let roll = Math.random() * totalChance;
  for (const item of items) {
    if (roll < item.chance) return item;
    roll -= item.chance;
  }
  return items[0];
}

function getAllGuardianIds() {
  const allCards = getCardList();
  return allCards.filter(c => c.type === "guardian").map(g => g.id);
}

function executeSpin(user, isMega = false) {
  const items = isMega ? spinItemsMega : spinItemsNormal;
  const selected = rollItem(items);
  let message = "";
  let levelUpMsg = null;
  
  switch (selected.type) {
    case "gold":
      addGold(user, selected.value);
      message = `${selected.value} de ouro 💰`;
      break;
    case "xp":
      levelUpMsg = addXP(user, selected.value);
      message = `${selected.value} XP ✨`;
      break;
    case "gems":
      addGems(user, selected.value);
      message = `${selected.value} gema(s) 💎`;
      break;
    case "card":
      const rarity = selected.value || 3;
      const cardId = getRandomCardIdByRarity(rarity);
      const card = giveCardToUser(user, cardId);
      message = `Carta: ${card.name} (${rarity}★) 🎴`;
      break;
    case "lottery":
      if (Math.random() < 0.5) {
        const cardId5 = getRandomCardIdByRarity(5);
        const card5 = giveCardToUser(user, cardId5);
        message = `🎰 Loteria! Carta 5★: ${card5.name}`;
      } else {
        const gemsPrize = 50;
        addGems(user, gemsPrize);
        message = `🎰 Loteria! ${gemsPrize} gemas 💎`;
      }
      break;
    case "guardian":
      const allGuardians = getAllGuardianIds();
      const available = allGuardians.filter(gId => !user.guardians?.includes(gId));
      if (!user.guardians) user.guardians = [];
      if (available.length === 0) {
        message = "Nenhum Guardian disponível para receber 😅";
      } else {
        const guardianId = available[Math.floor(Math.random() * available.length)];
        user.guardians.push(guardianId);
        message = `🛡️ Guardian obtido (ID: ${guardianId})!`;
      }
      break;
    default:
      message = "Nenhum item válido foi sorteado 🤨";
  }
  
  if (levelUpMsg) {
    message += `\n${levelUpMsg}`;
  }
  
  return message;
}

// --- Função principal ---
export function spinLucky(user, count = 1) {
  if (!user.luckySpinCount) user.luckySpinCount = 0;
  const messages = [];
  const cost = 100;
  
  for (let i = 0; i < count; i++) {
    const isMega = (user.luckySpinCount + 1) % 10 === 0;
    
    if (!isMega) {
      try {
        spendGold(user, cost);
      } catch (error) {
        messages.push(`💰 ${error.message}. Não foi possível continuar girando.`);
        break;
      }
    }
    
    const msg = executeSpin(user, isMega);
    messages.push(isMega ? `🌟 Mega Spin! ${msg}` : `🎉 Spin! ${msg}`);
    user.luckySpinCount += 1;
  }
  
  const spinsLeft = 10 - (user.luckySpinCount % 10);
  messages.push(`---`);
  messages.push(`🌀 Giros até o próximo Mega Spin: ${spinsLeft}`);
  
  return messages.join("\n");
}