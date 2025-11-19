// src/systems/rngSystem.js
// RNG robusto para batalhas, mapas, eventos, loot, etc.

let _seed = Date.now() % 2147483647;
const MOD = 2147483647;

/**
 * Configura uma seed para RNG reproduzível
 * @param {number} seed
 */
export function setSeed(seed) {
  _seed = seed % MOD;
}

/**
 * Gerador de número pseudo-aleatório baseado em seed (LCG)
 * @returns {number} entre 0 e 1
 */
export function random() {
  _seed = (_seed * 48271) % MOD;
  return _seed / MOD;
}

/**
 * Retorna um número inteiro entre min e max (inclusive)
 * @param {number} min
 * @param {number} max
 */
export function rng(min, max) {
  return Math.floor(random() * (max - min + 1)) + min;
}

/**
 * Retorna true com a chance percentual informada
 * @param {number} percent 0-100
 */
export function chance(percent) {
  return random() * 100 < percent;
}

/**
 * Retorna true com chance decimal (0-1)
 * @param {number} p
 */
export function chanceDecimal(p) {
  return random() < p;
}

/**
 * Escolha ponderada: { item: weight }
 * @param {Array} arr - array de itens
 * @param {Array} weights - array de pesos correspondentes
 */
export function weightedChoice(arr, weights) {
  const sum = weights.reduce((a, b) => a + b, 0);
  const r = random() * sum;
  let cum = 0;
  for (let i = 0; i < arr.length; i++) {
    cum += weights[i];
    if (r < cum) return arr[i];
  }
  return arr[arr.length - 1];
}

/**
 * Simula rolagem de dados (e.g., "3d6" = 3 dados de 6 faces)
 * @param {number} dice
 * @param {number} sides
 */
export function rollDice(dice, sides) {
  let total = 0;
  for (let i = 0; i < dice; i++) {
    total += rng(1, sides);
  }
  return total;
}