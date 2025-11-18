// src/systems/dailyQuestSystem.js
import { addGold, addGems, addCoupons } from "./economySystem.js";

// ======================================================
// 🔥 RARIDADE DAS MISSÕES
// ======================================================
const QUEST_RARITY = {
    common:   { multiplier: 1, color: "⚪" },
    rare:     { multiplier: 1.5, color: "🟦" },
    epic:     { multiplier: 2.5, color: "🟪" },
    legendary:{ multiplier: 4, color: "🟨" }
};

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
// 🔥 MISSÕES SECRETAS (5% chance cada)
// ======================================================
const SECRET_QUESTS = [
    { id: 'secret_jackpot', description: 'Complete qualquer missão em menos de 2 minutos após recebê-la.', target: 1, baseReward: { type: 'gem', amount: 200 }, rarity: 'legendary' },
    { id: 'secret_altar', description: 'Invoque 10 cartas no mesmo dia.', target: 10, baseReward: { type: 'coupon', amount: 5 }, rarity: 'epic' }
];

// ======================================================
// 🔥 BONUS FINAL ESCALÁVEL PELO LEVEL DO USUÁRIO
// ======================================================
function getDailyBonusReward(user) {
    const base = 50 + user.level * 2;
    return { type: 'gem', amount: base };
}

// ======================================================
// 🔥 GERA AS MISSÕES DO DIA
// ======================================================
function initializeQuests(user) {
    const today = new Date().toDateString();
    if (user.quests && user.quests.date === today) return;

    const pool = [...QUEST_POOL];

    // Chance de adicionar missões secretas
    SECRET_QUESTS.forEach(q => {
        if (Math.random() < 0.05) pool.push(q);
    });

    // Escolhe 4 missões aleatórias
    const missions = [];
    while (missions.length < 4) {
        const q = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
        missions.push({
            id: q.id,
            progress: 0,
            completed: false,
            rarity: q.rarity
        });
    }

    user.quests = {
        date: today,
        missions,
        claimed: false
    };
}

// ======================================================
// 🔥 ENTREGA RECOMPENSA ESCALADA
// ======================================================
function grantReward(user, quest) {
    const template = [...QUEST_POOL, ...SECRET_QUESTS].find(q => q.id === quest.id);
    if (!template) return "Sem recompensa.";

    const mult = QUEST_RARITY[template.rarity].multiplier;
    const amount = Math.floor(template.baseReward.amount * mult);

    switch (template.baseReward.type) {
        case 'gold': addGold(user, amount); break;
        case 'gem': addGems(user, amount); break;
        case 'coupon': addCoupons(user, amount); break;
    }

    return `+${amount} ${template.baseReward.type.toUpperCase()}`;
}

// ======================================================
// 🔥 MOSTRA STATUS DAS MISSÕES
// ======================================================
export function getQuestStatus(user) {
    initializeQuests(user);

    let txt = `🎯 **Missões Diárias (${user.quests.date})**\n\n`;
    let allCompleted = true;

    for (const m of user.quests.missions) {
        const template = [...QUEST_POOL, ...SECRET_QUESTS].find(t => t.id === m.id);
        const icon = m.completed ? "✅" : "❌";
        const rarity = QUEST_RARITY[template.rarity].color;

        txt += `${icon} ${rarity} **${template.description}**\n`;
        txt += `Progresso: ${m.progress}/${template.target}\n\n`;

        if (!m.completed) allCompleted = false;
    }

    const bonus = getDailyBonusReward(user);

    if (allCompleted) {
        txt += user.quests.claimed
            ? `✨ Bônus final já reivindicado.`
            : `🎉 **Bônus liberado:** ${bonus.amount} GEMAS — \`!dailyquest claim\``;
    } else {
        txt += `⏳ Complete todas para ganhar ${bonus.amount} GEMAS.`;
    }

    return txt;
}

// ======================================================
// 🔥 ATUALIZA PROGRESSO
// ======================================================
export function updateQuestProgress(user, questId, amount = 1) {
    initializeQuests(user);
    amount = Math.max(0, Number(amount) || 0);

    const mission = user.quests.missions.find(m => m.id === questId);
    const template = [...QUEST_POOL, ...SECRET_QUESTS].find(t => t.id === questId);

    if (!mission || !template || mission.completed) return null;

    mission.progress = Math.min(mission.progress + amount, template.target);

    if (mission.progress >= template.target) {
        mission.completed = true;
        const reward = grantReward(user, mission);
        return `🎉 Missão concluída: ${template.description}\nRecompensa: ${reward}`;
    }

    return null;
}

// ======================================================
// 🔥 REIVINDICA BÔNUS FINAL
// ======================================================
export function claimDailyQuestReward(user) {
    initializeQuests(user);

    if (user.quests.claimed) return "❌ Você já pegou o bônus hoje.";

    if (!user.quests.missions.every(m => m.completed))
        return "❌ Complete todas as missões primeiro.";

    const bonus = getDailyBonusReward(user);
    grantReward(user, { id: "bonus_final" });

    addGems(user, bonus.amount);
    user.quests.claimed = true;

    return `🎉 **Você recebeu o Bônus Final:** +${bonus.amount} GEMAS`;
}