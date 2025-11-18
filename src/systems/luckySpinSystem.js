// src/systems/luckySpinSystem.js
import { addGold, addXP, addGems, spendGold } from "./economySystem.js";
import { giveCardToUser, getCardList } from "./cardSystem.js";
import { getRandomCardIdByRarity } from "./summonSystem.js";

// ==========================================
// NOVAS CONFIGURAÇÕES
// ==========================================
const SPIN_COST = 100;
const LUCK_GAIN = 12; // por spin normal
const LUCK_GAIN_MEGA = 25; // por mega
const LUCK_MAX = 100;

// Normal Spin com raridades novas
const spinNormal = [
  { type: "gold", value: 150, chance: 25 },
  { type: "gold", value: 300, chance: 15 },
  { type: "xp", value: 120, chance: 20 },
  { type: "card", value: 2, chance: 20 }, // ★★
  { type: "card", value: 3, chance: 10 }, // ★★★
  { type: "token", value: 1, chance: 8 },
  { type: "gems", value: 1, chance: 2 }
];

// Mega Spin com raridades altas
const spinMega = [
  { type: "gold", value: 600, chance: 20 },
  { type: "xp", value: 400, chance: 20 },
  { type: "card", value: 4, chance: 25 }, // ★★★★
  { type: "card", value: 5, chance: 15 }, // ★★★★★
  { type: "chest", value: "epic", chance: 10 },
  { type: "gems", value: 10, chance: 5 },
  { type: "jackpot", value: null, chance: 5 }
];

// ==========================================
// HELPERS
// ==========================================
function rollItem(items) {
  const total = items.reduce((s, i) => s + i.chance, 0);
  let roll = Math.random() * total;
  for (const i of items) {
    if (roll < i.chance) return i;
    roll -= i.chance;
  }
  return items[0];
}

function getGuardians() {
  return getCardList().filter(c => c.type === "guardian").map(c => c.id);
}

function reward(user, item) {
  switch (item.type) {
    case "gold": addGold(user, item.value); return `💰 ${item.value} ouro`;
    case "xp": addXP(user, item.value); return `✨ ${item.value} XP`;
    case "gems": addGems(user, item.value); return `💎 ${item.value} gemas`;
    case "token":
      user.eventTokens = (user.eventTokens || 0) + item.value;
      return `🎟️ ${item.value} Token de Evento`;
    case "card":
      const id = getRandomCardIdByRarity(item.value);
      const c = giveCardToUser(user, id);
      return `🎴 Carta ${c.name} (${item.value}★)`;
    case "chest":
      user.chests = user.chests || [];
      user.chests.push(item.value);
      return `🟪 Baú ${item.value}`;
    case "jackpot":
      const gems = 500;
      addGems(user, gems);
      return `💥 JACKPOT! ${gems} gemas`;
    default:
      return "❓ Item desconhecido";
  }
}

// ==========================================
// SPIN PRINCIPAL
// ==========================================
export function spinLucky(user, count = 1) {
  if (!user.spinCount) user.spinCount = 0;
  if (!user.luck) user.luck = 0;

  const msgs = [];

  for (let n = 0; n < count; n++) {
    const isMega = (user.spinCount + 1) % 10 === 0;
    const isSuperMega = user.luck >= LUCK_MAX;

    if (!isMega && !isSuperMega) {
      try { spendGold(user, SPIN_COST); }
      catch (e) { msgs.push(`❌ Sem ouro: ${e.message}`); break; }
    }

    const pool = isSuperMega ? spinMega : (isMega ? spinMega : spinNormal);
    const item = rollItem(pool);
    const rewardMsg = reward(user, item);

    msgs.push(
      isSuperMega ? `🌌 SUPER MEGA SPIN! ${rewardMsg}` :
      isMega ? `🌟 Mega Spin! ${rewardMsg}` :
      `🎉 Spin! ${rewardMsg}`
    );

    user.spinCount++;
    user.luck = Math.min(
      LUCK_MAX,
      user.luck + (isMega ? LUCK_GAIN_MEGA : LUCK_GAIN)
    );

    if (isSuperMega) user.luck = 0;
  }

  msgs.push(`---`);
  msgs.push(`🔥 Sorte: ${user.luck}/${LUCK_MAX}`);
  msgs.push(`🌀 Mega Spin em: ${10 - (user.spinCount % 10)}`);

  return msgs.join("\n");
}