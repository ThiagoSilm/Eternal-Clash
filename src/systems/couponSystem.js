// src/systems/couponSystem.js
//------------------------------------------------------------
// Coupon System - Gerenciamento de Cupons / Recompensas
//------------------------------------------------------------

// Banco de cupons fictício
const COUPONS = [
  { code: "WELCOME100", type: "gold", value: 100 },
  { code: "DAILY50", type: "gold", value: 50 },
  { code: "GEM10", type: "gem", value: 10 }
];

// ------------------ FUNÇÃO PARA OBTER CUPOM ------------------
/**
 * Retorna um cupom pelo código
 * @param {string} code 
 * @returns {Object|null}
 */
export function getCoupon(code) {
  if (!code) return null;
  return COUPONS.find(c => c.code.toUpperCase() === code.toUpperCase()) || null;
}

// ------------------ FUNÇÃO PARA VALIDAR CUPOM ------------------
/**
 * Verifica se o cupom é válido
 * @param {string} code 
 * @returns {boolean}
 */
export function isValidCoupon(code) {
  return !!getCoupon(code);
}

// ------------------ FUNÇÃO PARA RESGATAR CUPOM ------------------
/**
 * Resgata um cupom para um usuário (simples placeholder)
 * @param {Object} user 
 * @param {string} code 
 * @returns {boolean} sucesso
 */
export function redeemCoupon(user, code) {
  const coupon = getCoupon(code);
  if (!coupon) return false;

  switch (coupon.type) {
    case "gold":
      user.gold = (user.gold || 0) + coupon.value;
      break;
    case "gem":
      user.gems = (user.gems || 0) + coupon.value;
      break;
    default:
      return false;
  }
  return true;
}