// src/systems/rewardSystem.js

// Importa as funções de mutação do sistema econômico
import { addEnergy, spendGems, addGems } from "./economySystem.js";

// ----------------------------------------------------
// ⚙️ CONFIGURAÇÕES & CONSTANTES
// ----------------------------------------------------

// Definições dos períodos de bônus por hora (startHour é inclusivo, endHour é exclusivo)
const BONUS_PERIODS = [
  { startHour: 10, endHour: 15, energy: 30, name: "Manhã Reforçada" },
  { startHour: 20, endHour: 22, energy: 20, name: "Noite de Batalha" }
];

// Definições dos bônus semanais (0=Domingo, 1=Segunda, etc.)
const WEEKLY_BONUS = {
  1: { energy: 40, name: "Turbo Segunda" },
  3: { energy: 25, name: "Quarta de Ritmo" },
  5: { energy: 50, name: "Sexta Insana" },
};

// Configuração do evento raro
const MEGA_EVENT = {
  chance: 0.06, // 6% de chance por chamada
  energy: 120,
  name: "Tempestade Arcana"
};

// Configurações de compra de energia
const BUY_LIMIT_PER_DAY = 10;
const ENERGY_PER_GEM = 40;

// Constante de tempo em milissegundos
const ONE_DAY_MS = 86400000;

/**
 * @typedef {object} UserState
 * @property {string} id
 * @property {number} gold
 * @property {number} gems
 * @property {number} energy
 * @property {Object.<string, boolean>} [dailyBonusReceived={}] - Marca quais bônus diários/horários foram pegos.
 * @property {Object.<string, number>} [energyPurchases={}] - Histórico de compras de energia por dia.
 * @property {number} [streak=0] - Contagem atual de dias seguidos.
 * @property {string | null} [lastStreakDay=null] - Data da última atualização do streak (YYYY-MM-DD).
 * @property {Object} [energyMission] - Estado da missão de gasto de energia.
 * @property {number} energyMission.spent
 * @property {number} energyMission.target
 */

// ----------------------------------------------------
// 🔹 GETTERS & UTILITÁRIOS
// ----------------------------------------------------

/**
 * Retorna a chave do dia atual no formato YYYY-MM-DD.
 * @returns {string}
 */
function getTodayKey() {
  return new Date().toISOString().split("T")[0];
}

/**
 * Encontra o bônus ativo baseado na hora atual.
 * @param {number} hour - Hora atual (0 a 23).
 * @returns {object | null} O objeto de bônus ou null se não houver.
 */
function getActiveBonus(hour) {
  return BONUS_PERIODS.find(p => hour >= p.startHour && hour < p.endHour) || null;
}

// ----------------------------------------------------
// ⚡ COMPRA DE ENERGIA (LIMITADA)
// ----------------------------------------------------

/**
 * Permite ao usuário comprar energia usando gemas, respeitando o limite diário.
 * @param {UserState} user - Objeto do usuário (mutável).
 * @param {number} [gemsSpent=1] - Quantidade de gemas a serem gastas.
 * @returns {string} Mensagem de status.
 */
export function buyEnergy(user, gemsSpent = 1) {
  const parsedGems = parseInt(gemsSpent);
  if (isNaN(parsedGems) || parsedGems <= 0) return "❌ Quantidade inválida de gemas.";
  
  const today = getTodayKey();
  
  // 1. Inicializa o histórico
  user.energyPurchases = user.energyPurchases || {};
  user.energyPurchases[today] = user.energyPurchases[today] || 0;
  
  // 2. Verifica o limite diário
  if (user.energyPurchases[today] >= BUY_LIMIT_PER_DAY) {
    return `🚫 Você atingiu o limite diário de **${BUY_LIMIT_PER_DAY} compras**.`;
  }
  
  // 3. Tenta gastar as gemas
  const gemsSuccess = spendGems(user, parsedGems); // Assume que spendGems retorna boolean
  if (!gemsSuccess) {
    return `❌ Gemas insuficientes! Você precisa de ${parsedGems} Gemas.`;
  }
  
  // 4. Adiciona energia e verifica se foi adicionada
  const amount = ENERGY_PER_GEM * parsedGems;
  const added = addEnergy(user, amount); // Assume que addEnergy retorna a quantidade REALMENTE adicionada
  
  if (added === 0) {
    addGems(user, parsedGems); // Reembolso total se a energia estiver cheia
    return `⚠️ Energia já está cheia! Suas ${parsedGems} gemas foram reembolsadas.`;
  }
  
  // 5. Registra a compra (apenas se a energia foi adicionada com sucesso)
  user.energyPurchases[today] += parsedGems;
  
  return `⚡ Você comprou **${added} energia** usando ${parsedGems} gemas. Compras hoje: ${user.energyPurchases[today]}/${BUY_LIMIT_PER_DAY}`;
}

// ----------------------------------------------------
// 🔥 BÔNUS DIÁRIO COMPLEXO
// ----------------------------------------------------

/**
 * Aplica o bônus por horário, semanal e a chance de evento raro.
 * @param {UserState} user - Objeto do usuário (mutável).
 * @returns {string} Mensagens concatenadas de bônus aplicados ou notificação.
 */
export function checkAndApplyBonus(user) {
  const now = new Date();
  const hour = now.getHours();
  const weekday = now.getDay(); // 0 (Domingo) - 6 (Sábado)
  const key = getTodayKey();
  
  // Inicializa o histórico de bônus
  user.dailyBonusReceived = user.dailyBonusReceived || {};
  
  let messages = [];
  
  // 1) Bônus por horário
  const hourBonus = getActiveBonus(hour);
  if (hourBonus) {
    const hourKey = `${key}_hour_${hourBonus.startHour}`;
    if (!user.dailyBonusReceived[hourKey]) {
      addEnergy(user, hourBonus.energy);
      user.dailyBonusReceived[hourKey] = true;
      messages.push(`🎉 Bônus **${hourBonus.name}**: +${hourBonus.energy} Energia.`);
    }
  }
  
  // 2) Bônus semanal fixo
  if (WEEKLY_BONUS[weekday]) {
    const w = WEEKLY_BONUS[weekday];
    const weekKey = `${key}_weekly`;
    if (!user.dailyBonusReceived[weekKey]) {
      addEnergy(user, w.energy);
      user.dailyBonusReceived[weekKey] = true;
      messages.push(`📅 Bônus de **${w.name}**: +${w.energy} Energia.`);
    }
  }
  
  // 3) Mega evento raro
  if (Math.random() < MEGA_EVENT.chance) {
    const eventKey = `${key}_mega`;
    if (!user.dailyBonusReceived[eventKey]) {
      addEnergy(user, MEGA_EVENT.energy);
      user.dailyBonusReceived[eventKey] = true;
      messages.push(`🌩️ Evento Lendário: **${MEGA_EVENT.name}**! +${MEGA_EVENT.energy} Energia.`);
    }
  }
  
  if (messages.length === 0) {
      return `⏳ Nenhum bônus novo disponível agora.`;
  }
  return messages.join("\n");
}

// ----------------------------------------------------
// 🔥 COMBO STREAK DIÁRIO
// ----------------------------------------------------

/**
 * Atualiza e aplica o bônus de sequência (streak) diária de login.
 * @param {UserState} user - Objeto do usuário (mutável).
 * @returns {string} Mensagem de status do streak.
 */
export function applyDailyStreak(user) {
  const today = getTodayKey();
  const last = user.lastStreakDay;
  
  // Inicializa o streak
  user.streak = user.streak || 0;
  
  if (last === today) return `🔥 Streak já registrada hoje.`;
  
  // Calcula o dia de ontem
  const yesterdayDate = new Date(Date.now() - ONE_DAY_MS);
  const yesterdayKey = yesterdayDate.toISOString().split("T")[0];
  
  if (last === yesterdayKey) {
    // Continua a sequência
    user.streak++;
  } else {
    // Quebra ou inicia a sequência
    user.streak = 1;
  }
  
  user.lastStreakDay = today;
  
  // Recompensa que escala
  const reward = 10 + user.streak * 2; 
  addEnergy(user, reward);
  
  return `🔥 Streak **${user.streak} dias** — +${reward} energia!`;
}

// ----------------------------------------------------
// 🎯 MISSÃO INTERNA: GASTAR ENERGIA
// ----------------------------------------------------

/**
 * Registra o gasto de energia e verifica se a missão foi completada.
 * Deve ser chamado sempre que o usuário gastar energia no jogo.
 * @param {UserState} user - Objeto do usuário (mutável).
 * @param {number} amount - Quantidade de energia gasta.
 * @returns {string | null} Mensagem de recompensa da missão se completada, ou null.
 */
export function registerEnergySpent(user, amount) {
  const parsedAmount = parseInt(amount);

  if (isNaN(parsedAmount) || parsedAmount <= 0) return null; // Ignora gastos inválidos
  
  // Inicializa a missão
  user.energyMission = user.energyMission || { spent: 0, target: 300 };
  
  user.energyMission.spent += parsedAmount;
  
  let rewardMessage = null;
  
  if (user.energyMission.spent >= user.energyMission.target) {
    // Missão completada
    const energyReward = 80;
    addEnergy(user, energyReward);
    
    // Reseta a contagem da missão
    user.energyMission.spent = 0; 
    
    rewardMessage = `🏆 Missão “Gaste Energia” completada! +${energyReward} Energia`;
  }
  
  return rewardMessage;
}
