import { addGems, addGold, addXP } from "./economySystem.js";
import { battleSystem } from "./battleSystem.js";
import { generateOpponentForRank } from "./userCacheSystem.js";
import { CardController } from "./CardController.js";

/* --------------------------
   CONFIG & CONSTANTS
   -------------------------- */
const ARENA_CONFIG = Object.freeze({
  MAX_ATTEMPTS: 8,
  ATTACK_COOLDOWN: 2 * 60 * 1000, // 2 min
  WEEKLY_RESET: 7 * 24 * 60 * 60 * 1000,
  OPPONENT_COUNT: 5,
  REWARDS: { GEM: 4, GOLD: 150, XP: 30, DAILY: 5 },
  ELO: { WIN: 18, LOSS: 10, MIN: 0 },
  MAX_HISTORY: 50
});

const SAFE = Object.freeze({
  now: () => Date.now(),
  clamp: (v, min, max) => Math.min(max, Math.max(min, v)),
  assert: (cond, msg) => { if (!cond) throw new Error(msg); }
});

/* --------------------------
   STATE MANAGEMENT
   -------------------------- */

export function initializeArena(user) {
  if (!user.arena) {
    user.arena = {
      elo: 0,
      attempts: ARENA_CONFIG.MAX_ATTEMPTS,
      lastBattleTime: 0,
      lastWeeklyReset: SAFE.now(),
      pointsChest: 0,
      dailyWins: 0,
      history: [],
      opponents: generateOpponentList(0)
    };
  }
  checkWeeklyReset(user.arena);
}

function checkWeeklyReset(arena) {
  if (SAFE.now() - arena.lastWeeklyReset >= ARENA_CONFIG.WEEKLY_RESET) {
    arena.lastWeeklyReset = SAFE.now();
    arena.attempts = ARENA_CONFIG.MAX_ATTEMPTS;
    arena.dailyWins = 0;
    arena.pointsChest = 0;
    arena.opponents = generateOpponentList(arena.elo);
    return true;
  }
  return false;
}

/* --------------------------
   HELPERS: GENERATORS
   -------------------------- */

function generateOpponentList(baseElo) {
  const list = [];
  for (let i = 0; i < ARENA_CONFIG.OPPONENT_COUNT; i++) {
    const variance = Math.floor(baseElo * 0.2) + 50;
    const offset = Math.floor(Math.random() * (variance * 2) - variance);
    const targetElo = SAFE.clamp(baseElo + offset, 0, 9999);
    const opData = generateOpponentForRank(targetElo);
    
    list.push({
      id: opData.id,
      name: opData.name,
      elo: targetElo,
      defeated: false,
      lastBattle: 0
    });
  }
  return list;
}

function getLeague(elo) {
  if (elo < 200) return "Bronze";
  if (elo < 500) return "Prata";
  if (elo < 900) return "Ouro";
  if (elo < 1300) return "Platina";
  if (elo < 1700) return "Diamante";
  return "Mítico";
}

/* --------------------------
   CORE: CHALLENGE
   -------------------------- */

export async function arenaChallenge(user, index) {
  initializeArena(user);
  const opponentIndex = index - 1;
  
  // 1. Validation
  const opponent = validateChallenge(user.arena, opponentIndex);

  // 2. Setup Battle Entities
  const { playerObj, enemyObj } = prepareBattleEntities(user, opponent);

  // 3. Run Battle
  const { win, logs } = executeBattle(playerObj, enemyObj);

  // 4. Process Results
  const resultMsg = processBattleResult(user, opponent, win);

  // 5. Update Timestamps
  user.arena.lastBattleTime = SAFE.now();
  opponent.lastBattle = SAFE.now();
  user.arena.attempts--;

  return resultMsg + (logs.length ? `\n\n📜 **Log parcial:**\n${logs}` : "");
}

function validateChallenge(arena, index) {
  SAFE.assert(arena.attempts > 0, "Sem tentativas restantes.");
  
  const opponent = arena.opponents[index];
  SAFE.assert(opponent, "Oponente inválido.");
  SAFE.assert(!opponent.defeated, "Oponente já derrotado.");

  const globalCD = SAFE.now() - arena.lastBattleTime;
  SAFE.assert(globalCD >= ARENA_CONFIG.ATTACK_COOLDOWN, 
    `Cooldown global: aguarde ${Math.ceil((ARENA_CONFIG.ATTACK_COOLDOWN - globalCD)/1000)}s.`);

  const opCD = SAFE.now() - (opponent.lastBattle || 0);
  SAFE.assert(opCD >= ARENA_CONFIG.ATTACK_COOLDOWN, 
    `Cooldown oponente: aguarde ${Math.ceil((ARENA_CONFIG.ATTACK_COOLDOWN - opCD)/1000)}s.`);

  return opponent;
}

function prepareBattleEntities(user, opponent) {
  const playerObj = { name: user.name, hp: user.hp || 100, deck: user.decks?.main || [] };
  const rawEnemy = generateOpponentForRank(opponent.elo);
  const enemyObj = { name: rawEnemy.name, hp: rawEnemy.hp || 100, deck: rawEnemy.deck || [] };

  // Apply CardController logic (shuffle, templates)
  const pack = CardController.prepareBattleCardPackages(playerObj, enemyObj);
  pack.applyToEntities();

  return { playerObj, enemyObj };
}

function executeBattle(player, enemy) {
  // Init Battle State
  const state = battleSystem.initBattle(player, enemy, { auto: true, arena: true });
  
  // Run Loop
  const result = battleSystem.runBattle(state);
  
  // Extract Logs (last 5 entries for brevity)
  const logs = state.log
    .slice(-5)
    .map(l => `[T${l.turn}] ${l.actor}: ${l.action || l.note}`)
    .join("\n");

  return { win: result.winner === "player", logs };
}

/* --------------------------
   RESULT PROCESSING
   -------------------------- */

function processBattleResult(user, opponent, win) {
  const arena = user.arena;
  let msg = `⚔️ **${user.name} vs ${opponent.name}**\n`;

  if (win) {
    opponent.defeated = true;
    const rewards = calculateRewards(opponent.elo);
    applyRewards(user, rewards);
    
    arena.elo += ARENA_CONFIG.ELO.WIN;
    arena.dailyWins = Math.min(5, arena.dailyWins + 1);
    arena.pointsChest += Math.max(5, Math.floor(opponent.elo / 100));
    
    msg += `🏆 **Vitória!**\n+${rewards.gems}💎 +${rewards.gold}💰\n+${ARENA_CONFIG.ELO.WIN} ELO`;
    
    if (arena.dailyWins === 5) {
      addGems(user, ARENA_CONFIG.REWARDS.DAILY);
      msg += `\n🎁 Bônus diário: +${ARENA_CONFIG.REWARDS.DAILY}💎`;
    }
    
    // Reset opponents if cleared
    if (arena.opponents.every(o => o.defeated)) {
      arena.opponents = generateOpponentList(arena.elo);
      msg += "\n🔄 Nova lista de oponentes gerada!";
    }
  } else {
    arena.elo = SAFE.clamp(arena.elo - ARENA_CONFIG.ELO.LOSS, ARENA_CONFIG.ELO.MIN, 9999);
    msg += `❌ **Derrota**\n-${ARENA_CONFIG.ELO.LOSS} ELO`;
  }

  logHistory(arena, opponent, win);
  return msg;
}

function calculateRewards(elo) {
  const multiplier = 1 + (elo / 1000);
  return {
    gems: Math.floor(ARENA_CONFIG.REWARDS.GEM * multiplier),
    gold: Math.floor(ARENA_CONFIG.REWARDS.GOLD * multiplier),
    xp: Math.floor(ARENA_CONFIG.REWARDS.XP * multiplier)
  };
}

function applyRewards(user, rewards) {
  addGems(user, rewards.gems);
  addGold(user, rewards.gold);
  addXP(user, rewards.xp);
}

function logHistory(arena, opponent, win) {
  arena.history.unshift({
    opponent: opponent.name,
    result: win ? "WIN" : "LOSS",
    elo: arena.elo,
    ts: SAFE.now()
  });
  if (arena.history.length > ARENA_CONFIG.MAX_HISTORY) arena.history.pop();
}

/* --------------------------
   VIEW & REWARDS
   -------------------------- */

export function arenaStatus(user) {
  initializeArena(user);
  const a = user.arena;
  
  const opsList = a.opponents.map((o, i) => {
    const cd = ARENA_CONFIG.ATTACK_COOLDOWN - (SAFE.now() - (o.lastBattle || 0));
    const status = o.defeated ? "✅ Vencido" : (cd > 0 ? `⏳ ${Math.ceil(cd/1000)}s` : "⚔️ Lutar");
    return `${i + 1}. ${o.name} [${o.elo}] — ${status}`;
  }).join("\n");

  return (
    `🏆 **Arena PvP** (${getLeague(a.elo)})\n` +
    `ELO: **${a.elo}** | Tentativas: **${a.attempts}/${ARENA_CONFIG.MAX_ATTEMPTS}**\n` +
    `Baú: **${a.pointsChest} pts** | Vitórias Hoje: **${a.dailyWins}/5**\n\n` +
    `${opsList}`
  );
}

export function arenaReward(user) {
  initializeArena(user);
  const a = user.arena;
  
  if (a.pointsChest < 50) return "💼 Precisa de 50 pontos para abrir o baú.";
  
  const gems = Math.floor(a.pointsChest / 10);
  const gold = a.pointsChest * 5;
  
  addGems(user, gems);
  addGold(user, gold);
  a.pointsChest = 0;
  
  return `🎁 **Baú Aberto!**\nGanhou: ${gems} 💎 e ${gold} 💰`;
}

export function arenaLeaderboard(users) {
  return users
    .filter(u => u.arena && u.arena.elo > 0)
    .sort((a, b) => b.arena.elo - a.arena.elo)
    .slice(0, 10)
    .map((u, i) => `${i+1}. ${u.name} — ${u.arena.elo} ELO`)
    .join("\n") || "Nenhum jogador classificado.";
}
