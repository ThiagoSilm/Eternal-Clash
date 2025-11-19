// src/systems/couponSystem.js
// Sistema de cupons diários ou recompensas

const userCoupons = new Map();

/**
 * Adiciona cupons a um usuário
 * @param {object} user 
 * @param {number} amount 
 */
export function addCoupons(user, amount) {
  if (!userCoupons.has(user.id)) {
    userCoupons.set(user.id, 0);
  }
  userCoupons.set(user.id, userCoupons.get(user.id) + amount);
}

/**
 * Consulta a quantidade de cupons de um usuário
 * @param {object} user 
 * @returns {number}
 */
export function getCoupons(user) {
  return userCoupons.get(user.id) || 0;
}

/**
 * Remove cupons de um usuário
 * @param {object} user 
 * @param {number} amount 
 */
export function removeCoupons(user, amount) {
  if (!userCoupons.has(user.id)) return;
  userCoupons.set(user.id, Math.max(0, userCoupons.get(user.id) - amount));
}