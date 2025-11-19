// src/systems/dailySystemExpanded.js

// Dependências do sistema econômico/de cards
import { addGold, addGems, addXP, addEnergy, spendGems } from "./economySystem.js";
import { giveCardToUser, getRandomCardIdByRarity } from "./cardSystem.js";
import { addCoupons } from "./couponSystem.js";

// Dependências de Arquivo
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// -------------------------
// 🛠️ CONSTANTES E TIPAGEM
// -------------------------

const ONE_DAY_MS = 86400000;
const DAILY_VIP_COST = 20;

/**
 * @typedef {object} UserDailyState
 * @property {string | null} lastClaim - Data da última coleta (Date.toDateString()).
 * @property {number} streak - Contagem de dias seguidos (1 a 7).
 * @property {number} weekChest - Ouro acumulado no cofre semanal.
 * @property {Object.<number, number>} month - Quantidade de dias coletados por mês (Chave: Mês 0-11).
 */

/**
 * @typedef {object} UserDrawState
 * @property {number} lastDraw - Timestamp da última participação no sorteio.
 */

/**
 * @typedef {object} UserState
 * @property {UserDailyState} [daily] - Estado do sistema de Daily Claim.
 * @property {UserDrawState} [dailyDraw] - Estado do sistema de Daily Draw.
 * // Outras propriedades do usuário (gold, gems, etc.)
 */


// -------------------------
// 📁 Carregamento de Recompensas
// -------------------------

// Localiza o caminho para o arquivo de recompensas JSON
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REWARDS_PATH = path.join(__dirname, "../../data/dailyRewards.json");

/**
 * Carrega a tabela de recompensas diárias do JSON.
 * @type {Array<{day: number, reward: object}>}
 */
let rewardsTable = [];
try { 
    // Usamos `path.join` para garantir a compatibilidade de caminhos
    rewardsTable = JSON.parse(fs.readFileSync(REWARDS_PATH, "utf-8")); 
} catch (e) { 
    console.error("Erro ao carregar dailyRewards.json:", e.message);
}

// -------------------------
// 🔹 Funções Auxiliares
// -------------------------

/**
 * Calcula a energia bônus baseada na streak atual.
 * @param {number} streak - A sequência atual de logins.
 * @returns {number} A quantidade total de energia a ser concedida.
 */
function calcEnergy(streak) {
  let e = 30;
  if (streak >= 3) e += 10;
  if (streak >= 5) e += 10;
  return e;
}

/**
 * Executa o script JS personalizado definido na recompensa.
 * @param {UserState} user - Objeto do usuário (mutável).
 * @param {object} reward - Objeto da recompensa contendo o campo `script`.
 */
function execScript(user, reward) {
  const scriptCode = reward?.script;
  if (!scriptCode) return;
  try {
    // Passa as funções de economia necessárias para o escopo do script
    new Function("user", "addGold", "addGems", "addXP", "addEnergy", scriptCode)(
      user, addGold, addGems, addXP, addEnergy
    );
  } catch (e) { 
      console.error("❌ Erro na execução do script diário:", e.message); 
  }
}

/**
 * Formata um objeto de recompensa para uma string legível.
 * @param {object} r - O objeto de recompensa.
 * @returns {string} String formatada.
 */
function formatReward(r) {
  if (!r) return "Nenhuma recompensa";
  return [
    r.gold && `💰 +${r.gold} Ouro`,
    r.gems && `💎 +${r.gems} Gemas`,
    r.xp   && `✨ +${r.xp} XP`
  ].filter(Boolean).join(" | ");
}


// ========================================================================
// 🎁 CLAIM DIÁRIO (EXPANDIDO)
// ========================================================================

/**
 * Permite ao usuário coletar a recompensa diária e atualizar a streak.
 * @param {UserState} user - Objeto do usuário (mutável).
 * @returns {string} Mensagem de sucesso e recompensas concedidas.
 * @throws {Error} Se o usuário já coletou hoje.
 */
export function claimDaily(user) {
  const today = new Date().toDateString();
  
  // 1. Inicializa o estado
  user.daily = user.daily || { lastClaim: null, streak: 0, weekChest: 0, month: {} };
  
  if (user.daily.lastClaim === today) {
    throw new Error("📆 Você já coletou o daily hoje!");
  }

  // 2. Calcula a streak
  const last = user.daily.lastClaim ? new Date(user.daily.lastClaim) : new Date(0);
  const isChain = new Date(last.getTime() + ONE_DAY_MS).toDateString() === today;

  user.daily.streak = isChain ? user.daily.streak + 1 : 1;
  // Mantém o ciclo semanal (1 a 7)
  if (user.daily.streak > 7) user.daily.streak = 1;

  // 3. Aplica a recompensa da tabela (se existir)
  const reward = rewardsTable.find(r => r.day === user.daily.streak)?.reward;
  
  if (reward) {
    reward.gold && addGold(user, reward.gold);
    reward.gems && addGems(user, reward.gems);
    reward.xp   && addXP(user, reward.xp);
    execScript(user, reward);
  }

  // 4. Aplica Energia Padrão
  const energy = calcEnergy(user.daily.streak);
  addEnergy(user, energy);

  // 5. Atualiza Cofres
  user.daily.weekChest = (user.daily.weekChest || 0) + (reward?.gold || 0);

  const month = new Date().getMonth();
  user.daily.month[month] = (user.daily.month[month] || 0) + 1;

  // 6. Recompensa secreta (1% de chance)
  let secret = "";
  if (Math.random() <= 0.01) {
    addGems(user, 50);
    secret = "\n🎁 **BÔNUS SECRETO:** +50 gemas!";
  }

  // 7. Finaliza
  user.daily.lastClaim = today;

  return `🎉 Daily (Dia ${user.daily.streak}) coletado!\n${formatReward(reward)}\n⚡ Energia: +${energy}${secret}`;
}

// ========================================================================
// ⏳ DAILY STATUS
// ========================================================================

/**
 * Retorna o status atual do sistema diário do usuário.
 * @param {UserState} user - Objeto do usuário.
 * @returns {string} Mensagem de status.
 */
export function getDailyStatus(user) {
  if (!user.daily) return "📅 Nenhuma informação de daily claim ainda.";
  return `📅 Streak: ${user.daily.streak} dias\n💰 Cofre Semanal: ${user.daily.weekChest} Ouro`;
}

// ========================================================================
// 🧰 COFRE SEMANAL — RECOLHER
// ========================================================================

/**
 * Permite ao usuário recolher o ouro acumulado no cofre semanal.
 * @param {UserState} user - Objeto do usuário (mutável).
 * @returns {string} Mensagem de status ou sucesso.
 */
export function claimWeeklyChest(user) {
  const amount = user.daily?.weekChest || 0;
  if (amount === 0) return "📦 Seu cofre semanal está vazio.";
  
  addGold(user, amount);
  user.daily.weekChest = 0;
  
  return `📦 Você abriu o Cofre Semanal e ganhou **${amount} ouro**!`;
}

// ========================================================================
// ⭐ COFRE MENSAL — Recolher
// ========================================================================

/**
 * Permite ao usuário recolher o prêmio mensal após 25 dias de login.
 * @param {UserState} user - Objeto do usuário (mutável).
 * @returns {string} Mensagem de status ou sucesso.
 */
export function claimMonthlyReward(user) {
  const month = new Date().getMonth();
  const days = user.daily?.month?.[month] || 0;
  
  if (days < 25) {
      return `📆 Você precisa de **25 dias** de login neste mês para ganhar o prêmio mensal! (Dias coletados: ${days})`;
  }
  
  const rewardGems = 150;
  addGems(user, rewardGems);
  user.daily.month[month] = 0; // Zera a contagem para o mês atual
  
  return `🌙 **Recompensa Mensal:** +${rewardGems} Gemas!`;
}

// ========================================================================
// 🧪 DAILY VIP (Pago com gemas)
// ========================================================================

/**
 * Permite ao usuário gastar gemas para obter uma recompensa bônus aleatória.
 * @param {UserState} user - Objeto do usuário (mutável).
 * @returns {string} Mensagem de status ou sucesso.
 */
export function claimDailyVIP(user) {
  // 1. Tenta gastar as gemas
  const success = spendGems(user, DAILY_VIP_COST);
  if (!success) return `❌ Você precisa de ${DAILY_VIP_COST} gemas.`;

  // 2. Gera o multiplicador aleatório (2x a 4x)
  const bonus = Math.floor(Math.random() * 3) + 2; 
  
  // 3. Calcula e aplica recompensas
  const baseGold = 3000;
  const baseXp = 100;
  const gold = baseGold * bonus;
  const xp   = baseXp * bonus;

  addGold(user, gold);
  addXP(user, xp);

  return `💎 **Daily VIP**\n🎁 Ouro: +${gold} | XP: +${xp}\n🔥 Multiplicador: x${bonus}`;
}

// ========================================================================
// 🎰 SORTEIO DIÁRIO EXPANDIDO
// ========================================================================

/**
 * Permite ao usuário participar de um sorteio diário com base em chances.
 * @param {UserState} user - Objeto do usuário (mutável).
 * @returns {string} Mensagem de status ou recompensa.
 */
export function dailyDraw(user) {
  const now = Date.now();
  
  // 1. Inicializa o estado e verifica Cooldown
  user.dailyDraw = user.dailyDraw || { lastDraw: 0 };
  if (now - user.dailyDraw.lastDraw < ONE_DAY_MS) {
    const remainingTime = new Date(user.dailyDraw.lastDraw + ONE_DAY_MS - now);
    const hours = remainingTime.getUTCHours();
    const minutes = remainingTime.getUTCMinutes();
    return `⏳ Você já participou do sorteio hoje. Tente novamente em ${hours}h ${minutes}m.`;
  }

  user.dailyDraw.lastDraw = now;

  // 2. Tabela de chances
  const table = [
    { t: "gold", amount: 3000, chance: 35 },
    { t: "gems", amount: 30,  chance: 25 },
    { t: "coupon", amount: 1, chance: 15 },
    { t: "card", rarity: 3,   chance: 12 },
    { t: "card", rarity: 4,   chance: 7 },
    { t: "card", rarity: 5,   chance: 5 },
    { t: "jackpot", gems: 200, chance: 1 } // JACKPOT (1%)
  ];

  // 3. Rola a sorte
  const roll = Math.random() * 100;
  let acc = 0, pick = table[0];
  for (const r of table) { 
      acc += r.chance; 
      if (roll <= acc) { 
          pick = r; 
          break; 
      } 
  }

  // 4. Aplica a recompensa
  switch (pick.t) {
    case "gold": 
        addGold(user, pick.amount); 
        return `💰 Você ganhou **${pick.amount} ouro**!`;
    case "gems": 
        addGems(user, pick.amount); 
        return `💎 Você ganhou **${pick.amount} gemas**!`;
    case "coupon": 
        addCoupons(user, pick.amount); 
        return `🎟️ Você ganhou **${pick.amount} cupom**!`;
    case "card":
      const cardId = getRandomCardIdByRarity(pick.rarity);
      giveCardToUser(user, cardId); // Assume que a função usa o ID
      return `✨ Você recebeu uma Carta **${pick.rarity}★**!`;
    case "jackpot":
      addGems(user, pick.gems);
      return `🎰 **JACKPOT!** 💎 +${pick.gems} Gemas!`;
  }
}
