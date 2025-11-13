// src/systems/dailyEnergySystem.js (REVISADO)

// ❌ REMOVIDO: loadUserCached, markUserDirty
// 1. CORREÇÃO: Importa addEnergy (assumimos que existe) e spendGems
import { addEnergy, spendGems } from "./economySystem.js"; 

// --- Configuração ---
const BONUS_PERIODS = [
  { startHour: 10, endHour: 15, energy: 30 },
  { startHour: 20, endHour: 22, energy: 20 }
];
const REGEN_RATE_MIN = 1; // 1 energia a cada minuto

// --- FUNÇÕES DE REGENERAÇÃO E COMPRA ---

/**
 * Verifica e aplica regeneração de energia baseada em tempo.
 * 🎯 CORREÇÃO 1: Assinatura alterada para receber o objeto 'user'.
 * @param {object} user O objeto usuário a ser modificado.
 * @returns {number} Quantidade de energia regenerada.
 */
export function regenEnergyOverTime(user) {
  const now = Date.now();
  
  // Garantimos que o usuário tenha o campo de controle
  if (!user.lastEnergyRegen) user.lastEnergyRegen = now;
  
  const delta = now - user.lastEnergyRegen;
  // Calcula o valor total a ser regenerado com base no tempo decorrido
  const regenAmount = Math.floor(delta / (1000 * 60) * REGEN_RATE_MIN); 
  
  if (regenAmount > 0) {
    // 🎯 CORREÇÃO 2: Delega a adição de energia ao economySystem.
    addEnergy(user, regenAmount); 
    
    // Atualiza o tempo para que a próxima contagem comece daqui
    user.lastEnergyRegen = now; 
    // ❌ REMOVIDO: markUserDirty(userId);
  }
  
  return regenAmount;
}

/**
 * Permite comprar energia usando gemas
 * 🎯 CORREÇÃO 3: Assinatura alterada para receber o objeto 'user'.
 * @param {object} user O objeto usuário a ser modificado.
 * @param {number} gemsSpent A quantidade de gemas a gastar.
 * @returns {string} Mensagem de sucesso.
 * @throws {Error} Se gemas insuficientes.
 */
export function buyEnergy(user, gemsSpent = 1) {
  
  // 🎯 CORREÇÃO 4: Usa spendGems no objeto 'user'. Lança Error se insuficiente.
  spendGems(user, gemsSpent);
  
  const energyPerGem = 40;
  const totalEnergyGained = energyPerGem * gemsSpent;
  
  // 🎯 CORREÇÃO 5: Delega a adição de energia ao economySystem.
  addEnergy(user, totalEnergyGained);

  // O Middleware salva automaticamente o objeto 'user' mutado.

  return `⚡ Você comprou ${totalEnergyGained} de energia usando ${gemsSpent} gema(s). Total atual: ${user.energy} de energia.`;
}
