// src/systems/arenaSystem.js

import { loadUser } from "./userSystem.js";
import { battleSystem } from "./battleSystem.js";
import { spendEnergy, addGold, addGems } from "./economySystem.js";

// ---------------- MOCK DE RANKINGS ----------------
let ARENA_RANKINGS_MOCK = {};
function loadArenaRankings() { return ARENA_RANKINGS_MOCK; }
function saveArenaRankings(rankings) { ARENA_RANKINGS_MOCK = rankings; }

// ---------------- CONFIGURAÇÕES ----------------
const ENERGY_COST = 4;
const MMR_BASE_CHANGE = 20;

const REWARDS = [
    { rank: 1, gold: 10000, gems: 100 },
    { rank: 2, gold: 8000, gems: 80 },
    { rank: 10, gold: 2000, gems: 20 },
    { rank: 50, gold: 500, gems: 5 },
];

// ---------------- HELPERS ----------------

function initializeArenaStatus(user) {
    if (!user.arena) {
        user.arena = {
            mmr: 1000,
            lastRewardClaim: null,
            attackDeck: [],
            defenseDeck: []
        };
    }
}

function calculateMMRChange(winnerMMR, loserMMR, isWinner) {
    const expectedScore = 1 / (1 + Math.pow(10, (loserMMR - winnerMMR) / 400));
    const actualScore = isWinner ? 1 : 0;
    const kFactor = MMR_BASE_CHANGE;
    return Math.round(kFactor * (actualScore - expectedScore));
}

function createCombatantInput(combatantUser, selectedUniqueIds = []) {
    const cardsToUse = (combatantUser.cards || []).filter(c => selectedUniqueIds.includes(c.uniqueId));
    return {
        id: combatantUser.id,
        name: combatantUser.username || combatantUser.id,
        cards: cardsToUse,
        guardian: combatantUser.guardian ? { ...combatantUser.guardian } : null
    };
}

// ---------------- FUNÇÕES PRINCIPAIS ----------------

export function arenaChallenge(user, targetId) {
    initializeArenaStatus(user);

    // 1️⃣ Gasto de energia
    try { spendEnergy(user, ENERGY_COST); }
    catch { return `❌ Você precisa de ${ENERGY_COST} de energia para lutar.`; }

    // 2️⃣ Carregar o oponente
    let opponent;
    try { opponent = loadUser(targetId); }
    catch { return `❌ Jogador "${targetId}" não encontrado.`; }

    initializeArenaStatus(opponent);

    // 3️⃣ Decks de ataque/defesa
    const playerAttackDeck = user.arena.attackDeck.length > 0 
        ? user.arena.attackDeck 
        : user.cards.map(c => c.uniqueId);

    const defenseDeck = opponent.arena.defenseDeck;
    if (!defenseDeck || defenseDeck.length === 0) 
        return `❌ O jogador ${opponent.username} não possui um deck de defesa configurado.`;

    const playerInput = createCombatantInput(user, playerAttackDeck);
    const opponentInput = createCombatantInput(opponent, defenseDeck);

    if (playerInput.cards.length === 0) 
        return "❌ Você não tem cartas selecionadas para lutar.";

    // 4️⃣ Executa batalha
    const battleResult = battleSystem(playerInput, opponentInput, { seed: Date.now() });

    // 5️⃣ Atualiza MMR
    const rankings = loadArenaRankings();
    const playerMMR = user.arena.mmr;
    const opponentMMR = opponent.arena?.mmr ?? 1000;

    let playerChange = 0;
    if (battleResult.winner === 'player') playerChange = calculateMMRChange(playerMMR, opponentMMR, true);
    else if (battleResult.winner === 'opponent') playerChange = calculateMMRChange(playerMMR, opponentMMR, false);

    user.arena.mmr = Math.max(100, playerMMR + playerChange);

    // 6️⃣ Atualiza ranking
    rankings[user.id] = { id: user.id, mmr: user.arena.mmr, username: user.username || user.id };
    saveArenaRankings(rankings);

    // 7️⃣ Recompensa imediata
    addGold(user, battleResult.rewards.gold);
    addGems(user, battleResult.rewards.gems);

    // 8️⃣ Mensagem final
    let response = `⚔️ **Arena: ${user.username} vs ${opponent.username}**\n`;
    response += `---\n`;
    response += `Vencedor: **${battleResult.winner === 'player' ? user.username : opponent.username}**\n`;
    response += `MMR: ${playerMMR} -> **${user.arena.mmr}** (${playerChange >= 0 ? '+' : ''}${playerChange})\n`;
    response += `💰 Ouro ganho: +${battleResult.rewards.gold} | Gemas: +${battleResult.rewards.gems}\n`;
    response += `📜 Log da batalha: ${battleResult.log.slice(0, 5).join(' / ')}...`;

    return response;
}

export function arenaStatus(user) {
    initializeArenaStatus(user);
    const rankings = loadArenaRankings();
    const sorted = Object.values(rankings).sort((a, b) => b.mmr - a.mmr);
    const userRank = sorted.findIndex(r => r.id === user.id) + 1;

    const nextReward = REWARDS.find(r => r.rank >= userRank);
    const nextRewardMsg = nextReward 
        ? `🏆 Rank ${nextReward.rank}: +${nextReward.gold} Ouro e +${nextReward.gems} Gemas`
        : "Nenhuma recompensa bônus de rank disponível.";

    return `
🏆 **Arena de ${user.username || user.id}**
---
✨ MMR: ${user.arena.mmr}
🏅 Rank Global: #${userRank}
💰 Próxima Recompensa: ${nextRewardMsg}
`;
}

export function arenaReward(user) {
    initializeArenaStatus(user);
    const today = new Date().toDateString();

    if (user.arena.lastRewardClaim === today)
        return "❌ Você já reivindicou suas recompensas de rank hoje.";

    const rankings = loadArenaRankings();
    const sorted = Object.values(rankings).sort((a, b) => b.mmr - a.mmr);
    const userRank = sorted.findIndex(r => r.id === user.id) + 1;

    const reward = REWARDS.find(r => r.rank >= userRank);
    if (!reward) {
        user.arena.lastRewardClaim = today;
        return "⚠️ Não há recompensas disponíveis para o seu rank atual.";
    }

    addGold(user, reward.gold);
    addGems(user, reward.gems);
    user.arena.lastRewardClaim = today;

    return `🎉 **Recompensa Recebida!**\n🏅 Rank #${userRank}: +${reward.gold} Ouro e +${reward.gems} Gemas.`;
}