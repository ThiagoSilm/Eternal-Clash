// src/systems/arenaSystem.js

// 🚨 IMPORTAÇÕES ESSENCIAIS
// loadUser é necessário para carregar o objeto do OPONENTE (exceção aceita para dados de outro usuário).
import { loadUser } from "./userSystem.js"; 
// Lógica de batalha
import { battleSystem } from "./battleSystem.js";
// Economia (Gasto de energia e adição de recompensas)
import { spendEnergy, addGold, addGems } from "./economySystem.js"; 

// --- MOCKS DE DADOS COMPARTILHADOS (Ranking) ---
let ARENA_RANKINGS_MOCK = {}; 

/** [HELPER] Carrega o ranking da arena (mock). */
function loadArenaRankings() {
  return ARENA_RANKINGS_MOCK; 
}

/** [HELPER] Salva o ranking da arena (mock). */
function saveArenaRankings(rankings) {
  ARENA_RANKINGS_MOCK = rankings;
}

// --- CONFIGURAÇÕES ---
const ENERGY_COST = 5;
const MMR_BASE_CHANGE = 20;

const REWARDS = [
    { rank: 1, gold: 10000, gems: 100 },
    { rank: 2, gold: 8000, gems: 80 },
    { rank: 10, gold: 2000, gems: 20 },
    { rank: 50, gold: 500, gems: 5 },
];

// ------------------------------------
// 🔹 FUNÇÕES INTERNAS DE LÓGICA
// ------------------------------------

/** [HELPER] Inicializa o status de arena do usuário. */
function initializeArenaStatus(user) {
    if (!user.arena) {
        user.arena = {
            mmr: 1000, // Pontuação inicial
            lastRewardClaim: null,
            // defenseDeck: [] // Assumimos que o campo será criado por outro comando
        };
    }
}

/** [HELPER] Calcula a mudança de MMR (Elo Rating System simplificado). */
function calculateMMRChange(winnerMMR, loserMMR, isWinner) {
    const expectedScore = 1 / (1 + Math.pow(10, (loserMMR - winnerMMR) / 400));
    const actualScore = isWinner ? 1 : 0;
    const kFactor = MMR_BASE_CHANGE;
    
    return Math.round(kFactor * (actualScore - expectedScore));
}

/**
 * [HELPER] Cria o input para o battleSystem baseado no objeto do usuário e em um deck de uniqueIds.
 * @param {object} combatantUser O objeto do usuário/combatente.
 * @param {string[]} selectedUniqueIds Array de uniqueIds das cartas selecionadas.
 */
function createCombatantInput(combatantUser, selectedUniqueIds = []) {
    // Busca as instâncias completas das cartas baseadas nos uniqueIds presentes no inventário.
    const cardsToUse = (combatantUser.cards || []).filter(c => selectedUniqueIds.includes(c.uniqueId));

    return {
        id: combatantUser.id,
        name: combatantUser.username || combatantUser.id,
        cards: cardsToUse,
        // TODO: Incluir Guardian se a lógica de deck de defesa/ataque for separada para ele.
    };
}

// ------------------------------------
// 🔹 FUNÇÕES EXPORTADAS
// ------------------------------------

/**
 * Simula um desafio de Arena contra o time de defesa de outro jogador.
 * @param {object} user O objeto usuário (atacante), que será mutado.
 * @param {string} targetId O ID do usuário alvo.
 * @returns {string} Mensagem do resultado.
 */
export function arenaChallenge(user, targetId) {
    initializeArenaStatus(user);

    // 1. Gasto de Energia (Delegação ao economySystem)
    try {
        spendEnergy(user, ENERGY_COST);
    } catch (e) {
        return `❌ Você precisa de ${ENERGY_COST} de energia para lutar.`;
    }
    
    // 2. Carregar o Objeto do Oponente (Alvo)
    let opponent;
    try {
        opponent = loadUser(targetId); // Busca o objeto completo do oponente
    } catch (e) {
        return `❌ O jogador com ID/Nome "${targetId}" não foi encontrado.`;
    }

    // 3. Validação e Construção do Input do Oponente
    const defenseDeck = opponent.arena?.defenseDeck || [];
    const playerAttackDeck = user.arena?.attackDeck || user.cards.map(c => c.uniqueId); // Usa todas se não houver deck de ataque

    if (defenseDeck.length === 0) {
        return `❌ O jogador ${opponent.username} não possui um deck de defesa configurado na Arena.`;
    }
    
    // 4. Monta os times a partir dos decks
    const playerInput = createCombatantInput(user, playerAttackDeck);
    const opponentInput = createCombatantInput(opponent, defenseDeck); 
    
    // Checagem final: ambos os combatentes devem ter cartas
    if (playerInput.cards.length === 0) {
        return "❌ Você não tem cartas selecionadas para lutar (Verifique seu deck de ataque).";
    }

    // 5. Execução da Batalha (PvP Assíncrono)
    const battleResult = battleSystem(playerInput, opponentInput, { seed: Date.now() });

    // 6. Lógica de Atualização de MMR (Apenas o atacante ganha/perde MMR)
    const rankings = loadArenaRankings();
    
    const playerMMR = user.arena.mmr;
    // Usa o MMR do alvo ou 1000 base se ainda não tiver jogado Arena
    const opponentMMR = opponent.arena?.mmr ?? 1000; 

    let playerChange = 0;
    
    if (battleResult.winner === 'player') {
        playerChange = calculateMMRChange(playerMMR, opponentMMR, true);
    } else if (battleResult.winner === 'opponent') {
        playerChange = calculateMMRChange(playerMMR, opponentMMR, false);
    }
    
    user.arena.mmr = Math.max(100, playerMMR + playerChange); 
    
    // 7. Atualiza o Ranking Global
    rankings[user.id] = { id: user.id, mmr: user.arena.mmr, username: user.username || user.id };
    saveArenaRankings(rankings);
    
    // 8. Concessão de Recompensas (imediata)
    const baseGold = battleResult.rewards.gold;
    addGold(user, baseGold);
    
    // 9. Mensagem de Retorno
    let response = `⚔️ **Resultado da Arena vs ${opponent.username}**\n`;
    response += `--- \n`;
    response += `Vencedor: **${battleResult.winner === 'player' ? user.username : opponent.username}**\n`;
    response += `MMR: ${playerMMR} -> **${user.arena.mmr}** (${playerChange > 0 ? '+' : ''}${playerChange})\n`;
    response += `💰 Recompensa imediata: +${baseGold} Ouro\n`;
    response += `Detalhes do Log: ${battleResult.log.slice(0, 3).join(' / ')}...`;
    
    return response;
}

/**
 * Retorna o status de Arena do usuário (MMR, Rank, Recompensas Pendentes).
 * @param {object} user O objeto usuário.
 * @returns {string} Mensagem de status.
 */
export function arenaStatus(user) {
    initializeArenaStatus(user);

    const rankings = loadArenaRankings();
    
    // 1. Calcula a posição do usuário (rank)
    const sorted = Object.values(rankings).sort((a, b) => b.mmr - a.mmr);
    // Encontra o rank pelo ID para evitar conflitos de usernames
    const userRank = sorted.findIndex(r => r.id === user.id) + 1; 
    
    // 2. Calcula a próxima recompensa
    const nextReward = REWARDS.find(r => r.rank >= userRank);
    const nextRewardMsg = nextReward 
        ? `🏆 Rank ${nextReward.rank}: ${nextReward.gold} Ouro e ${nextReward.gems} Gemas.` 
        : "Nenhuma recompensa bônus de rank disponível.";
    
    return `
🏆 **Status da Arena de ${user.username || user.id}**
---
✨ **MMR (Pontuação):** ${user.arena.mmr}
🏅 **Rank Global:** #${userRank}
💰 **Próxima Recompensa:** ${nextRewardMsg}
`;
}

/**
 * Reivindica a recompensa diária/semanal baseada no Rank.
 * @param {object} user O objeto usuário.
 * @returns {string} Mensagem do resultado.
 */
export function arenaReward(user) {
    initializeArenaStatus(user);
    
    const today = new Date().toDateString();

    if (user.arena.lastRewardClaim === today) {
        return "❌ Você já reivindicou suas recompensas de rank hoje.";
    }

    const rankings = loadArenaRankings();
    const sorted = Object.values(rankings).sort((a, b) => b.mmr - a.mmr);
    const userRank = sorted.findIndex(r => r.id === user.id) + 1; 
    
    const reward = REWARDS.find(r => r.rank >= userRank);

    if (!reward) {
        user.arena.lastRewardClaim = today;
        return "⚠️ Não há recompensas disponíveis para o seu rank atual.";
    }
    
    // Concede as recompensas
    addGold(user, reward.gold);
    addGems(user, reward.gems);
    
    user.arena.lastRewardClaim = today;
    
    return `🎉 **Recompensa Diária Recebida!**\n` +
           `🏅 Rank #${userRank} Bônus: +${reward.gold} Ouro e +${reward.gems} Gemas.`;
}
