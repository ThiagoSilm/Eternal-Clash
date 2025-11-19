// src/systems/arenaSystem.js

import { addGems, addGold, addXP } from "./economySystem.js";
import { battleSystem } from "./battleSystem.js";
import { generateOpponentForRank } from "./userCacheSystem.js";

// =====================================================================
// CONFIGURAÇÃO
// =====================================================================
const ARENA = {
    MAX_ATTEMPTS: 8,
    ATTACK_COOLDOWN_MS: 20 * 1000,
    DAILY_WIN_REWARD: 5,
    WEEKLY_RESET_MS: 7 * 24 * 60 * 60 * 1000,
    GEM_REWARD_WIN: 4,
    GOLD_REWARD_WIN: 150,
    XP_REWARD_WIN: 30,
    OPPONENT_COUNT: 5,
    ELO_WIN: 18,
    ELO_LOSS: 10,
    MIN_ELO: 0
};

// =====================================================================
// HELPERS
// =====================================================================
const now = () => Date.now();
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

function getLeague(elo) {
    if (elo < 200) return "Bronze";
    if (elo < 500) return "Prata";
    if (elo < 900) return "Ouro";
    if (elo < 1300) return "Platina";
    if (elo < 1700) return "Diamante";
    return "Mítico";
}

function formatCooldown(ms) {
    return ms <= 0 ? "Pronto para lutar!" : `Cooldown: ${(ms / 1000).toFixed(0)}s`;
}

// =====================================================================
// INICIALIZAÇÃO
// =====================================================================
export function initializeArena(user) {
    if (!user.arena) {
        user.arena = {
            elo: 0,
            attempts: ARENA.MAX_ATTEMPTS,
            lastBattleTime: 0,
            lastWeeklyReset: now(),
            pointsChest: 0,
            dailyWins: 0,
            history: [],
            opponents: []
        };
        user.arena.opponents = generateOpponentList(user);
    }
}

// =====================================================================
// OPPONENTS
// =====================================================================
function generateOpponentList(user) {
    const baseElo = user.arena?.elo || 0;
    const list = [];

    for (let i = 0; i < ARENA.OPPONENT_COUNT; i++) {
        const offset = Math.floor(Math.random() * 80 - 40);
        const targetElo = clamp(baseElo + offset, 0, 9999);
        const op = generateOpponentForRank(targetElo);
        list.push({ id: op.id, name: op.name, elo: targetElo, defeated: false });
    }
    return list;
}

// =====================================================================
// RESET SEMANAL
// =====================================================================
function applyWeeklyReset(user) {
    const a = user.arena;
    if (now() - a.lastWeeklyReset >= ARENA.WEEKLY_RESET_MS) {
        a.lastWeeklyReset = now();
        a.attempts = ARENA.MAX_ATTEMPTS;
        a.dailyWins = 0;
        a.pointsChest = 0;
        a.opponents = generateOpponentList(user);
        return true;
    }
    return false;
}

// =====================================================================
// STATUS
// =====================================================================
export function arenaStatus(user) {
    initializeArena(user);
    const a = user.arena;
    const weeklyReset = applyWeeklyReset(user);
    const cd = ARENA.ATTACK_COOLDOWN_MS - (now() - a.lastBattleTime);

    const opsText = a.opponents.map((o, idx) => 
        `${idx + 1}. ${o.name} [${o.elo} ELO] — ${o.defeated ? "Vencido" : "Disponível"}`
    ).join("\n");

    return (
        `🏆 **Arena PvP**\n` +
        (weeklyReset ? "🔄 Reset semanal aplicado!\n" : "") +
        `• Liga: **${getLeague(a.elo)}**\n` +
        `• ELO: **${a.elo}**\n` +
        `• Tentativas: **${a.attempts}/${ARENA.MAX_ATTEMPTS}**\n` +
        `• ${formatCooldown(cd)}\n` +
        `• Baú: **${a.pointsChest} pts**\n` +
        `• Vitórias diárias: **${a.dailyWins}/5**\n\n` +
        `📜 **Oponentes:**\n${opsText}`
    );
}

// =====================================================================
// BATTLE
// =====================================================================
export async function arenaChallenge(user, index) {
    initializeArena(user);
    const a = user.arena;
    const i = index - 1;

    if (a.attempts <= 0) throw new Error("Sem tentativas.");
    if (!a.opponents[i]) throw new Error("Oponente inválido.");
    if (a.opponents[i].defeated) throw new Error("Já derrotado.");

    const cd = now() - a.lastBattleTime;
    if (cd < ARENA.ATTACK_COOLDOWN_MS)
        throw new Error(`Aguarde ${(ARENA.ATTACK_COOLDOWN_MS - cd) / 1000}s.`);

    const opponent = a.opponents[i];

    // Inicializa batalha
    const state = battleSystem.initBattle(
        { name: user.name, deck: user.decks?.main || [], hp: user.hp || 100 },
        generateOpponentForRank(opponent.elo),
        { auto: true }
    );

    // Executa batalha
    while (state.turn <= 60 && state.player.hp > 0 && state.enemy.hp > 0) {
        battleSystem.runTurn(state);
    }

    const win = state.player.hp > 0 && state.enemy.hp <= 0;

    a.lastBattleTime = now();
    a.attempts--;

    let msg = `⚔️ **Vs ${opponent.name} (${opponent.elo} ELO)**\n`;

    if (win) {
        opponent.defeated = true;
        addGems(user, ARENA.GEM_REWARD_WIN);
        addGold(user, ARENA.GOLD_REWARD_WIN);
        addXP(user, ARENA.XP_REWARD_WIN);
        a.elo += ARENA.ELO_WIN;
        a.pointsChest += 10;
        a.dailyWins = Math.min(5, a.dailyWins + 1);

        msg += `\n🏆 **Vitória!**\n` +
               `+${ARENA.GEM_REWARD_WIN}💎 +${ARENA.GOLD_REWARD_WIN}💰 +${ARENA.XP_REWARD_WIN}XP\n` +
               `+${ARENA.ELO_WIN} ELO → **${a.elo}**\n`;

        if (a.opponents.every(o => o.defeated)) {
            a.opponents = generateOpponentList(user);
            msg += "\n🔄 Nova lista de oponentes gerada!";
        }

        if (a.dailyWins === 5) {
            addGems(user, ARENA.DAILY_WIN_REWARD);
            msg += `\n🎁 **Bônus diário:** +${ARENA.DAILY_WIN_REWARD} gemas!`;
        }
    } else {
        a.elo = clamp(a.elo - ARENA.ELO_LOSS, ARENA.MIN_ELO, 9999);
        msg += `\n❌ **Derrota**\n-${ARENA.ELO_LOSS} ELO → **${a.elo}**`;
    }

    a.history.unshift({ opponent: opponent.name, win, timestamp: now(), eloAfter: a.elo });
    if (a.history.length > 20) a.history.pop();

    return msg;
}

// =====================================================================
// CHEST
// =====================================================================
export function arenaReward(user) {
    initializeArena(user);
    const a = user.arena;

    if (a.pointsChest < 50) return "💼 Você precisa de 50 pontos no Baú.";

    const gems = Math.floor(a.pointsChest / 10);
    const gold = a.pointsChest * 5;

    addGems(user, gems);
    addGold(user, gold);

    a.pointsChest = 0;

    return `🎁 **Recompensa da Arena**\n• ${gems} 💎\n• ${gold} 💰`;
}