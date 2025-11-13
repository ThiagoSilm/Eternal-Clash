// src/systems/economySystem.js

// ❌ REMOVIDO: import { loadUserCached, markUserDirty } from "./userCacheSystem.js";
// A economia opera no objeto 'user' passado, e a marcação 'dirty' deve ser feita
// pela camada superior (Middleware ou a função de comando).

/**
 * [HELPER] Calcula o XP total necessário para o próximo nível.
 */
export function spendEnergy(user, amount) {
  if ((user.energy || 0) < amount) {
    throw new Error("Energia insuficiente.");
  }
  user.energy -= amount;
  return true;
}

export function getXPForNextLevel(currentLevel) {
  // Fórmula Exponencial: Base * (Nível ^ 2.2)
  return Math.floor(1000 * Math.pow(currentLevel, 2.2));
}

// --- FUNÇÕES DE RECURSOS (Operam no objeto 'user') ---

/**
 * Adiciona ouro ao usuário
 * @param {object} user O objeto usuário a ser modificado.
 * @param {number} amount A quantidade a adicionar.
 */
export function addGold(user, amount) {
  user.gold = (user.gold || 0) + amount;
  // ❌ REMOVIDO: markUserDirty(userId);
}

/**
 * Gasta ouro do usuário
 * @param {object} user O objeto usuário a ser modificado.
 * @param {number} amount A quantidade a gastar.
 * @returns {boolean} True se o gasto for bem-sucedido, false se insuficiente.
 */
export function spendGold(user, amount) {
  if ((user.gold || 0) < amount) {
    // 🎯 Melhor Prática: Lançar um erro para o comando capturar.
    throw new Error("Ouro insuficiente.");
    // return false; // Alternativa menos robusta, mas mantida por consistência
  }
  user.gold -= amount;
  // ❌ REMOVIDO: markUserDirty(userId);
  return true;
}

/**
 * Adiciona gemas ao usuário
 * @param {object} user O objeto usuário a ser modificado.
 * @param {number} amount A quantidade a adicionar.
 */
export function addGems(user, amount) {
  user.gems = (user.gems || 0) + amount;
  // ❌ REMOVIDO: markUserDirty(userId);
}

/**
 * Gasta gemas
 * @param {object} user O objeto usuário a ser modificado.
 * @param {number} amount A quantidade a gastar.
 * @returns {boolean} True se o gasto for bem-sucedido.
 * @throws {Error} Se insuficiente.
 */
export function spendGems(user, amount) {
  if ((user.gems || 0) < amount) {
    // 🎯 Melhor Prática: Lançar um erro.
    throw new Error("Gemass insuficientes.");
  }
  user.gems -= amount;
  // ❌ REMOVIDO: markUserDirty(userId);
  return true;
}

/**
 * Adiciona cupom ao usuário
 * @param {object} user O objeto usuário a ser modificado.
 * @param {number} amount A quantidade a adicionar.
 */
export function addCoupons(user, amount) {
  user.coupons = (user.coupons || 0) + amount;
  // ❌ REMOVIDO: markUserDirty(userId);
}

/**
 * Gasta cupom
 * @param {object} user O objeto usuário a ser modificado.
 * @param {number} amount A quantidade a gastar.
 * @returns {boolean} True se o gasto for bem-sucedido.
 * @throws {Error} Se insuficiente.
 */
export function spendCoupons(user, amount) {
  if ((user.coupons || 0) < amount) {
    // 🎯 Melhor Prática: Lançar um erro.
    throw new Error("Cupons insuficientes.");
  }
  user.coupons -= amount;
  // ❌ REMOVIDO: markUserDirty(userId);
  return true;
}

export function spendCurrency(user, type, amount) {
  switch (type.toLowerCase()) {
    case 'gold':
      return spendGold(user, amount);
    case 'gems':
    case 'gem': // Alias
      return spendGems(user, amount);
    case 'coupons':
    case 'coupon': // Alias
      return spendCoupons(user, amount);
    case 'energy':
      return spendEnergy(user, amount);
    default:
      throw new Error(`Moeda '${type}' inválida.`);
  }
}


export function addXP(user, amount) {
  user.level = user.level || 1;
  user.xp = user.xp || 0;
  
  user.xp += amount;
  let levelUpMessage = null;
  
  // Loop WHILE para processar MÚLTIPLOS NÍVEIS
  while (true) {
    const xpForNext = getXPForNextLevel(user.level);
    
    if (user.xp >= xpForNext) {
      user.xp -= xpForNext;
      user.level++;
      
      const msg = `✨ Subiu para o nível ${user.level}!`;
      levelUpMessage = levelUpMessage ? `${levelUpMessage}\n${msg}` : msg;
      
      // Recompensa de nível deve ser aplicada aqui (ex: addGems, addEnergy)
      
    } else {
      break;
    }
  }
  
  
  return levelUpMessage;
}


export function addEnergy(ser, amount) {
    if (typeof amount !== 'number' || amount <= 0) return false;
    
    // Inicializa a estrutura se necessário
    if (!user.energy) user.energy = { current: 0, max: 100 };
    
    // Adiciona a energia, garantindo que não exceda o máximo (opcional, dependendo da sua regra de negócio)
    // 💡 Para itens de loja, geralmente a energia pode exceder o máximo. 
    // Vamos apenas adicionar, mas você pode limitar se necessário.
    user.energy.current = (user.energy.current || 0) + amount;
    
    // 🟢 Sinaliza que o objeto do usuário foi modificado
    markUserDirty(user.id);
    
    return true;
}
