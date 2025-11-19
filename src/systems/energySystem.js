// src/systems/energySystem.js

import { markUserDirty, loadUserCached } from "./userCacheSystem.js";

// =========================================================
// ⚙️ CONFIGURAÇÕES & CONSTANTES
// =========================================================

export const REGEN_RATE_MS = 5 * 60 * 1000; // 5 minutos por 1 energia
export const MAX_ENERGY_DEFAULT = 100;
const ENERGY_GAIN_PER_UNIT = 1; // 1 energia por REGEN_RATE_MS

/**
 * @typedef {object} EnergyState
 * @property {number} current - Nível atual de energia.
 * @property {number} max - Limite máximo de energia.
 * @property {number} lastRegen - Timestamp da última vez que a regeneração foi processada/iniciada.
 * @property {number} regenBoost - Multiplicador de velocidade de regeneração (1 = normal).
 * @property {boolean} regenPaused - Se a regeneração está suspensa por um buff.
 * @property {number} overcharge - Energia excedente que pode ser acumulada acima do `max`.
 */

/**
 * @typedef {object} UserState
 * @property {string} id
 * @property {EnergyState} [energy] - O estado da energia do usuário.
 */

// =========================================================
// 🛠️ FUNÇÕES AUXILIARES DE ESTADO
// =========================================================

/**
 * Garante que o objeto de energia do usuário esteja inicializado com valores padrão.
 * @param {UserState} user - Objeto do usuário (mutável).
 * @returns {EnergyState} O objeto EnergyState.
 */
function ensureEnergy(user) {
  const now = Date.now();
  if (!user.energy) {
    user.energy = {
      current: MAX_ENERGY_DEFAULT,
      max: MAX_ENERGY_DEFAULT,
      lastRegen: now,
      regenBoost: 1,
      regenPaused: false,
      overcharge: 0
    };
    markUserDirty(user.id);
  }
  return user.energy;
}

/**
 * Calcula a energia atual do usuário, aplicando a regeneração acumulada.
 *
 * NOTA: Esta é a função mais crítica; ela deve ser chamada antes de qualquer
 * leitura ou modificação do `user.energy`.
 *
 * @param {UserState} user - Objeto do usuário (mutável).
 * @returns {EnergyState} O objeto EnergyState atualizado.
 */
function calculateCurrentEnergy(user) {
  const now = Date.now();
  const e = ensureEnergy(user);
  
  if (e.regenPaused) return e;
  
  // Taxa de regeneração real (ms por 1 ponto de energia)
  // Certifica-se de que regenBoost é pelo menos 1
  const effectiveRegenRate = REGEN_RATE_MS / Math.max(1, e.regenBoost); 
  
  const elapsed = now - e.lastRegen;
  // Calcula quantos pontos de energia inteiros regeneraram
  const regenPoints = Math.floor(elapsed / effectiveRegenRate);
  
  if (regenPoints > 0) {
    const totalCapacity = e.max + e.overcharge;
    const before = e.current;
    
    // Adiciona o máximo de energia possível até a capacidade total
    e.current = Math.min(totalCapacity, e.current + regenPoints * ENERGY_GAIN_PER_UNIT);
    
    const appliedPoints = (e.current - before) / ENERGY_GAIN_PER_UNIT;
    
    if (appliedPoints > 0) {
        // Ajusta lastRegen para o tempo que foi gasto na regeneração
        e.lastRegen += appliedPoints * effectiveRegenRate; 
        
        // Se a energia está cheia (e.current == totalCapacity),
        // reinicia lastRegen para agora - resto, evitando acumular tempo extra.
        if (e.current >= totalCapacity) {
             e.lastRegen = now - (elapsed % effectiveRegenRate);
        }

        markUserDirty(user.id);
    }
  }
  return e;
}


// =========================================================
// ⚡ FUNÇÕES EXPORTADAS
// =========================================================

/**
 * Retorna o status formatado da energia, incluindo o tempo para o próximo ponto.
 * @param {string} userId - ID do usuário.
 * @returns {string} Status formatado.
 */
export function getEnergyStatus(userId) {
  const user = loadUserCached(userId);
  const e = calculateCurrentEnergy(user);
  
  const cap = `${e.current}/${e.max}${e.overcharge > 0 ? ` (+${e.overcharge} OC)` : ""}`;
  
  // 1. Caso de Energia Máxima
  if (e.current >= e.max + e.overcharge || e.regenPaused) {
      const status = e.regenPaused ? " (Regen. Pausada)" : " (Máximo)";
      return `${cap}${status}`;
  }
  
  // 2. Cálculo do Tempo Restante
  const effectiveRegenRate = REGEN_RATE_MS / Math.max(1, e.regenBoost); 
  const nextRegenInMs = effectiveRegenRate - ((Date.now() - e.lastRegen) % effectiveRegenRate);
  
  const m = Math.floor(nextRegenInMs / 60000);
  const s = Math.floor((nextRegenInMs % 60000) / 1000);
  
  return `${cap} (Próxima em ${m}m ${s}s)`;
}

/**
 * Gasta uma quantidade de energia.
 * @param {UserState} user - Objeto do usuário (mutável).
 * @param {number} amount - Quantidade a gastar.
 * @returns {boolean} True se o gasto foi bem-sucedido, false caso contrário.
 */
export function spendEnergy(user, amount) {
  if (amount <= 0) return true;
    
  const e = calculateCurrentEnergy(user);
  if (e.current < amount) return false;
  
  const wasMax = e.current >= e.max;
  e.current -= amount;
  
  // Se estávamos no máximo (ou overcharged) e gastamos,
  // reiniciamos o timer de regeneração para agora para evitar espera longa.
  if (wasMax) {
      e.lastRegen = Date.now();
  }
  
  markUserDirty(user.id);
  return true;
}

/**
 * Adiciona energia ao usuário, com opção de permitir overcharge.
 * @param {UserState} user - Objeto do usuário (mutável).
 * @param {number} amount - Quantidade a adicionar.
 * @param {boolean} [allowOvercharge=false] - Se a energia pode exceder o limite `max`.
 * @returns {number} A quantidade **realmente** adicionada (incluindo overcharge).
 */
export function addEnergy(user, amount, allowOvercharge = false) {
  if (amount <= 0) return 0;
    
  const e = calculateCurrentEnergy(user);
  const initialCurrent = e.current;
  const initialOvercharge = e.overcharge;
  
  if (!allowOvercharge) {
    e.current = Math.min(e.max, e.current + amount);
  } else {
    // Se permitir overcharge, primeiro preenche e.max
    const remainingToAdd = e.max - e.current;
    
    if (remainingToAdd > 0) {
        const addedToCurrent = Math.min(amount, remainingToAdd);
        e.current += addedToCurrent;
        amount -= addedToCurrent;
    }
    
    // O restante vai para o overcharge
    e.overcharge += amount;
  }
  
  const addedTotal = (e.current - initialCurrent) + (e.overcharge - initialOvercharge);
  
  if (addedTotal > 0) {
      markUserDirty(user.id);
  }
  
  return addedTotal;
}

/**
 * Altera o limite máximo de energia. Se o `current` for maior que o novo `max`,
 * ele será ajustado para o novo `max`. O `overcharge` é mantido.
 * @param {UserState} user - Objeto do usuário (mutável).
 * @param {number} amount - Valor a ser somado/subtraído do `max`.
 */
export function modifyMaxEnergy(user, amount) {
  const e = ensureEnergy(user);
  
  const newMax = Math.max(1, e.max + amount);
  if (newMax === e.max) return;
    
  e.max = newMax;
  
  // Garante que o current não exceda o novo max
  if (e.current > e.max) {
      e.current = e.max;
  }
    
  markUserDirty(user.id);
}

/**
 * Define o multiplicador de velocidade de regeneração.
 * @param {UserState} user - Objeto do usuário (mutável).
 * @param {number} multiplier - Novo multiplicador (ex: 2 para regenerar 2x mais rápido). Deve ser >= 1.
 */
export function setRegenBoost(user, multiplier) {
  const e = ensureEnergy(user);
  const newMultiplier = Math.max(1, multiplier);
  if (e.regenBoost === newMultiplier) return;
    
  // Calcula a energia atual antes de mudar a taxa
  calculateCurrentEnergy(user); 
    
  e.regenBoost = newMultiplier;
  markUserDirty(user.id);
}

/**
 * Pausa ou retoma a regeneração de energia.
 * @param {UserState} user - Objeto do usuário (mutável).
 * @param {boolean} [state=true] - True para pausar, False para retomar.
 */
export function pauseRegen(user, state = true) {
  const e = ensureEnergy(user);
  if (e.regenPaused === state) return;
    
  // Se estivermos pausando, calculamos a energia atual para salvar o lastRegen limpo.
  if (state === true) {
      calculateCurrentEnergy(user); 
  }
    
  e.regenPaused = state;
  markUserDirty(user.id);
}
