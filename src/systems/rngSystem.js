// src/systems/rngSystem.js

// ----------------------------------------------------------------
// ⚙️ CONFIGURAÇÃO & ESTADO INTERNO (LCG - Linear Congruential Generator)
// ----------------------------------------------------------------

/**
 * Módulo do LCG (M = 2^31 - 1, um número primo de Mersenne).
 * Este módulo (2147483647) garante boa distribuição.
 */
const MOD = 2147483647; 
const MULTIPLIER = 48271; // Multiplicador (a)
// O incremento (c) é 0, o que torna a função congruencial multiplicativa.

let _seed = Date.now() % MOD;

// =========================================================
// 🔄 GESTÃO DE SEED
// =========================================================

/**
 * Configura uma seed para inicializar o gerador de números pseudo-aleatórios.
 * O uso da mesma seed garante a reprodução exata da sequência de números.
 * @param {number} seed - O novo valor da seed (será aplicado MOD).
 */
export function setSeed(seed) {
  // Garante que a seed esteja dentro do intervalo [0, MOD - 1]
  _seed = Math.floor(seed) % MOD;
}

/**
 * Retorna a seed atual do gerador (principalmente para fins de debug/reprodução).
 * @returns {number} A seed atual.
 */
export function getSeed() {
    return _seed;
}

// =========================================================
// 🎯 FUNÇÃO BASE RNG
// =========================================================

/**
 * Gerador de número pseudo-aleatório baseado em seed (LCG).
 * Muta a seed interna e retorna o próximo valor.
 * @returns {number} Um float pseudo-aleatório no intervalo [0, 1).
 */
export function random() {
  // Xn+1 = (a * Xn) mod m
  _seed = (_seed * MULTIPLIER) % MOD;
  return _seed / MOD;
}

// =========================================================
// 🎲 FUNÇÕES UTILITÁRIAS
// =========================================================

/**
 * Retorna um número inteiro pseudo-aleatório entre min e max, ambos inclusivos.
 * @param {number} min - Valor mínimo (inteiro).
 * @param {number} max - Valor máximo (inteiro).
 * @returns {number} Um inteiro no intervalo [min, max].
 */
export function rng(min, max) {
  // Math.floor(random() * (max - min + 1)) + min
  // Math.floor(random() * amplitude) + min
  return Math.floor(random() * (max - min + 1)) + min;
}

/**
 * Retorna `true` com a chance percentual informada.
 * @param {number} percent - Chance percentual (0 a 100).
 * @returns {boolean}
 */
export function chance(percent) {
  if (percent <= 0) return false;
  if (percent >= 100) return true;
  return random() * 100 < percent;
}

/**
 * Retorna `true` com a chance decimal informada.
 * É equivalente a `chance(p * 100)`.
 * @param {number} p - Chance decimal (0.0 a 1.0).
 * @returns {boolean}
 */
export function chanceDecimal(p) {
  if (p <= 0.0) return false;
  if (p >= 1.0) return true;
  return random() < p;
}

/**
 * Escolhe um item de um array com base nos pesos fornecidos.
 * @template T
 * @param {T[]} arr - Array de itens para escolha.
 * @param {number[]} weights - Array de pesos correspondentes.
 * @returns {T} O item escolhido.
 * @throws {Error} Se os arrays forem inválidos ou não tiverem o mesmo comprimento.
 */
export function weightedChoice(arr, weights) {
  if (!Array.isArray(arr) || !Array.isArray(weights) || arr.length !== weights.length || arr.length === 0) {
    throw new Error("Arrays de itens e pesos devem ser válidos e ter o mesmo comprimento.");
  }
    
  // Garante que o array de pesos seja de números positivos
  const positiveWeights = weights.map(w => Math.max(0, w));

  const sum = positiveWeights.reduce((a, b) => a + b, 0);
  if (sum === 0) {
      // Se a soma dos pesos for zero, retorna um item aleatório simples (fallback)
      return arr[rng(0, arr.length - 1)]; 
  }
    
  const r = random() * sum;
  let cumulativeWeight = 0;
    
  for (let i = 0; i < arr.length; i++) {
    cumulativeWeight += positiveWeights[i];
    if (r < cumulativeWeight) return arr[i];
  }
    
  // Caso de fallback (deve ser o último item se os floats tiverem imprecisão)
  return arr[arr.length - 1];
}

/**
 * Simula a rolagem de dados (ex: "3d6" = 3 dados de 6 faces).
 * @param {number} dice - Número de dados a rolar.
 * @param {number} sides - Número de faces por dado.
 * @returns {number} A soma total das rolagens.
 */
export function rollDice(dice, sides) {
  if (dice <= 0 || sides <= 0) return 0;
    
  let total = 0;
  for (let i = 0; i < dice; i++) {
    total += rng(1, sides);
  }
  return total;
}

/**
 * Escolhe um elemento aleatório de um array.
 * @template T
 * @param {T[]} arr - O array de onde escolher.
 * @returns {T | undefined} O elemento escolhido ou undefined se o array estiver vazio.
 */
export function choice(arr) {
    if (!arr || arr.length === 0) return undefined;
    return arr[rng(0, arr.length - 1)];
}
