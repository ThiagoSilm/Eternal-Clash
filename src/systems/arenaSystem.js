// src/systems/arenaSystem.js

import { spendEnergy, addGems } from "./economySystem.js";
import { battleSystem } from "./battleSystem.js"; // Assumido
import { generateOpponentForRank } from "./userCacheSystem.js"; // Assumido: gera um NPC ou busca um usuário

// --- Configurações da Arena ---
const ARENA_SCALING = {
    MAX_ATTEMPTS: 5,
    ATTACK_COOLDOWN_MS: 60 * 1000, // 1 minuto
    RESET_COOLDOWN_MS: 24 * 60 * 60 * 1000, // 24 horas
    OPPONENT_COUNT: 5,
    GEM_REWARD_WIN: 5,
};

// Estrutura de oponente da Arena
function createOpponent(id, name, rank) {
    return {
        id: id,
        name: name,
        rank: rank,
        defeated: false,
    };
}

function generateNewOpponentList(user) {
    const list = [];
    // Assumimos que o rank atual do usuário é 'user.arena.rank'
    const targetRank = (user.arena.rank || 1); 
    
    for (let i = 0; i < ARENA_SCALING.OPPONENT_COUNT; i++) {
        // Geramos um oponente do rank do usuário + 1 (ou o rank atual se for o primeiro)
        const opponentRank = targetRank + (i < 3 ? 0 : 1); 
        
        // Simulação de geração de oponente (NPC ou User)
        const opponentData = generateOpponentForRank(opponentRank);
        list.push(createOpponent(
            opponentData.id, 
            opponentData.name, 
            opponentRank
        ));
    }
    return list;
}

// Inicializa ou reseta o estado da Arena
export function initializeArena(user) {
    if (!user.arena) {
        user.arena = {
            rank: 1,
            points: 0,
            attempts: ARENA_SCALING.MAX_ATTEMPTS,
            lastBattleTime: 0,
            lastReset: 0,
            opponents: generateNewOpponentList(user),
        };
    }
}

// Verifica e aplica o reset diário de tentativas e lista de oponentes
function checkAndResetAttempts(user) {
    initializeArena(user);
    const now = Date.now();
    const state = user.arena;
    
    if (now - state.lastReset >= ARENA_SCALING.RESET_COOLDOWN_MS) {
        state.attempts = ARENA_SCALING.MAX_ATTEMPTS;
        state.lastReset = now;
        state.opponents = generateNewOpponentList(user);
        return true;
    }
    return false;
}

// Função para mostrar o status e a lista
export async function arenaStatus(user) {
    const wasReset = checkAndResetAttempts(user);
    const state = user.arena;
    
    // Calcula o cooldown restante
    const timeSinceLastBattle = Date.now() - state.lastBattleTime;
    const cooldownRemaining = ARENA_SCALING.ATTACK_COOLDOWN_MS - timeSinceLastBattle;
    const cooldownMsg = cooldownRemaining > 0 
        ? `Aguarde ${(cooldownRemaining / 1000).toFixed(0)} segundos para a próxima luta.`
        : "Você está pronto para lutar!";
    
    // Lista de oponentes
    const opponentList = state.opponents.map((o, i) => {
        const status = o.defeated ? "✅ VENCIDO" : "❌ PENDENTE";
        return `${i + 1}. [Rk ${o.rank}] ${o.name} - ${status}`;
    }).join("\n");
    
    return (
        `🏆 **Status da Arena**\n` +
        (wasReset ? "🔄 Tentativas e lista de oponentes diárias foram resetadas.\n" : "") +
        `• Rank: ${state.rank} (${state.points} Pts)\n` +
        `• Tentativas Restantes: ${state.attempts}/${ARENA_SCALING.MAX_ATTEMPTS}\n` +
        `• Cooldown: ${cooldownMsg}\n\n` +
        `**Oponentes Atuais:**\n${opponentList}`
    );
}

// Lógica principal de desafio
export async function arenaChallenge(user, opponentIndex) {
    checkAndResetAttempts(user);
    const state = user.arena;
    const idx = opponentIndex - 1;

    // 1. Validação de Tentativas
    if (state.attempts <= 0) {
        throw new Error("Suas tentativas diárias de Arena acabaram.");
    }
    
    // 2. Validação de Cooldown
    const timeSinceLastBattle = Date.now() - state.lastBattleTime;
    if (timeSinceLastBattle < ARENA_SCALING.ATTACK_COOLDOWN_MS) {
        const remaining = (ARENA_SCALING.ATTACK_COOLDOWN_MS - timeSinceLastBattle) / 1000;
        throw new Error(`Aguarde ${remaining.toFixed(1)} segundos antes de lutar novamente (cooldown de 1 minuto).`);
    }

    // 3. Validação do Oponente
    const opponent = state.opponents[idx];
    if (!opponent) {
        throw new Error("Oponente inválido ou não encontrado na lista (use `!arena status`).");
    }
    if (opponent.defeated) {
        throw new Error(`Você já venceu ${opponent.name}. Escolha outro.`);
    }

    // 4. Batalha
    const userDeck = user.decks?.main || [];
    // O sistema de batalha deve ser capaz de receber oponentes pelo ID/estrutura
    const battleResult = await battleSystem(userDeck, { type: "arenaOpponent", targetId: opponent.id });
    
    // 5. Atualização de Estado
    state.lastBattleTime = Date.now();
    state.attempts -= 1; // Gasta a tentativa (seja vitória ou derrota)

    let finalMessage = `⚔️ Você lutou contra **${opponent.name}**!\n`;
    finalMessage += `--- Resultado da Batalha ---\n`;
    finalMessage += battleResult.log || "Log de batalha indisponível.";

    if (battleResult.win) {
        // Vitória: Recompensa e Marca oponente como vencido
        addGems(user, ARENA_SCALING.GEM_REWARD_WIN);
        opponent.defeated = true;
        
        // Verifica se todos os 5 foram vencidos para gerar nova lista
        const allDefeated = state.opponents.every(o => o.defeated);
        if (allDefeated) {
             state.opponents = generateNewOpponentList(user);
             finalMessage += "\n✅ **VITÓRIA!** Você venceu todos os 5 oponentes! Sua lista foi atualizada com desafios de Rank mais alto!";
        } else {
             finalMessage += `\n✅ **VITÓRIA!** Você ganhou ${ARENA_SCALING.GEM_REWARD_WIN} Gemas 💎!`;
        }
    } else {
        // Derrota: Perde a tentativa, sem recompensa.
        finalMessage += `\n❌ **DERROTA.** Você perdeu a chance diária.`;
    }
    
    return finalMessage;
}

// A função arenaReward é mantida aqui, mas sem implementação detalhada
export async function arenaReward(user) {
    // Lógica para dar recompensas de rank diárias/semanais (não especificada)
    return "Recompensa de Rank resgatada com sucesso (lógica não implementada).";
}
