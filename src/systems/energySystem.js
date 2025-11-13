import { markUserDirty } from "./userCacheSystem.js";
import { loadUserCached } from "./userCacheSystem.js";

// --- Configurações ---
const REGEN_RATE_MS = 5 * 60 * 1000; // 5 minutos por ponto de energia
const MAX_ENERGY_DEFAULT = 100;

/**
 * Calcula a energia atual do usuário, aplicando a regeneração.
 * Se houver regeneração, o objeto user é marcado como sujo.
 * @param {string} userId - O ID do usuário.
 * @returns {object} O objeto de energia atualizado.
 */
function calculateCurrentEnergy(user) {
  const now = Date.now();
  
  // Garante a estrutura mínima
  if (!user.energy) {
    user.energy = { current: MAX_ENERGY_DEFAULT, max: MAX_ENERGY_DEFAULT, lastRegen: now };
    markUserDirty(user.id);
    return user.energy;
  }
  
  const energy = user.energy;
  const timeElapsed = now - (energy.lastRegen || now);
  const max = energy.max || MAX_ENERGY_DEFAULT;
  
  // Calcula pontos de energia regenerados
  const regeneratedPoints = Math.floor(timeElapsed / REGEN_RATE_MS);
  
  if (regeneratedPoints > 0) {
    const newCurrent = Math.min(max, (energy.current || 0) + regeneratedPoints);
    
    // Se a energia está cheia, a última regeneração é agora
    if (newCurrent === max) {
      energy.lastRegen = now;
    } else {
      // Se não está cheia, ajusta o lastRegen para o tempo exato da última regeneração aplicada
      energy.lastRegen = (energy.lastRegen || now) + (regeneratedPoints * REGEN_RATE_MS);
    }
    
    energy.current = newCurrent;
    markUserDirty(user.id);
  }
  
  return energy;
}

/**
 * Retorna o status formatado da energia.
 * @param {string} userId - O ID do usuário.
 * @returns {string} Status de energia.
 */
export function getEnergyStatus(userId) {
  const user = loadUserCached(userId);
  const energy = calculateCurrentEnergy(user);
  
  const timeToNextPoint = REGEN_RATE_MS - ((Date.now() - energy.lastRegen) % REGEN_RATE_MS);
  const minutes = Math.floor(timeToNextPoint / 60000);
  const seconds = Math.floor((timeToNextPoint % 60000) / 1000);
  
  const status = `${energy.current} / ${energy.max}`;
  
  if (energy.current < energy.max) {
    return `${status} (Próxima em ${minutes}m ${seconds}s)`;
  }
  return `${status} (Máximo)`;
}

/**
 * Gasta energia do usuário.
 * @param {object} user - O objeto usuário.
 * @param {number} amount - Quantidade a gastar.
 * @returns {boolean} True se o gasto foi bem-sucedido.
 */
export function spendEnergy(user, amount) {
  const energy = calculateCurrentEnergy(user);
  if ((energy.current || 0) >= amount) {
    energy.current -= amount;
    
    // Se a energia estava no máximo antes de gastar, define o lastRegen como agora
    if (energy.current + amount === energy.max) {
      energy.lastRegen = Date.now();
    }
    
    markUserDirty(user.id);
    return true;
  }
  return false;
}