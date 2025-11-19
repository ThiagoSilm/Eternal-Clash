// src/systems/luckySpinSystem.js
import { addGems, spendGold } from "./economySystem.js";
import { markUserDirty } from "./userCacheSystem.js";

// -----------------------------------------------------
// ⚙️ CONFIGURAÇÃO CENTRALIZADA
// -----------------------------------------------------

const SPIN_CONSTANTS = Object.freeze({
  NORMAL_COST: 100, // Ouro por spin normal
  MEGA_SPIN_FREQUENCY: 10, // A cada 10 spins
  USER_DATA_KEY: 'luckySpin'
});

const REWARD_POOLS = Object.freeze({
  NORMAL: [
    { gems: 1, chance: 40, rarity: "common" },
    { gems: 3, chance: 25, rarity: "rare" },
    { gems: 5, chance: 15, rarity: "epic" },
    { gems: 10, chance: 8, rarity: "legendary" },
    { gems: 25, chance: 5, rarity: "mythic" },
    { gems: 100, chance: 1, rarity: "jackpot" }
  ],
  MEGA: [
    { gems: 5, chance: 40, rarity: "rare" },
    { gems: 10, chance: 25, rarity: "epic" },
    { gems: 25, chance: 15, rarity: "legendary" },
    { gems: 50, chance: 10, rarity: "mythic" },
    { gems: 250, chance: 5, rarity: "jackpot" }
  ]
});

// -----------------------------------------------------
// 🎲 FUNÇÕES DE UTENSÍLIO
// -----------------------------------------------------

/**
 * Rola uma recompensa com base nas chances definidas.
 * @param {Array<{gems: number, chance: number, rarity: string}>} pool A lista de recompensas.
 * @returns {object} A recompensa sorteada.
 */
function rollReward(pool) {
  // O cálculo do total deve ser feito apenas uma vez se a pool for constante,
  // mas é seguro fazê-lo aqui.
  const total = pool.reduce((acc, r) => acc + r.chance, 0);
  let rand = Math.random() * total;
  
  for (const reward of pool) {
    rand -= reward.chance;
    if (rand <= 0) return reward;
  }
  
  // Fallback (deve retornar o último item se houver erro de precisão)
  return pool[pool.length - 1];
}

/**
 * Inicializa ou retorna o objeto de estado do Lucky Spin do usuário.
 * @param {object} user Objeto do usuário.
 * @returns {object} O estado do Lucky Spin.
 */
function getSpinState(user) {
  if (!user[SPIN_CONSTANTS.USER_DATA_KEY]) {
    user[SPIN_CONSTANTS.USER_DATA_KEY] = {
      spins: 0,
    };
    markUserDirty(user.id);
  }
  return user[SPIN_CONSTANTS.USER_DATA_KEY];
}


// -----------------------------------------------------
// 🎡 EXECUÇÃO DO SPIN
// -----------------------------------------------------

/**
 * Executa a lógica de giro e concessão de gemas.
 * @param {object} user Objeto do usuário.
 * @param {boolean} isMega Se deve usar o Mega Pool de recompensas.
 * @returns {{msg: string, rarity: string}} Resultado do spin.
 */
export function executeSpin(user, isMega = false) {
  const pool = isMega ? REWARD_POOLS.MEGA : REWARD_POOLS.NORMAL;
  const reward = rollReward(pool);
  
  addGems(user, reward.gems);
  
  return {
    msg: `💎 Você ganhou **${reward.gems} gemas** (Raridade: ${reward.rarity.toUpperCase()})!`,
    rarity: reward.rarity
  };
}

// -----------------------------------------------------
// 🎰 FUNÇÃO PRINCIPAL DO LUCKY SPIN
// -----------------------------------------------------

/**
 * Lida com o custo, determina o tipo de spin (Mega) e executa a recompensa.
 * @param {object} user Objeto do usuário.
 * @param {boolean} useFree Se o spin é gratuito (pula o custo de ouro).
 * @returns {{msg: string, rarity: string}} O resultado final do spin.
 */
export function spinLucky(user, useFree = false) {
  const state = getSpinState(user);
  
  // 1. Lógica de Custo
  if (!useFree) {
    try {
      spendGold(user, SPIN_CONSTANTS.NORMAL_COST);
    } catch (err) {
      // Retorna a mensagem de erro de forma clara
      return { msg: `❌ ${err.message}`, rarity: "fail" };
    }
  }
  
  // 2. Determinar Mega Spin
  // O +1 garante que a contagem seja verificada *após* o spin atual.
  const isMega = ((state.spins + 1) % SPIN_CONSTANTS.MEGA_SPIN_FREQUENCY === 0);
  
  // 3. Executar Spin e Atualizar Estado
  const result = executeSpin(user, isMega);
  
  state.spins++;
  markUserDirty(user.id); // Marca o usuário como dirty após a mudança de spins
  
  // 4. Formatar Mensagem
  if (isMega) {
    result.msg = `🌟 **MEGA SPIN #${state.spins}!**\n${result.msg}`;
  }
  if (result.rarity === "jackpot") {
    result.msg = `🎰 **JACKPOT!!!** Você ficou rico!\n${result.msg}`;
  }
  
  return result;
}