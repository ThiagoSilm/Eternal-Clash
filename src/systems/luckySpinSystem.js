// src/systems/luckySpinSystem.js
import { addGems, spendGold } from "./economySystem.js";

// -----------------------------------------------------
// 🎁 RECOMPENSAS DO SPIN (100% GEMAS + JACKPOT)
// -----------------------------------------------------
const NORMAL_REWARDS = [
  { gems: 1, chance: 40, rarity: "common" },
  { gems: 3, chance: 25, rarity: "rare" },
  { gems: 5, chance: 15, rarity: "epic" },
  { gems: 10, chance: 8, rarity: "legendary" },
  { gems: 25, chance: 5, rarity: "mythic" },
  
  // JACKPOT (extremamente raro)
  { gems: 100, chance: 1, rarity: "jackpot" }
];

const MEGA_REWARDS = [
  { gems: 5, chance: 40, rarity: "rare" },
  { gems: 10, chance: 25, rarity: "epic" },
  { gems: 25, chance: 15, rarity: "legendary" },
  { gems: 50, chance: 10, rarity: "mythic" },
  
  // JACKPOT REAL OFICIAL
  { gems: 250, chance: 5, rarity: "jackpot" }
];

// -----------------------------------------------------
// 🎲 Função de rolagem simples e direta
// -----------------------------------------------------
function rollReward(pool) {
  const total = pool.reduce((acc, r) => acc + r.chance, 0);
  let rand = Math.random() * total;
  
  for (const reward of pool) {
    if (rand < reward.chance) return reward;
    rand -= reward.chance;
  }
  return pool[0];
}

// -----------------------------------------------------
// 🎡 Executa um spin
// -----------------------------------------------------
export function executeSpin(user, mega = false) {
  const pool = mega ? MEGA_REWARDS : NORMAL_REWARDS;
  const reward = rollReward(pool);
  
  addGems(user, reward.gems);
  
  return {
    msg: `💎 Você ganhou **${reward.gems} gemas**!`,
    rarity: reward.rarity
  };
}

// -----------------------------------------------------
// 🎰 Função principal do Lucky Spin
// -----------------------------------------------------
export function spinLucky(user, useFree = false) {
  if (!user.luckySpin)
    user.luckySpin = { spins: 0 };
  
  const COST = 100; // ouro por spin normal
  
  if (!useFree) {
    try { spendGold(user, COST); }
    catch (err) {
      return { msg: `❌ ${err.message}`, rarity: "common" };
    }
  }
  
  const mega = ((user.luckySpin.spins + 1) % 10 === 0);
  const result = executeSpin(user, mega);
  
  user.luckySpin.spins++;
  
  if (mega) result.msg = "🌟 **MEGA SPIN!**\n" + result.msg;
  if (result.rarity === "jackpot") result.msg = "🎰 **JACKPOT!!!**\n" + result.msg;
  
  return result;
}