// src/systems/dailyQuestSystem.js
import { addGold, addGems, addCoupons } from "./economySystem.js";

// ======================================================
// ⚙️ TIPAGEM E CONFIGURAÇÃO
// ======================================================

/**
 * @typedef {object} QuestRarity
 * @property {number} multiplier - Multiplicador de recompensa.
 * @property {string} color - Ícone de cor/raridade.
 */

/**
 * @typedef {object} Reward
 * @property {'gold' | 'gem' | 'coupon'} type - Tipo de moeda.
 * @property {number} amount - Valor base da recompensa.
 */

/**
 * @typedef {object} QuestTemplate
 * @property {string} id - ID único da missão (usado para rastreamento de progresso).
 * @property {string} description - Descrição exibida.
 * @property {number} target - Meta de progresso para conclusão.
 * @property {Reward} baseReward - Recompensa base antes do multiplicador de raridade.
 * @property {'common' | 'rare' | 'epic' | 'legendary'} rarity - Nível de raridade.
 * @property {boolean} [isSecret=false] - Indica se é uma missão secreta (opcional).
 */

/**
 * @typedef {object} UserQuestState
 * @property {string} id
 * @property {number} progress
 * @property {boolean} completed
 * @property {string} rarity
 * @property {number} startTime - Timestamp (opcional, para a missão secreta 'secret_jackpot').
 */

/**
 * @typedef {object} UserState
 * @property {string} id
 * @property {number} level
 * @property {{date: string, missions: UserQuestState[], claimed: boolean}} [quests] - Estado das missões diárias.
 */

// ======================================================
// 🔥 RARIDADE DAS MISSÕES
// ======================================================
const QUEST_RARITY = {
    common:    { multiplier: 1, color: "⚪" },
    rare:      { multiplier: 1.5, color: "🟦" },
    epic:      { multiplier: 2.5, color: "🟪" },
    legendary: { multiplier: 4, color: "🟨" }
};

// Chance de cada missão secreta ser adicionada ao pool
const SECRET_QUEST_CHANCE = 0.05; // 5%

// ======================================================
// 🔥 MISSÕES BASE (pool geral)
// ======================================================
const QUEST_POOL = [
    { id: 'battle_win', description: 'Vença 5 batalhas.', target: 5, baseReward: { type: 'gold', amount: 500 }, rarity: 'common' },
    { id: 'battle_streak', description: 'Faça 3 vitórias seguidas.', target: 3, baseReward: { type: 'gem', amount: 30 }, rarity: 'epic' },
    { id: 'spend_energy', description: 'Gaste 40 de Energia.', target: 40, baseReward: { type: 'gold', amount: 1200 }, rarity: 'rare' },
    { id: 'summon_card', description: 'Invoque 3 cartas.', target: 3, baseReward: { type: 'coupon', amount: 1 }, rarity: 'common' },
    { id: 'clan_donate', description: 'Doe 2000 de Ouro ao clã.', target: 2000, baseReward: { type: 'gem', amount: 15 }, rarity: 'rare' },
    { id: 'spend_gems', description: 'Gaste 50 gemas.', target: 50, baseReward: { type: 'gold', amount: 3000 }, rarity: 'epic' },
    { id: 'pvp_fight', description: 'Lute 10 vezes na Arena.', target: 10, baseReward: { type: 'gold', amount: 1500 }, rarity: 'common' },
    { id: 'upgrade_card', description: 'Evolua 2 cartas.', target: 2, baseReward: { type: 'gem', amount: 20 }, rarity: 'rare' },
];

// ======================================================
// 🔥 MISSÕES SECRETAS
// ======================================================
const SECRET_QUESTS = [
    { id: 'secret_jackpot', description: 'Complete qualquer missão em menos de 2 minutos após recebê-la.', target: 1, baseReward: { type: 'gem', amount: 200 }, rarity: 'legendary', isSecret: true },
    { id: 'secret_altar', description: 'Invoque 10 cartas no mesmo dia.', target: 10, baseReward: { type: 'coupon', amount: 5 }, rarity: 'epic', isSecret: true }
];

// Mapeia todas as missões para busca rápida O(1)
const ALL_QUEST_TEMPLATES = new Map([...QUEST_POOL, ...SECRET_QUESTS].map(q => [q.id, q]));


// ======================================================
// 🔹 UTILITÁRIOS
// ======================================================

/**
 * Retorna a chave do dia atual.
 * @returns {string} Data do dia formatada como string.
 */
function getTodayKey() {
    return new Date().toDateString();
}

/**
 * Busca o template de uma missão pelo ID.
 * @param {string} questId - ID da missão.
 * @returns {QuestTemplate | undefined}
 */
function getQuestTemplate(questId) {
    return ALL_QUEST_TEMPLATES.get(questId);
}

/**
 * Define a recompensa final de bônus baseada no nível do usuário.
 * @param {UserState} user
 * @returns {Reward}
 */
function getDailyBonusReward(user) {
    const base = 50 + (user.level || 1) * 2;
    return { type: 'gem', amount: base };
}

/**
 * ENTREGA RECOMPENSA ESCALADA
 * Aplica o multiplicador de raridade e concede a recompensa ao usuário.
 * @param {UserState} user - Objeto do usuário (mutável).
 * @param {UserQuestState} quest - O estado atual da missão que foi concluída.
 * @returns {string} Mensagem de recompensa concedida.
 */
function grantReward(user, quest) {
    const template = getQuestTemplate(quest.id);
    if (!template) return "Sem recompensa.";

    const mult = QUEST_RARITY[template.rarity].multiplier;
    const amount = Math.floor(template.baseReward.amount * mult);

    switch (template.baseReward.type) {
        case 'gold': 
            addGold(user, amount); 
            break;
        case 'gem': 
            addGems(user, amount); 
            break;
        case 'coupon': 
            // Assume que addCoupons aceita o objeto user e o valor
            addCoupons(user, amount); 
            break;
    }

    return `+${amount} ${template.baseReward.type.toUpperCase()}`;
}


// ======================================================
// 🔥 GERA OU CARREGA AS MISSÕES DO DIA
// ======================================================

/**
 * Inicializa ou valida o estado das missões diárias do usuário para o dia.
 * Cria 4 missões aleatórias se ainda não tiverem sido criadas hoje.
 * @param {UserState} user - Objeto do usuário (mutável).
 */
function initializeQuests(user) {
    const today = getTodayKey();
    if (user.quests && user.quests.date === today) return; // Missões já criadas hoje

    // Inicia o pool com todas as missões base
    const pool = [...QUEST_POOL];

    // Adiciona missões secretas com chance de 5%
    SECRET_QUESTS.forEach(q => {
        if (Math.random() < SECRET_QUEST_CHANCE) {
            pool.push(q);
        }
    });

    // Garante que não vamos escolher mais missões do que o pool permite
    const numMissions = Math.min(4, pool.length);

    // Escolhe missões aleatórias (4 ou o tamanho do pool)
    const missions = [];
    for (let i = 0; i < numMissions; i++) {
        const randomIndex = Math.floor(Math.random() * pool.length);
        const q = pool.splice(randomIndex, 1)[0];
        
        missions.push({
            id: q.id,
            progress: 0,
            completed: false,
            rarity: q.rarity,
            startTime: Date.now() // Útil para missões baseadas em tempo
        });
    }

    user.quests = {
        date: today,
        missions,
        claimed: false
    };
}

// ======================================================
// 📊 MOSTRA STATUS DAS MISSÕES (Export)
// ======================================================

/**
 * Gera um resumo formatado do status das missões diárias do usuário.
 * @param {UserState} user - Objeto do usuário (mutável).
 * @returns {string} Mensagem formatada com o status.
 */
export function getQuestStatus(user) {
    initializeQuests(user);

    let txt = `🎯 **Missões Diárias (${user.quests.date})**\n\n`;
    let allCompleted = true;

    for (const m of user.quests.missions) {
        const template = getQuestTemplate(m.id);
        
        if (!template) continue; // Pula se o template for perdido

        const icon = m.completed ? "✅" : "❌";
        const rarityIcon = QUEST_RARITY[template.rarity].color;

        txt += `${icon} ${rarityIcon} **${template.description}**\n`;
        txt += `Progresso: ${m.progress}/${template.target}\n\n`;

        if (!m.completed) allCompleted = false;
    }

    const bonus = getDailyBonusReward(user);

    if (allCompleted) {
        txt += user.quests.claimed
            ? `✨ Bônus final já reivindicado.`
            : `🎉 **Bônus Liberado:** ${bonus.amount} GEMAS — Use \`!dailyquest claim\``;
    } else {
        txt += `⏳ Complete todas para ganhar ${bonus.amount} GEMAS.`;
    }

    return txt;
}

// ======================================================
// 🔄 ATUALIZA PROGRESSO (Export)
// ======================================================

/**
 * Atualiza o progresso de uma missão específica.
 * @param {UserState} user - Objeto do usuário (mutável).
 * @param {string} questId - ID da missão a ser atualizada (ex: 'battle_win').
 * @param {number} [amount=1] - Quantidade de progresso a adicionar.
 * @returns {string | null} Mensagem de conclusão se a missão foi finalizada, ou null.
 */
export function updateQuestProgress(user, questId, amount = 1) {
    initializeQuests(user);
    const progressAmount = Math.max(0, Number(amount) || 0);

    const mission = user.quests.missions.find(m => m.id === questId);
    const template = getQuestTemplate(questId);

    // 1. Validação
    if (!mission || !template || mission.completed || progressAmount === 0) return null;

    // 2. Atualiza o progresso
    const oldProgress = mission.progress;
    mission.progress = Math.min(oldProgress + progressAmount, template.target);

    // 3. Verifica conclusão
    if (mission.progress >= template.target && !mission.completed) {
        mission.completed = true;
        const rewardMsg = grantReward(user, mission);
        
        return `🎉 Missão concluída: **${template.description}**\nRecompensa: ${rewardMsg}`;
    }

    return null;
}

// ======================================================
// 🎁 REIVINDICA BÔNUS FINAL (Export)
// ======================================================

/**
 * Reivindica o bônus final após completar todas as missões diárias.
 * @param {UserState} user - Objeto do usuário (mutável).
 * @returns {string} Mensagem de status ou sucesso.
 */
export function claimDailyQuestReward(user) {
    initializeQuests(user);

    if (user.quests.claimed) {
        return "❌ Você já pegou o bônus hoje.";
    }

    // Verifica se todas as missões selecionadas foram completadas
    const allCompleted = user.quests.missions.every(m => m.completed);
    
    if (!allCompleted) {
        return "❌ Complete todas as missões primeiro para reivindicar o Bônus Final.";
    }

    const bonus = getDailyBonusReward(user);
    
    // Concede o bônus final
    addGems(user, bonus.amount);
    user.quests.claimed = true;

    return `🎉 **Você recebeu o Bônus Final:** +${bonus.amount} GEMAS!`;
}
