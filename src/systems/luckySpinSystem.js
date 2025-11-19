// src/systems/luckySpinSystem.js
import { addGold, addXP, addGems, spendGold } from "./economySystem.js";
import { giveCardToUser, getCardList } from "./cardSystem.js";
import { getRandomCardIdByRarity } from "./summonSystem.js";

// --- Configuração de prêmios ---
const normalItems = [
  { type: "gold", value: 200, chance: 30, rarity: "common" },
  { type: "gold", value: 500, chance: 20, rarity: "rare" },
  { type: "xp", value: 100, chance: 20, rarity: "common" },
  { type: "xp", value: 250, chance: 10, rarity: "rare" },
  { type: "card", value: 3, chance: 15, rarity: "rare" },
  { type: "gems", value: 1, chance: 5, rarity: "legendary" }
];

const megaItems = [
  { type: "gold", value: 500, chance: 15, rarity: "common" },
  { type: "gold", value: 1000, chance: 10, rarity: "rare" },
  { type: "xp", value: 200, chance: 15, rarity: "common" },
  { type: "xp", value: 500, chance: 10, rarity: "rare" },
  { type: "card", value: 4, chance: 25, rarity: "rare" },
  { type: "gems", value: 5, chance: 10, rarity: "legendary" },
  { type: "lottery", value: null, chance: 10, rarity: "legendary" },
  { type: "guardian", value: null, chance: 5, rarity: "legendary" }
];

// --- Helpers ---
function roll(items) {
  const total = items.reduce((a, i) => a + i.chance, 0);
  let r = Math.random() * total;
  for (const i of items) { if (r < i.chance) return i; r -= i.chance; }
  return items[0];
}

function getAvailableGuardians(user) {
  const all = getCardList().filter(c => c.type === "guardian").map(c => c.id);
  if (!user.guardians) user.guardians = [];
  return all.filter(id => !user.guardians.includes(id));
}

// --- Executa um spin e retorna objeto para embed ---
export function executeSpin(user, isMega = false) {
  const items = isMega ? megaItems : normalItems;
  const selected = roll(items);
  let msg = "", lvlMsg = null;

  switch (selected.type) {
    case "gold": addGold(user, selected.value); msg = `${selected.value} ouro 💰`; break;
    case "xp": lvlMsg = addXP(user, selected.value); msg = `${selected.value} XP ✨`; break;
    case "gems": addGems(user, selected.value); msg = `${selected.value} gema(s) 💎`; break;
    case "card": {
      const cardId = getRandomCardIdByRarity(selected.value);
      const card = giveCardToUser(user, cardId);
      msg = `Carta: ${card.name} (${selected.value}★) 🎴`; break;
    }
    case "lottery": {
      if (Math.random() < 0.5) {
        const cardId = getRandomCardIdByRarity(5);
        const card = giveCardToUser(user, cardId);
        msg = `🎰 Loteria! Carta 5★: ${card.name}`;
      } else { addGems(user, 50); msg = `🎰 Loteria! 50 gemas 💎`; }
      break;
    }
    case "guardian": {
      const available = getAvailableGuardians(user);
      if (available.length === 0) msg = "Nenhum Guardian disponível 😅";
      else { const id = available[Math.floor(Math.random() * available.length)]; user.guardians.push(id); msg = `🛡️ Guardian obtido (ID: ${id})!`; }
      break;
    }
    default: msg = "Nada sorteado 🤨";
  }

  if (lvlMsg) msg += `\n${lvlMsg}`;
  return { msg, rarity: selected.rarity };
}

// --- Função principal do Lucky Spin ---
export function spinLucky(user, useFree = false) {
  if (!user.luckySpin) user.luckySpin = { spins: 0, freeSpins: 0 };
  const cost = 100;

  if (!useFree) {
    try { spendGold(user, cost); }
    catch (err) { return { msg: `💰 ${err.message}`, rarity: "common" }; }
  }

  const isMega = (user.luckySpin.spins + 1) % 10 === 0;
  const result = executeSpin(user, isMega);

  user.luckySpin.spins += 1;
  if (!useFree && isMega) user.luckySpin.freeSpins += 1;

  return result;
}