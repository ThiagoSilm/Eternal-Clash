// src/systems/rngSystem.js
// Sistema de RNG (Random Number Generator) para batalhas, mapas, eventos, etc.

/**
 * Retorna um número aleatório inteiro entre min e max (inclusive)
 * @param {number} min 
 * @param {number} max 
 * @returns {number}
 */
export function rng(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Retorna true com a chance percentual informada
 * @param {number} percent 0-100
 * @returns {boolean}
 */
export function chance(percent) {
    return Math.random() * 100 < percent;
}