// src/systems/arenaSystem.js

import { addGems } from "./economySystem.js";
import { battleSystem } from "./battleSystem.js";
import { generateOpponentForRank } from "./userCacheSystem.js";

// =========================================================
// CONFIGURAÇÕES
// =========================================================
const ARENA = {
    MAX_ATTEMPTS: 5,
    ATTACK_COOLDOWN_MS: 60 * 1000, // 1 minuto
    RESET_COOLDOWN_MS: 24 * 60 * 60 * 1000, // 24 horas
    OPPONENT_COUNT: 5,
    GEM_REWARD_WIN: 5,
};

// =========================================================
// HELPERS
// =========================================================
const now = () => Date.now();

const formatCooldown = (ms) =>
    ms <= 0 ? "Você está pronto para lutar!" :
    `Aguarde ${(ms / 1000).toFixed(0)} segundos para a próxima luta.`;

// =========================================================
// ARENA STRUCTURES
// =========================================================
function createOpponent(op) {
    return {
        id: op.id,
        name: op.name,
        rank: op.rank,
        defeated: false
    };
}

function generateOpponentList(user) {
    const list = [];
    const baseRank = user.arena.rank || 1;
    
    for (let i = 0; i < ARENA.OPPONENT_COUNT; i++) {
        const opponentRank = baseRank + (i < 3 ? 0 : 1);
        const data = generateOpponentForRank(opponentRank);
        list.push(createOpponent({ ...data, rank: opponentRank }));
    }
    
    return list;
}

// =========================================================
// INIT
// =========================================================
export function initializeArena(user) {
    if (!user.arena) {
        user.arena = {
            rank: 1,
            points: 0,
            attempts: ARENA.MAX_ATTEMPTS,
            lastBattleTime: 0,
            lastReset: 0,
            opponents: generateOpponentList(user)
        };
    }
}

// =========================================================
// DAILY RESET
// =========================================================
function resetIfNeeded(user) {
    initializeArena(user);
    const state = user.arena;
    
    if (now() - state.lastReset >= ARENA.RESET_COOLDOWN_MS) {
        state.lastReset = now();
        state.attempts = ARENA.MAX_ATTEMPTS;
        state.opponents = generateOpponentList(user);
        return true;
    }
    
    return false;
}

// =========================================================
// STATUS
// =========================================================
export async function arenaStatus(user) {
    const didReset = resetIfNeeded(user);
    const a = user.arena;
    
    const timeLeft = ARENA.ATTACK_COOLDOWN_MS - (now() - a.lastBattleTime);
    
    const opponentsText = a.opponents
        .map((o, i) => `${i + 1}. [Rk ${o.rank}] ${o.name} — ${o.defeated ? "✅ VENCIDO" : "❌ DISPONÍVEL"}`)
        .join("\n");
    
    return (
        `🏆 **Status da Arena**\n` +
        (didReset ? "🔄 Reset diário aplicado.\n" : "") +
        `• Rank: ${a.rank} (${a.points} pontos)\n` +
        `• Tentativas: ${a.attempts}/${ARENA.MAX_ATTEMPTS}\n` +
        `• Cooldown: ${formatCooldown(timeLeft)}\n\n` +
        `📜 **Oponentes:**\n${opponentsText}`
    );
}

// =========================================================
// BATTLE FLOW
// =========================================================
export async function arenaChallenge(user, index) {
    resetIfNeeded(user);
    
    const a = user.arena;
    const i = index - 1;
    
    if (a.attempts <= 0)
        throw new Error("Você não tem mais tentativas hoje.");
    
    const timePassed = now() - a.lastBattleTime;
    if (timePassed < ARENA.ATTACK_COOLDOWN_MS) {
        const wait = (ARENA.ATTACK_COOLDOWN_MS - timePassed) / 1000;
        throw new Error(`Aguarde ${wait.toFixed(1)}s para lutar novamente.`);
    }
    
    const opponent = a.opponents[i];
    if (!opponent)
        throw new Error("Oponente inválido. Use `!arena status`.");
    
    if (opponent.defeated)
        throw new Error(`Você já derrotou **${opponent.name}**.`);
    
    // =========================================================
    // BATALHA
    // =========================================================
    const deck = user.decks?.main || [];
    const battle = await battleSystem(deck, {
        type: "arenaOpponent",
        targetId: opponent.id
    });
    
    a.lastBattleTime = now();
    a.attempts--;
    
    let msg =
        `⚔️ **Batalha contra ${opponent.name}!**\n` +
        `━━━━━━━━━━━━━━\n` +
        (battle.log || "Log de batalha indisponível.") +
        `\n━━━━━━━━━━━━━━\n`;
    
    if (battle.win) {
        opponent.defeated = true;
        addGems(user, ARENA.GEM_REWARD_WIN);
        
        const allWin = a.opponents.every(o => o.defeated);
        
        if (allWin) {
            a.opponents = generateOpponentList(user);
            msg += `\n🏆 **VITÓRIA TOTAL!**\nVocê derrotou todos os 5 oponentes.\nNova lista gerada com oponentes mais fortes!`;
        } else {
            msg += `\n✅ **VITÓRIA!** Você ganhou **${ARENA.GEM_REWARD_WIN} gemas 💎**!`;
        }
        
    } else {
        msg += "\n❌ **DERROTA.** Você perdeu sua tentativa.";
    }
    
    return msg;
}

// =========================================================
// REWARD
// =========================================================
export async function arenaReward(user) {
    return "🎁 Sistema de recompensas da Arena ainda será implementado.";
}