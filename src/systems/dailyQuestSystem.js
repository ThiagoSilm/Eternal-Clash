// src/systems/dailyQuestSystem.js

import { addGold, addGems } from "./economySystem.js"; // Assumindo funções para adicionar recursos

// ----------------------------------------------------
// 🔹 CATÁLOGO DE MISSÕES
// ----------------------------------------------------

// Define o conjunto de missões diárias possíveis
const DAILY_QUEST_TEMPLATES = [
  { id: 'battle_win', description: 'Vença 5 batalhas.', target: 5, reward: { type: 'gold', amount: 500 } },
  { id: 'spend_energy', description: 'Gaste um total de 20 de Energia.', target: 20, reward: { type: 'gem', amount: 20 } },
  { id: 'summon_card', description: 'Invoque 2 cartas no Altar (gasto ouro, gema ou cupom).', target: 2, reward: { type: 'coupon', amount: 1 } },
  { id: 'clan_donate', description: 'Doe 1000 de Ouro ao seu clã.', target: 1000, reward: { type: 'gold', amount: 1000 } },
];

// Recompensa bônus por completar TODAS as missões
const DAILY_BONUS_REWARD = { type: 'gem', amount: 50 };

// ----------------------------------------------------
// 🔹 FUNÇÕES INTERNAS
// ----------------------------------------------------

/**
 * Inicializa ou redefine as missões diárias para o usuário se a data for diferente.
 * Modifica o objeto 'user' diretamente.
 * @param {object} user O objeto usuário.
 */
function initializeQuests(user) {
  const today = new Date().toDateString();
  
  // Se as missões não existirem ou forem de um dia anterior, resetamos
  if (!user.quests || user.quests.date !== today) {
    user.quests = {
      date: today,
      missions: DAILY_QUEST_TEMPLATES.map(q => ({
        id: q.id,
        progress: 0,
        completed: false,
      })),
      claimed: false,
    };
  }
}

/**
 * Concede a recompensa individual de uma missão concluída.
 * @param {object} user O objeto usuário.
 * @param {object} reward Os detalhes da recompensa.
 * @returns {string} Mensagem da recompensa concedida.
 */
function grantReward(user, reward) {
    switch (reward.type) {
        case 'gold':
            addGold(user, reward.amount);
            return `+${reward.amount} Ouro`;
        case 'gem':
            addGems(user, reward.amount);
            return `+${reward.amount} Gemas`;
        case 'coupon':
            // Assume-se que o user tem um campo para cupons
            user.coupons = (user.coupons || 0) + reward.amount; 
            return `+${reward.amount} Cupom(ns) de Invocação`;
        default:
            return "Recompensa desconhecida";
    }
}

// ----------------------------------------------------
// 🔹 FUNÇÕES DE EXPORTAÇÃO
// ----------------------------------------------------

/**
 * Retorna o status formatado das missões diárias.
 * @param {object} user O objeto usuário.
 * @returns {string} O status das missões.
 */
export function getQuestStatus(user) {
  initializeQuests(user);
  
  let response = `🎯 **Missões Diárias de Hoje (${user.quests.date}):**\n`;
  let allCompleted = true;
  
  user.quests.missions.forEach((mission, index) => {
    const template = DAILY_QUEST_TEMPLATES.find(t => t.id === mission.id);
    if (!template) return;
    
    const statusIcon = mission.completed ? "✅" : "❌";
    const progressText = mission.completed ? "CONCLUÍDA" : `${mission.progress}/${template.target}`;
    
    response += 
        `\n${statusIcon} **${template.description}**\n` +
        `  Progresso: ${progressText}\n` +
        `  Recompensa: ${template.reward.amount} ${template.reward.type.toUpperCase()}`;
        
    if (!mission.completed) {
        allCompleted = false;
    }
  });
  
  const bonusReward = `${DAILY_BONUS_REWARD.amount} ${DAILY_BONUS_REWARD.type.toUpperCase()}`;
  
  response += "\n\n---\n";
  if (allCompleted) {
    if (user.quests.claimed) {
        response += `✨ **BÔNUS FINAL:** Já reivindicado.`;
    } else {
        response += `🎉 **BÔNUS FINAL DESBLOQUEADO:** Reivindique ${bonusReward} com \`!dailyquest claim\`.`;
    }
  } else {
    response += `⏳ **BÔNUS FINAL:** ${bonusReward} (Requer todas as missões concluídas).`;
  }
  
  return response;
}


/**
 * Atualiza o progresso de uma missão específica.
 * Deve ser chamado por outros sistemas (ex: battle.js, altar.js)
 * @param {object} user O objeto usuário.
 * @param {string} questId O ID da missão (ex: 'battle_win').
 * @param {number} amount O valor a adicionar ao progresso (default é 1).
 */
export function updateQuestProgress(user, questId, amount = 1) {
    initializeQuests(user);
    
    const mission = user.quests.missions.find(m => m.id === questId);
    const template = DAILY_QUEST_TEMPLATES.find(t => t.id === questId);

    if (mission && template && !mission.completed) {
        // 1. Atualiza o progresso, limitando ao alvo
        const newProgress = mission.progress + amount;
        mission.progress = Math.min(newProgress, template.target);
        
        // 2. Se a missão foi concluída agora, concede a recompensa individual
        if (mission.progress >= template.target && !mission.completed) {
            mission.completed = true;
            
            // Concede a recompensa da missão individual
            grantReward(user, template.reward); 
            
            // Retorna true para sinalizar que o objeto user foi modificado
            return true; 
        }
    }
    return false;
}

/**
 * Reivindica a recompensa bônus por completar todas as missões.
 * @param {object} user O objeto usuário.
 * @returns {string} Mensagem de sucesso ou erro.
 */
export function claimDailyQuestReward(user) {
    initializeQuests(user);
    
    if (user.quests.claimed) {
        return "❌ Você já reivindicou o Bônus Diário hoje.";
    }
    
    const allCompleted = user.quests.missions.every(m => m.completed);
    
    if (!allCompleted) {
        return "❌ Você deve completar **todas** as missões para reivindicar o Bônus Final.";
    }
    
    // Concede a recompensa bônus
    const rewardMsg = grantReward(user, DAILY_BONUS_REWARD);
    user.quests.claimed = true;
    
    return `🎉 **BÔNUS FINAL REIVINDICADO!** Você recebeu: ${rewardMsg}.`;
}
