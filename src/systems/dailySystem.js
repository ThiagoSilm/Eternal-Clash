// ========================================================================
// 🔥 DAILY SYSTEM EXPANDIDO
// ========================================================================
import { addGold, addGems, addXP, addEnergy, spendGems } from "./economySystem.js";
import { giveCardToUser, getRandomCardIdByRarity } from "./cardSystem.js";
import { addCoupons } from "./couponSystem.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// -------------------------
// Load rewards JSON
// -------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REWARDS_PATH = path.join(__dirname, "../../data/dailyRewards.json");
let rewards = [];
try { rewards = JSON.parse(fs.readFileSync(REWARDS_PATH, "utf-8")); } catch { rewards = []; }

// -------------------------
// Helpers
// -------------------------
function calcEnergy(streak) {
  let e = 30;
  if (streak >= 3) e += 10;
  if (streak >= 5) e += 10;
  return e;
}

function execScript(user, reward) {
  if (!reward?.script) return;
  try {
    new Function("user", "addGold", "addGems", "addXP", "addEnergy", reward.script)(
      user, addGold, addGems, addXP, addEnergy
    );
  } catch (e) { console.error("Daily script error:", e.message); }
}

function formatReward(r) {
  if (!r) return "Nenhuma recompensa";
  return [
    r.gold && `💰 +${r.gold}`,
    r.gems && `💎 +${r.gems}`,
    r.xp   && `✨ +${r.xp}`
  ].filter(Boolean).join(" | ");
}

// ========================================================================
// 🎁 CLAIM DIÁRIO (EXPANDIDO)
// ========================================================================
export function claimDaily(user) {
  const today = new Date().toDateString();
  if (!user.daily) user.daily = { lastClaim: null, streak: 0, weekChest: 0, month: {} };
  if (user.daily.lastClaim === today)
    throw new Error("📆 Você já coletou o daily hoje!");

  const last = user.daily.lastClaim ? new Date(user.daily.lastClaim) : new Date(0);
  const isChain = new Date(last.getTime() + 86400000).toDateString() === today;

  user.daily.streak = isChain ? user.daily.streak + 1 : 1;
  if (user.daily.streak > 7) user.daily.streak = 1;

  const reward = rewards.find(r => r.day === user.daily.streak)?.reward;

  if (reward) {
    reward.gold && addGold(user, reward.gold);
    reward.gems && addGems(user, reward.gems);
    reward.xp   && addXP(user, reward.xp);
    execScript(user, reward);
  }

  // ⭐ ENERGIA PADRÃO
  const energy = calcEnergy(user.daily.streak);
  addEnergy(user, energy);

  // ⭐ COFRE SEMANAL (acumula)
  user.daily.weekChest = (user.daily.weekChest || 0) + (reward?.gold || 0);

  // ⭐ COFRE MENSAL
  const month = new Date().getMonth();
  user.daily.month[month] = (user.daily.month[month] || 0) + 1;

  // ⭐ Recompensa secreta 1% de chance
  let secret = "";
  if (Math.random() <= 0.01) {
    addGems(user, 50);
    secret = "\n🎁 **BONUS SECRETO:** +50 gemas!";
  }

  user.daily.lastClaim = today;

  return `🎉 Daily (Dia ${user.daily.streak}) coletado!\n${formatReward(reward)}\n⚡ Energia: +${energy}${secret}`;
}

// ========================================================================
// ⏳ DAILY STATUS
// ========================================================================
export function getDailyStatus(user) {
  if (!user.daily) return "📅 Nenhuma informação ainda.";
  return `📅 Streak: ${user.daily.streak} dias\n💰 Cofre Semanal: ${user.daily.weekChest}`;
}

// ========================================================================
// 🧰 COFRE SEMANAL — RECOLHER
// ========================================================================
export function claimWeeklyChest(user) {
  if (!user.daily?.weekChest) return "📦 Seu cofre semanal está vazio.";
  const amount = user.daily.weekChest;
  addGold(user, amount);
  user.daily.weekChest = 0;
  return `📦 Você abriu o Cofre Semanal e ganhou **${amount} ouro**!`;
}

// ========================================================================
// ⭐ COFRE MENSAL — Recolher
// ========================================================================
export function claimMonthlyReward(user) {
  const month = new Date().getMonth();
  const days = user.daily?.month?.[month] || 0;
  if (days < 25) return "📆 Você precisa de 25 dias para ganhar o prêmio mensal!";
  
  addGems(user, 150);
  user.daily.month[month] = 0;
  return `🌙 **Recompensa Mensal:** +150 Gemas!`;
}

// ========================================================================
// 🧪 DAILY VIP (Pago com gemas)
// ========================================================================
export function claimDailyVIP(user) {
  if (spendGems(user, 20) === false)
    return "❌ Você precisa de 20 gemas.";

  const bonus = Math.floor(Math.random() * 3) + 2; // 2x a 4x
  const gold = 3000 * bonus;
  const xp   = 100 * bonus;

  addGold(user, gold);
  addXP(user, xp);

  return `💎 **Daily VIP**\n🎁 Ouro: +${gold} | XP: +${xp}\n🔥 Multiplicador: x${bonus}`;
}

// ========================================================================
// 🎰 SORTEIO DIÁRIO EXPANDIDO
// ========================================================================
export function dailyDraw(user) {
  const now = Date.now();
  const cd = 86400000;
  if (!user.dailyDraw) user.dailyDraw = { lastDraw: 0 };
  if (now - user.dailyDraw.lastDraw < cd)
    return "⏳ Você já participou do sorteio hoje.";

  user.dailyDraw.lastDraw = now;

  const table = [
    { t: "gold", amount: 3000, chance: 35 },
    { t: "gems", amount: 30,  chance: 25 },
    { t: "coupon", amount: 1, chance: 15 },
    { t: "card", rarity: 3,   chance: 12 },
    { t: "card", rarity: 4,   chance: 7 },
    { t: "card", rarity: 5,   chance: 5 },
    // JACKPOT
    { t: "jackpot", gems: 200, chance: 1 }
  ];

  const roll = Math.random() * 100;
  let acc = 0, pick = table[0];
  for (const r of table) { acc += r.chance; if (roll <= acc) { pick = r; break; } }

  switch (pick.t) {
    case "gold": addGold(user, pick.amount); return `💰 ${pick.amount} ouro!`;
    case "gems": addGems(user, pick.amount); return `💎 ${pick.amount} gemas!`;
    case "coupon": addCoupons(user, pick.amount); return `🎟️ Cupom ganho!`;
    case "card":
      const card = getRandomCardIdByRarity(pick.rarity);
      giveCardToUser(user, card);
      return `✨ Carta ${pick.rarity}★ recebida!`;
    case "jackpot":
      addGems(user, pick.gems);
      return `🎰 **JACKPOT!** 💎 +${pick.gems} Gemas!`;
  }
}