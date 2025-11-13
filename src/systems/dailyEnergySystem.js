// src/systems/dailyEnergySystem.js (REVISADO)

// 1. IMPORTAÇÕES CORRIGIDAS
import { loadUserCached, markUserDirty } from "./userCacheSystem.js";
// Assumindo que addEnergy e spendGems estão no economySystem.js
import { spendGems } from "./economySystem.js"; 

// --- Configuração ---
const BONUS_PERIODS = [
  { startHour: 10, endHour: 15, energy: 30 },
  { startHour: 20, endHour: 22, energy: 20 }
];
const REGEN_RATE_MIN = 1; // 1 energia a cada minuto

// --- FUNÇÕES DE REGENERAÇÃO E COMPRA ---

/**
 * [Removida a função claimDailyEnergy]
 * Esta lógica conflita com dailySystem.js.
 * A energia de login deve ser gerenciada em dailySystem.js.
 */


/**
 * Verifica e aplica regeneração de energia baseada em tempo.
 * @returns {number} Quantidade de energia regenerada.
 */
export function regenEnergyOverTime(userId) {
  const user = loadUserCached(userId);
  const now = Date.now();
  
  // Garantimos que o usuário tenha o campo de controle
  if (!user.lastEnergyRegen) user.lastEnergyRegen = now;
  
  const delta = now - user.lastEnergyRegen;
  // Math.floor para evitar conceder energia por milissegundos
  const regenAmount = Math.floor(delta / (1000 * 60) * REGEN_RATE_MIN); 
  
  if (regenAmount > 0) {
    // 2. CORREÇÃO: Usar addEnergy (se existisse no economySystem)
    // Se não existir, fazemos a manipulação direta e marcamos como dirty, 
    // mas a responsabilidade de ADD continua sendo do economySystem.
    user.energy = (user.energy || 0) + regenAmount; 
    
    // Atualiza o tempo para que a próxima contagem comece daqui
    user.lastEnergyRegen = now; 
    markUserDirty(userId);
  }
  
  return regenAmount;
}

/**
 * Permite comprar energia usando gemas
 */
export function buyEnergy(userId, gemsSpent = 1) {
  const user = loadUserCached(userId);
  
  // 1. CORREÇÃO: Usa spendGems do economySystem
  if (!spendGems(userId, gemsSpent)) {
     return "💎 Gemas insuficientes.";
  }
  
  const energyPerGem = 40;
  const totalEnergyGained = energyPerGem * gemsSpent;
  
  // 2. CORREÇÃO: Usar addEnergy (se existisse no economySystem)
  // Como spendGems já marcou o usuário como dirty, podemos manipular energy aqui.
  user.energy = (user.energy || 0) + totalEnergyGained;

  // Não precisamos chamar markUserDirty novamente, pois spendGems já o fez.
  // saveUserData(user); // Chamada via userSystem.js

  return `⚡ Você comprou ${totalEnergyGained} de energia usando ${gemsSpent} gema(s). Total atual: ${user.energy} de energia.`;
}
