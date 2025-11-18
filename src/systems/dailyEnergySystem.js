import { addEnergy, spendGems, addGems } from "./economySystem.js";

// ----------------------------------------------------
// 🔥 CONFIGURAÇÕES
// ----------------------------------------------------

const BONUS_PERIODS = [
  { startHour: 10, endHour: 15, energy: 30, name: "Manhã Reforçada" },
  { startHour: 20, endHour: 22, energy: 20, name: "Noite de Batalha" }
];

const WEEKLY_BONUS = {
  1: { energy: 40, name: "Turbo Segunda" },
  3: { energy: 25, name: "Quarta de Ritmo" },
  5: { energy: 50, name: "Sexta Insana" },
};

const MEGA_EVENT = {
  chance: 0.06, // 6% de chance por check
  energy: 120,
  name: "Tempestade Arcana"
};

const BUY_LIMIT_PER_DAY = 10;
const ENERGY_PER_GEM = 40;

// ----------------------------------------------------
// 🔹 GETTERS AUXILIARES
// ----------------------------------------------------

function getTodayKey() {
  return new Date().toISOString().split("T")[0];
}

function getActiveBonus(hour) {
  return BONUS_PERIODS.find(p => hour >= p.startHour && hour < p.endHour) || null;
}

// ----------------------------------------------------
// 🔥 BONÚS HORÁRIO + SEMANAL + EVENTO RARO
// ----------------------------------------------------

export function checkAndApplyBonus(user) {
  const now = new Date();
  const hour = now.getHours();
  const weekday = now.getDay();
  const key = getTodayKey();
  
  if (!user.dailyBonusReceived) user.dailyBonusReceived = {};
  
  let messages = [];
  
  // --- 1) Bônus por horário ---
  const hourBonus = getActiveBonus(hour);
  if (hourBonus) {
    const hourKey = `${key}_hour_${hourBonus.startHour}`;
    if (!user.dailyBonusReceived[hourKey]) {
      addEnergy(user, hourBonus.energy);
      user.dailyBonusReceived[hourKey] = true;
      messages.push(`🎉 Bônus **${hourBonus.name}**: +${hourBonus.energy} Energia.`);
    }
  }
  
  // --- 2) Bônus semanal fixo ---
  if (WEEKLY_BONUS[weekday]) {
    const w = WEEKLY_BONUS[weekday];
    const weekKey = `${key}_weekly`;
    if (!user.dailyBonusReceived[weekKey]) {
      addEnergy(user, w.energy);
      user.dailyBonusReceived[weekKey] = true;
      messages.push(`📅 Bônus de **${w.name}**: +${w.energy} Energia.`);
    }
  }
  
  // --- 3) Mega evento raro ---
  if (Math.random() < MEGA_EVENT.chance) {
    const eventKey = `${key}_mega`;
    if (!user.dailyBonusReceived[eventKey]) {
      addEnergy(user, MEGA_EVENT.energy);
      user.dailyBonusReceived[eventKey] = true;
      messages.push(`🌩️ Evento Lendário: **${MEGA_EVENT.name}**! +${MEGA_EVENT.energy} Energia.`);
    }
  }
  
  if (messages.length === 0) return `⏳ Nenhum bônus novo disponível agora.`;
  return messages.join("\n");
}

// ----------------------------------------------------
// ⚡ COMPRA DE ENERGIA (LIMITADA)
// ----------------------------------------------------

export function buyEnergy(user, gemsSpent = 1) {
  if (gemsSpent <= 0) return "❌ Quantidade inválida.";
  
  const today = getTodayKey();
  if (!user.energyPurchases) user.energyPurchases = {};
  if (!user.energyPurchases[today]) user.energyPurchases[today] = 0;
  
  if (user.energyPurchases[today] >= BUY_LIMIT_PER_DAY) {
    return `🚫 Você atingiu o limite diário de **${BUY_LIMIT_PER_DAY} compras**.`;
  }
  
  if (!spendGems(user, gemsSpent)) {
    return `❌ Gemas insuficientes!`;
  }
  
  const amount = ENERGY_PER_GEM * gemsSpent;
  const added = addEnergy(user, amount);
  
  if (added <= 0) {
    addGems(user, gemsSpent); // reembolso
    return `⚠️ Energia já está cheia! Suas gemas foram reembolsadas.`;
  }
  
  user.energyPurchases[today] += gemsSpent;
  
  return `⚡ Você comprou **${added} energia** usando ${gemsSpent} gemas. Compras hoje: ${user.energyPurchases[today]}/${BUY_LIMIT_PER_DAY}`;
}

// ----------------------------------------------------
// 🔥 COMBO STREAK DIÁRIO (login + atividade)
// ----------------------------------------------------

export function applyDailyStreak(user) {
  const today = getTodayKey();
  const last = user.lastStreakDay;
  
  if (!user.streak) user.streak = 0;
  
  if (last === today) return `🔥 Streak já registrada hoje.`;
  
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  
  if (last === yesterday) user.streak++;
  else user.streak = 1;
  
  user.lastStreakDay = today;
  
  const reward = 10 + user.streak * 2; // escala
  addEnergy(user, reward);
  
  return `🔥 Streak **${user.streak} dias** — +${reward} energia!`;
}

// ----------------------------------------------------
// 🎯 MISSÃO INTERNA: GASTAR ENERGIA (pode ser usada no battleSystem)
// ----------------------------------------------------

export function registerEnergySpent(user, amount) {
  if (!user.energyMission) user.energyMission = { spent: 0, target: 300 };
  
  user.energyMission.spent += amount;
  
  if (user.energyMission.spent >= user.energyMission.target) {
    user.energyMission.spent = 0;
    addEnergy(user, 80);
    return `🏆 Missão “Gaste Energia” completada! +80 Energia`;
  }
  
  return null;
}