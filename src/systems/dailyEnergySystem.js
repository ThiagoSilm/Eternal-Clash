import { addEnergy, spendGems } from "./economySystem.js";

// --- Configuração ---
const BONUS_PERIODS = [
  { startHour: 10, endHour: 15, energy: 30, name: "Manhã Reforçada" }, // 10h00 a 15h00
  { startHour: 20, endHour: 22, energy: 20, name: "Noite de Batalha" } // 20h00 a 22h00
];
const REGEN_RATE_MIN = 1; // 1 energia a cada minuto (para uso externo, mas a regen de fato está no economySystem)

// --- FUNÇÕES DE BÔNUS ---

/**
 * Verifica se a hora atual está dentro de um período de bônus.
 * @param {number} hour A hora atual (0-23).
 * @returns {object | null} O objeto de bônus ativo, ou null.
 */
function getActiveBonus(hour) {
  return BONUS_PERIODS.find(p => hour >= p.startHour && hour < p.endHour) || null;
}

/**
 * Verifica e aplica o bônus de energia do período do dia, se o usuário ainda não o recebeu hoje.
 * @param {object} user O objeto usuário.
 * @returns {string} Mensagem de status do bônus.
 */
export function checkAndApplyBonus(user) {
  const now = new Date();
  const currentHour = now.getHours();
  // Obtém a data de hoje (YYYY-MM-DD) para chavear o bônus
  const todayDateStr = now.toISOString().split('T')[0];
  
  const bonus = getActiveBonus(currentHour);
  
  // Garantimos que o campo de controle exista
  if (!user.dailyBonusReceived) user.dailyBonusReceived = {};
  
  if (bonus) {
    const bonusKey = `${todayDateStr}_${bonus.startHour}`;
    
    if (!user.dailyBonusReceived[bonusKey]) {
      addEnergy(user, bonus.energy); // Usa a função de adição do economySystem
      user.dailyBonusReceived[bonusKey] = true;
      // markUserDirty(user.id); // Esta chamada é esperada que venha de addEnergy
      return `🎉 Bônus de **${bonus.name}** aplicado! Você ganhou ${bonus.energy} de Energia.`;
    } else {
      return `✅ Bônus de **${bonus.name}** (das ${bonus.startHour}h) já foi resgatado hoje.`;
    }
  }
  
  return `⏳ Nenhum período de bônus ativo (Hora: ${currentHour}h).`;
}

// --- FUNÇÕES DE REGENERAÇÃO E COMPRA ---

/**
 * Verifica e aplica regeneração de energia baseada em tempo.
 * NOTA: Esta função foi simplificada para DELEGAR a lógica de tempo ao regenerateEnergy no economySystem.
 * @param {object} user O objeto usuário a ser modificado.
 * @returns {number} Quantidade de energia regenerada (ou 0, já que a lógica de tempo está no economySystem).
 */
export function regenEnergyOverTime(user) {
  // Para evitar conflito e duplicidade na lógica de tempo, o economySystem.js agora gerencia a regeneração completa.
  // Esta função pode ser depreciada ou renomeada para ser apenas um wrapper de chamada se necessário.
  
  // Como a lógica de regenEnergyOverTime foi definida no economySystem (regenerateEnergy),
  // esta função fica como um wrapper para compatibilidade:
  // const regenMessage = regenerateEnergy(user); 
  // return regenMessage ? 1 : 0; // Retorna 1 se houve regen, 0 se não (simplificado para o escopo)
  
  // Mantendo a lógica anterior que tenta calcular o tempo, mas com o conhecimento de que addEnergy será chamada:
  const now = Date.now();
  
  // Garantimos que o usuário tenha o campo de controle (agora obsoleto devido ao economySystem)
  if (!user.lastEnergyRegen) user.lastEnergyRegen = now;
  
  const delta = now - user.lastEnergyRegen;
  // Calcula o valor total a ser regenerado com base no tempo decorrido
  // A taxa é de 1 ponto/minuto neste arquivo (60000ms/ponto)
  const regenAmount = Math.floor(delta / (1000 * 60) * REGEN_RATE_MIN);
  
  if (regenAmount > 0) {
    const actualAdded = addEnergy(user, regenAmount); // Delega a adição
    
    if (actualAdded > 0 || regenAmount > 0) {
      // Atualiza o tempo para que a próxima contagem comece daqui
      user.lastEnergyRegen = now - (delta % (1000 * 60 / REGEN_RATE_MIN)); // Ajuste de modulo
    }
    return actualAdded;
  }
  
  return 0;
}

/**
 * Permite comprar energia usando gemas.
 * @param {object} user O objeto usuário a ser modificado.
 * @param {number} gemsSpent A quantidade de gemas a gastar (padrão 1).
 * @returns {string} Mensagem de sucesso ou falha.
 */
export function buyEnergy(user, gemsSpent = 1) {
  if (gemsSpent <= 0) return "❌ A quantidade de gemas deve ser positiva.";
  
  // Tenta gastar as gemas primeiro
  if (!spendGems(user, gemsSpent)) {
    return `❌ Gemas insuficientes! Você precisa de ${gemsSpent} gema(s).`;
  }
  
  const energyPerGem = 40;
  const totalEnergyGained = energyPerGem * gemsSpent;
  
  // Adiciona a energia (respeita o limite máximo)
  const actualAdded = addEnergy(user, totalEnergyGained);
  
  if (actualAdded > 0) {
    // Nota: O user.energy é um objeto {current: x, max: y} no economySystem.js
    return `⚡ Você comprou **${totalEnergyGained}** de energia usando **${gemsSpent} gema(s)**. Energia atual: ${user.energy?.current}/${user.energy?.max}.`;
  } else {
    // Se gastou gemas, mas não adicionou energia (porque estava no máximo), reembolsar (melhor UX)
    addGems(user, gemsSpent); // Reembolsa as gemas
    return `⚠️ Você gastou ${gemsSpent} gema(s), mas sua energia já estava no máximo (${user.energy?.current}/${user.energy?.max}). Suas gemas foram reembolsadas.`;
  }
}