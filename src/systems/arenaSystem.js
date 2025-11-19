// src/systems/arenaSystem.js
import { addGems, addGold, addXP } from "./economySystem.js";
import { battleSystem } from "./battleSystem.js";
import { generateOpponentForRank } from "./userCacheSystem.js";
import { CardController } from "./CardController.js";

// ======================= CONFIG =======================
const ARENA = {
    MAX_ATTEMPTS: 8,
    ATTACK_COOLDOWN_MS: 2 * 60 * 1000,
    DAILY_WIN_REWARD: 5,
    WEEKLY_RESET_MS: 7 * 24 * 60 * 60 * 1000,
    GEM_REWARD_WIN: 4,
    GOLD_REWARD_WIN: 150,
    XP_REWARD_WIN: 30,
    OPPONENT_COUNT: 5,
    ELO_WIN: 18,
    ELO_LOSS: 10,
    MIN_ELO: 0,
    MAX_HISTORY: 50
};

// ======================= HELPERS =======================
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
    if (ms <= 0) return "Pronto para lutar!";
    const s = Math.ceil(ms / 1000);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `Cooldown: ${m}m ${sec}s` : `Cooldown: ${sec}s`;
}

function generateOpponentList(user) {
    const baseElo = user.arena?.elo || 0;
    const list = [];
    for (let i = 0; i < ARENA.OPPONENT_COUNT; i++) {
        const variance = Math.floor(baseElo * 0.2) + 50;
        const offset = Math.floor(Math.random() * (variance * 2) - variance);
        const targetElo = clamp(baseElo + offset, 0, 9999);
        const op = generateOpponentForRank(targetElo);
        list.push({
            id: op.id,
            name: op.name,
            elo: targetElo,
            defeated: false,
            lastBattle: 0
        });
    }
    return list;
}

// ======================= ARENA ROOT =======================
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
            opponents: generateOpponentList(user)
        };
    }
}

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

// ======================= STATUS =======================
export function arenaStatus(user) {
    initializeArena(user);
    const a = user.arena;
    const weeklyReset = applyWeeklyReset(user);
    
    const opsText = a.opponents.map((o, idx) => {
        const cd = ARENA.ATTACK_COOLDOWN_MS - (now() - (o.lastBattle || 0));
        return `${idx + 1}. ${o.name} [${o.elo} ELO] — ${o.defeated ? "Vencido" : formatCooldown(cd)}`;
    }).join("\n");
    
    return (
        `🏆 **Arena PvP**\n` +
        (weeklyReset ? "🔄 Reset semanal aplicado!\n" : "") +
        `• Liga: **${getLeague(a.elo)}**\n` +
        `• ELO: **${a.elo}**\n` +
        `• Tentativas: **${a.attempts}/${ARENA.MAX_ATTEMPTS}**\n` +
        `• Baú: **${a.pointsChest} pts**\n` +
        `• Vitórias diárias: **${a.dailyWins}/5**\n\n` +
        `📜 **Oponentes:**\n${opsText}`
    );
}

// ======================= BATTLE =======================
export async function arenaChallenge(user, index) {
    initializeArena(user);
    const a = user.arena;
    const i = index - 1;

    if (a.attempts <= 0) throw new Error("Sem tentativas.");
    if (!a.opponents[i]) throw new Error("Oponente inválido.");
    if (a.opponents[i].defeated) throw new Error("Já derrotado.");

    const cdGlobal = now() - a.lastBattleTime;
    if (cdGlobal < ARENA.ATTACK_COOLDOWN_MS)
        throw new Error(`Aguarde ${(ARENA.ATTACK_COOLDOWN_MS - cdGlobal) / 1000}s.`);

    const opponent = a.opponents[i];
    const cdOpponent = now() - (opponent.lastBattle || 0);
    if (cdOpponent < ARENA.ATTACK_COOLDOWN_MS)
        throw new Error(`Aguarde ${(ARENA.ATTACK_COOLDOWN_MS - cdOpponent) / 1000}s.`);

    // PLAYER
    const playerObj = {
        name: user.name,
        hp: user.hp || 100,
        deck: user.decks?.main || []
    };

    // OPONENTE ARTIFICIAL
    const enemyGen = generateOpponentForRank(opponent.elo);
    const enemyObj = {
        name: enemyGen.name,
        hp: enemyGen.hp || 100,
        deck: enemyGen.deck || []
    };

    // PREPARAÇÃO DOS DECKS VIA CARD CONTROLLER
    const pack = CardController.prepareBattleCardPackages(playerObj, enemyObj);
    pack.applyToEntities();

    // BATALHA COM LOG
    const state = battleSystem.initBattle(
        playerObj, enemyObj,
        { auto: true, arena: true, returnLog: true }
    );

    let battleLog = [];
    while (state.turn <= 60 && state.player.hp > 0 && state.enemy.hp > 0) {
        const turnLog = battleSystem.runBattle(state);
        if (turnLog) battleLog.push(...turnLog);
    }

    const win = state.player.hp > 0 && state.enemy.hp <= 0;

    // ATUALIZA ARENA
    a.lastBattleTime = now();
    opponent.lastBattle = now();
    a.attempts--;

    let msg = `⚔️ **Arena — ${user.name} vs ${opponent.name} (${opponent.elo} ELO)**\n`;

    if (win) {
        opponent.defeated = true;

        const f = 1 + opponent.elo / 1000;
        const gems = Math.floor(ARENA.GEM_REWARD_WIN * f);
        const gold = Math.floor(ARENA.GOLD_REWARD_WIN * f);
        const xp = Math.floor(ARENA.XP_REWARD_WIN * f);

        addGems(user, gems);
        addGold(user, gold);
        addXP(user, xp);

        a.elo += ARENA.ELO_WIN;
        const chestPts = Math.max(5, Math.floor(opponent.elo / 100));
        a.pointsChest += chestPts;
        a.dailyWins = Math.min(5, a.dailyWins + 1);

        msg += `\n🏆 **Vitória!**\n+${gems}💎 +${gold}💰 +${xp}XP\n+${ARENA.ELO_WIN} ELO → **${a.elo}**\n+${chestPts} pts`;

        if (a.opponents.every(o => o.defeated)) {
            a.opponents = generateOpponentList(user);
            msg += "\n🔄 Nova lista de oponentes!";
        }

        if (a.dailyWins === 5) {
            addGems(user, ARENA.DAILY_WIN_REWARD);
            msg += `\n🎁 Bônus diário: +${ARENA.DAILY_WIN_REWARD}💎`;
        }

    } else {
        a.elo = clamp(a.elo - ARENA.ELO_LOSS, ARENA.MIN_ELO, 9999);
        msg += `\n❌ **Derrota**\n-${ARENA.ELO_LOSS} ELO → **${a.elo}**`;
    }

    // HISTÓRICO
    a.history.unshift({
        opponent: opponent.name,
        win,
        timestamp: now(),
        eloAfter: a.elo,
        chestPoints: win ? Math.max(5, Math.floor(opponent.elo / 100)) : 0,
        playerHP: state.player.hp,
        enemyHP: state.enemy.hp,
        turns: state.turn
    });
    if (a.history.length > ARENA.MAX_HISTORY) a.history.pop();

    if (battleLog.length > 0)
        msg += `\n\n📜 **Log da Batalha**\n` + battleLog.slice(0, 40).join("\n");

    return msg;
}

// ======================= REWARD =======================
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

// ======================= LEADERBOARD =======================
export function arenaLeaderboard(users) {
    return users
        .filter(u => u.arena)
        .sort((a, b) => (b.arena.elo || 0) - (a.arena.elo || 0))
        .slice(0, 10)
        .map((u, i) => `${i+1}. ${u.name} — ${u.arena.elo || 0} ELO`)
        .join("\n");
}