// src/systems/dailyQuestSystem.js

import { addGold, addGems, addCoupons } from "./economySystem.js";

// ----------------------------------------------------
// 🔹 CATÁLOGO DE MISSÕES
// ----------------------------------------------------

const DAILY_QUEST_TEMPLATES = [
    { id: 'battle_win', description: 'Vença 5 batalhas.', target: 5, reward: { type: 'gold', amount: 500 } },
    { id: 'spend_energy', description: 'Gaste um total de 20 de Energia.', target: 20, reward: { type: 'gem', amount: 20 } },
    { id: 'summon_card', description: 'Invoque 2 cartas no Altar (gasto ouro, gema ou cupom).', target: 2, reward: { type: 'coupon', amount: 1 } },
    { id: 'clan_donate', description: 'Doe 1000 de Ouro ao seu clã.', target: 1000, reward: { type: 'gold', amount: 1000 } },
];

const DAILY_BONUS_REWARD = { type: 'gem', amount: 50 };

// ----------------------------------------------------
// 🔹 FUNÇÕES INTERNAS
// ----------------------------------------------------

function initializeQuests(user) {
    const today = new Date().toDateString();
    
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

function grantReward(user, reward) {
    if (!reward) return "Sem recompensa";
    
    switch (reward.type) {
        case 'gold':
            addGold(user, reward.amount);
            return `+${reward.amount} Ouro`;
        case 'gem':
            addGems(user, reward.amount);
            return `+${reward.amount} Gemas`;
        case 'coupon':
            addCoupons(user, reward.amount);
            return `+${reward.amount} Cupom(ns) de Invocação`;
        default:
            return "Recompensa desconhecida";
    }
}

// ----------------------------------------------------
// 🔹 FUNÇÕES DE EXPORTAÇÃO
// ----------------------------------------------------

export function getQuestStatus(user) {
    initializeQuests(user);
    
    let response = `🎯 **Missões Diárias de Hoje (${user.quests.date}):**\n`;
    let allCompleted = true;
    
    user.quests.missions.forEach(mission => {
        const template = DAILY_QUEST_TEMPLATES.find(t => t.id === mission.id);
        if (!template) return;
        
        const statusIcon = mission.completed ? "✅" : "❌";
        const progressText = mission.completed ? "CONCLUÍDA" : `${mission.progress}/${template.target}`;
        
        response +=
            `\n${statusIcon} **${template.description}**\n` +
            `  Progresso: ${progressText}\n` +
            `  Recompensa: ${template.reward.amount} ${template.reward.type.toUpperCase()}`;
        
        if (!mission.completed) allCompleted = false;
    });
    
    const bonusReward = `${DAILY_BONUS_REWARD.amount} ${DAILY_BONUS_REWARD.type.toUpperCase()}`;
    response += "\n\n---\n";
    
    if (allCompleted) {
        response += user.quests.claimed ?
            `✨ **BÔNUS FINAL:** Já reivindicado.` :
            `🎉 **BÔNUS FINAL DESBLOQUEADO:** Reivindique ${bonusReward} com \`!dailyquest claim\`.`;
    } else {
        response += `⏳ **BÔNUS FINAL:** ${bonusReward} (Requer todas as missões concluídas).`;
    }
    
    return response;
}

export function updateQuestProgress(user, questId, amount = 1) {
    initializeQuests(user);
    
    // Validação de amount
    amount = Math.max(0, Number(amount) || 0);
    
    const mission = user.quests.missions.find(m => m.id === questId);
    const template = DAILY_QUEST_TEMPLATES.find(t => t.id === questId);
    
    if (!mission || !template) return null;
    if (mission.completed) return null;
    
    mission.progress = Math.min(mission.progress + amount, template.target);
    
    if (mission.progress >= template.target && !mission.completed) {
        mission.completed = true;
        const rewardMsg = grantReward(user, template.reward);
        return `🎉 Missão concluída: ${template.description}\nRecompensa: ${rewardMsg}`;
    }
    
    return null; // Nenhuma missão concluída
}

export function claimDailyQuestReward(user) {
    initializeQuests(user);
    
    if (user.quests.claimed) return "❌ Você já reivindicou o Bônus Diário hoje.";
    
    const allCompleted = user.quests.missions.every(m => m.completed);
    if (!allCompleted) return "❌ Você deve completar **todas** as missões para reivindicar o Bônus Final.";
    
    const rewardMsg = grantReward(user, DAILY_BONUS_REWARD);
    user.quests.claimed = true;
    
    return `🎉 **BÔNUS FINAL REIVINDICADO!** Você recebeu: ${rewardMsg}.`;
}