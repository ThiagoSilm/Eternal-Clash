// src/systems/couponSystem.js
// Sistema de gerenciamento de cupons/recompensas em memória.

/**
 * @type {Map<string, number>}
 * Mapa que armazena a quantidade de cupons de cada usuário.
 * Chave: ID do Usuário (string).
 * Valor: Quantidade de Cupons (number).
 */
const userCoupons = new Map();

// --- ➕ Funções Principais de Gestão ---

/**
 * Adiciona uma quantidade específica de cupons ao saldo de um usuário.
 * Se o usuário não existir no mapa, ele é inicializado com 0.
 * @param {{id: string}} user - O objeto do usuário, contendo pelo menos a propriedade 'id'.
 * @param {number} amount - A quantidade de cupons a ser adicionada. Deve ser um número positivo.
 * @returns {number} O novo saldo de cupons do usuário.
 */
export function addCoupons(user, amount) {
  if (typeof user !== 'object' || !user.id) {
    throw new Error("Objeto de usuário inválido.");
  }
  const currentAmount = userCoupons.get(user.id) || 0;
  const newAmount = currentAmount + (amount > 0 ? amount : 0);
  
  userCoupons.set(user.id, newAmount);
  return newAmount;
}

/**
 * Consulta a quantidade atual de cupons de um usuário.
 * @param {{id: string}} user - O objeto do usuário.
 * @returns {number} O saldo de cupons do usuário. Retorna 0 se o usuário não tiver cupons registrados.
 */
export function getCoupons(user) {
  if (typeof user !== 'object' || !user.id) {
    throw new Error("Objeto de usuário inválido.");
  }
  return userCoupons.get(user.id) || 0;
}

/**
 * Remove uma quantidade específica de cupons do saldo de um usuário, garantindo que o saldo não seja negativo.
 * @param {{id: string}} user - O objeto do usuário.
 * @param {number} amount - A quantidade de cupons a ser removida. Deve ser um número positivo.
 * @returns {number} O novo saldo de cupons do usuário.
 */
export function removeCoupons(user, amount) {
  if (typeof user !== 'object' || !user.id) {
    throw new Error("Objeto de usuário inválido.");
  }
  
  const currentAmount = userCoupons.get(user.id) || 0;
  
  if (amount <= 0) {
    return currentAmount; // Não remove valores negativos ou zero
  }
  
  const newAmount = Math.max(0, currentAmount - amount);
  userCoupons.set(user.id, newAmount);
  
  return newAmount;
}

// --- 🧪 Função de Utilitário Adicional (Opcional) ---

/**
 * Verifica se um usuário possui a quantidade mínima necessária de cupons.
 * @param {{id: string}} user - O objeto do usuário.
 * @param {number} amount - A quantidade mínima necessária.
 * @returns {boolean} Verdadeiro se o usuário tiver o saldo suficiente.
 */
export function hasEnoughCoupons(user, amount) {
    return getCoupons(user) >= amount;
}
