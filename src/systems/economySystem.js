import { markUserDirty } from "./userCacheSystem.js";

// --- Configurações ---
const DEFAULT_MAX_ENERGY = 100;
const REGEN_RATE_MS = 5 * 60 * 1000; // 5 minutos por ponto de energia

// -------------------------------------------------------------------
// 💰 FUNÇÕES DE CÁLCULO E ADIÇÃO DE RECURSOS
// -------------------------------------------------------------------

/**
 * Calcula a XP necessária para o próximo nível.
 */
export function getXPForNextLevel(currentLevel) {
  return Math.floor(1000 * Math.pow(currentLevel, 2.2));
}

/**
 * Adiciona XP ao usuário, verifica e aplica subida de nível.
 * @returns {string | null} Mensagem de subida de nível se ocorreu.
 */
export function addXP(user, amount) {
  user.level = user.level || 1;
  user.xp = user.xp || 0;
  user.xp += amount;

  let levelUpMessage = null;

  while (true) {
    const xpForNext = getXPForNextLevel(user.level);
    if (user.xp >= xpForNext) {
      user.xp -= xpForNext;
      user.level++;
      const msg = `✨ Subiu para o nível ${user.level}!`;
      levelUpMessage = levelUpMessage ? `${levelUpMessage}\n${msg}` : msg;
    } else break;
  }
  markUserDirty(user.id);
  return levelUpMessage;
}

/**
 * Adiciona Ouro.
 */
export function addGold(user, amount) {
  user.gold = (user.gold || 0) + amount;
  markUserDirty(user.id);
}

/**
 * Adiciona Gemas.
 */
export function addGems(user, amount) {
  user.gems = (user.gems || 0) + amount;
  markUserDirty(user.id);
}

/**
 * Adiciona Cupons.
 */
export function addCoupons(user, amount) {
  user.coupons = (user.coupons || 0) + amount;
  markUserDirty(user.id);
}

/**
 * Adiciona energia ao usuário, respeitando o limite máximo (user.energy.max).
 * @param {object} user - Objeto usuário.
 * @param {number} amount - Quantidade de energia a adicionar.
 * @returns {number} Energia realmente adicionada.
 */
export function addEnergy(user, amount) {
  if (typeof amount !== 'number' || amount <= 0) return 0;
  
  // Inicializa a estrutura de energia se necessário
  if (!user.energy) user.energy = { current: 0, max: DEFAULT_MAX_ENERGY };

  const maxEnergy = user.energy.max ?? DEFAULT_MAX_ENERGY;
  const current = user.energy.current || 0;
  
  const newTotal = Math.min(current + amount, maxEnergy);
  const actualAdded = newTotal - current;
  
  if (actualAdded > 0) {
    user.energy.current = newTotal;
    markUserDirty(user.id);
  }
  return actualAdded;
}


// -------------------------------------------------------------------
// 📉 FUNÇÕES DE GASTO DE RECURSOS (Retorna boolean em caso de falha)
// -------------------------------------------------------------------

/**
 * Tenta gastar Ouro do usuário.
 * @returns {boolean} True se o gasto foi bem-sucedido, False caso contrário.
 */
export function spendGold(user, amount) {
  if ((user.gold || 0) < amount) return false;
  user.gold -= amount;
  markUserDirty(user.id);
  return true;
}

/**
 * Tenta gastar Gemas do usuário.
 * @returns {boolean} True se o gasto foi bem-sucedido, False caso contrário.
 */
export function spendGems(user, amount) {
  if ((user.gems || 0) < amount) return false;
  user.gems -= amount;
  markUserDirty(user.id);
  return true;
}

/**
 * Tenta gastar Cupons do usuário.
 * @returns {boolean} True se o gasto foi bem-sucedido, False caso contrário.
 */
export function spendCoupons(user, amount) {
  if ((user.coupons || 0) < amount) return false;
  user.coupons -= amount;
  markUserDirty(user.id);
  return true;
}

/**
 * Tenta gastar energia do usuário.
 * @returns {boolean} True se o gasto foi bem-sucedido, False caso contrário.
 */
export function spendEnergy(user, amount) {
  // Acesso seguro à estrutura de energia padronizada
  if (!user.energy || (user.energy.current || 0) < amount) return false;
  user.energy.current -= amount;
  markUserDirty(user.id);
  return true;
}

/**
 * Função genérica para gastar qualquer moeda, usando o padrão de retorno boolean.
 * @param {object} user - Objeto usuário.
 * @param {string} type - Tipo da moeda ('gold', 'gems', 'coupons', 'energy').
 * @param {number} amount - Quantidade a ser gasta.
 * @returns {boolean} True se o gasto foi bem-sucedido, False se falhou ou moeda inválida.
 */
export function spendCurrency(user, type, amount) {
  switch (type.toLowerCase()) {
    case 'gold': return spendGold(user, amount);
    case 'gems':
    case 'gem': return spendGems(user, amount);
    case 'coupons':
    case 'coupon': return spendCoupons(user, amount);
    case 'energy': return spendEnergy(user, amount);
    default: return false;
  }
}

// -------------------------------------------------------------------
// ⚙️ FUNÇÕES DE REGENERAÇÃO (Baseada em tempo)
// -------------------------------------------------------------------

/**
 * Verifica e aplica a regeneração de energia baseada no tempo desde a última verificação.
 * @returns {string | null} Mensagem de regeneração se ocorreu, ou null.
 */
export function regenerateEnergy(user) {
  // Inicializa a estrutura de energia se necessário
  if (!user.energy) user.energy = { current: DEFAULT_MAX_ENERGY, max: DEFAULT_MAX_ENERGY, lastRegen: Date.now() };

  const now = Date.now();
  const lastRegen = user.energy.lastRegen || now;
  
  // quantos pontos poderiam ser regenerados desde o último tick
  const elapsed = now - lastRegen;
  const regenPoints = Math.floor(elapsed / REGEN_RATE_MS);
  
  if (regenPoints > 0) {
    const current = user.energy.current || 0;
    const max = user.energy.max ?? DEFAULT_MAX_ENERGY;
    
    user.energy.current = Math.min(max, current + regenPoints);
    
    // Ajusta lastRegen para o tempo exato onde o último ponto foi ganho.
    user.energy.lastRegen = now - (elapsed % REGEN_RATE_MS);
    
    markUserDirty(user.id);
    return `Sua energia foi regenerada em ${regenPoints} ponto(s)! ⚡ (${user.energy.current}/${max})`;
  }
  
  return null; // ainda não passou tempo suficiente
}