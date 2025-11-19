import { addGems, addGold, addXP } from "./economySystem.js";
import { battleSystem } from "./battleSystem.js";
import { generateOpponentForRank } from "./userCacheSystem.js";
import { CardController } from "../controllers/cardController.js";

/* --------------------------
   CONFIGURAÇÃO & CONSTANTES
   -------------------------- */
const ARENA_CONFIG = Object.freeze({
  MAX_ATTEMPTS: 8,
  ATTACK_COOLDOWN_MS: 2 * 60 * 1000, // 2 minutos
  WEEKLY_RESET_MS: 7 * 24 * 60 * 60 * 1000,
  OPPONENT_COUNT: 5,
  REWARDS_BASE: { GEM: 4, GOLD: 150, XP: 30, DAILY_GEM_BONUS: 5, DAILY_WIN_LIMIT: 5 },
  ELO: { WIN_GAIN: 18, LOSS_DEDUCTION: 10, MIN_ELO: 0 },
  MAX_HISTORY: 50
});

/* --------------------------
   UTILS INTERNOS
   -------------------------- */

const now = () => Date.now();
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

/**
 * Lança um erro se a condição for falsa.
 * @param {boolean} condition - Condição a ser verificada.
 * @param {string} message - Mensagem de erro.
 */
function assert(condition, message) { 
    if (!condition) throw new Error(message); 
}

/* --------------------------
   GERENCIAMENTO DE ESTADO
   -------------------------- */

/**
 * Inicializa a seção 'arena' do usuário se ela não existir e verifica o reset semanal.
 * @param {Object} user - Objeto do usuário.
 */
export function initializeArena(user) {
  if (!user.arena) {
    user.arena = {
      elo: 100, // ELO inicial um pouco maior que zero
      attempts: ARENA_CONFIG.MAX_ATTEMPTS,
      lastBattleTime: 0,
      lastWeeklyReset: now(),
      pointsChest: 0,
      dailyWins: 0,
      history: [],
      opponents: generateOpponentList(100)
    };
  }
  checkWeeklyReset(user.arena);
}

/**
 * Verifica e aplica o reset semanal, redefinindo tentativas e a lista de oponentes.
 * @param {Object} arena - O objeto de estado da arena do usuário.
 * @returns {boolean} True se o reset ocorreu.
 */
function checkWeeklyReset(arena) {
  if (now() - arena.lastWeeklyReset >= ARENA_CONFIG.WEEKLY_RESET_MS) {
    arena.lastWeeklyReset = now();
    arena.attempts = ARENA_CONFIG.MAX_ATTEMPTS;
    arena.dailyWins = 0;
    arena.pointsChest = 0;
    // Regenera oponentes com base no ELO atual
    arena.opponents = generateOpponentList(arena.elo); 
    return true;
  }
  return false;
}

/* --------------------------
   GERAÇÃO DE DADOS
   -------------------------- */

/**
 * Gera uma lista de oponentes com ELO variado.
 * @param {number} baseElo - ELO base para a geração dos oponentes.
 * @returns {Array} Lista de oponentes.
 */
function generateOpponentList(baseElo) {
  const list = [];
  for (let i = 0; i < ARENA_CONFIG.OPPONENT_COUNT; i++) {
    const variance = Math.floor(baseElo * 0.2) + 50;
    // Offset aleatório, variando de -variance a +variance
    const offset = Math.floor(Math.random() * (variance * 2) - variance); 
    const targetElo = clamp(baseElo + offset, ARENA_CONFIG.ELO.MIN_ELO, 9999);
    
    // Assumido que generateOpponentForRank retorna { id, name, ... }
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

/**
 * Determina a liga do usuário com base no ELO.
 * @param {number} elo - ELO atual do usuário.
 * @returns {string} Nome da Liga.
 */
function getLeague(elo) {
  if (elo < 200) return "Bronze";
  if (elo < 500) return "Prata";
  if (elo < 900) return "Ouro";
  if (elo < 1300) return "Platina";
  if (elo < 1700) return "Diamante";
  return "Mítico";
}

/* --------------------------
   CORE: DESAFIO DE ARENA
   -------------------------- */

/**
 * Inicia um desafio de arena contra um oponente específico.
 * @param {Object} user - Objeto do usuário (atacante).
 * @param {number} index - Índice (base 1) do oponente na lista.
 * @returns {Promise<string>} Mensagem de resultado da batalha e log.
 */
export async function arenaChallenge(user, index) {
  initializeArena(user);
  const opponentIndex = index - 1;
  
  // 1. Validação de Pré-Batalha
  const opponent = validateChallenge(user, opponentIndex);

  // 2. Preparação das Entidades de Batalha
  const { playerObj, enemyObj } = prepareBattleEntities(user, opponent);

  // 3. Execução da Batalha (Simulação)
  const { win, logs } = executeBattle(playerObj, enemyObj);

  // 4. Processamento de Resultados, ELO e Recompensas
  const resultMsg = processBattleResult(user, opponent, win);

  // 5. Atualização de Cooldowns e Tentativas
  user.arena.lastBattleTime = now();
  opponent.lastBattle = now();
  user.arena.attempts--;
  
  return resultMsg + (logs.length ? `\n\n📜 **Log parcial (últimas 5 ações):**\n${logs}` : "");
}

/** Valida se o desafio é possível. */
function validateChallenge(user, index) {
  const arena = user.arena;
  assert(arena.attempts > 0, "Sem tentativas restantes. Volte amanhã ou aguarde o reset semanal.");
  
  const opponent = arena.opponents[index];
  assert(opponent, "Oponente inválido (índice fora do limite).");
  assert(!opponent.defeated, `Oponente '${opponent.name}' já foi derrotado.`);

  // Cooldown Global
  const globalCD = now() - arena.lastBattleTime;
  const globalRemaining = ARENA_CONFIG.ATTACK_COOLDOWN_MS - globalCD;
  assert(globalRemaining <= 0, 
    `Cooldown global: aguarde ${Math.ceil(globalRemaining / 1000)}s.`);

  // Cooldown por Oponente
  const opCD = now() - (opponent.lastBattle || 0);
  const opRemaining = ARENA_CONFIG.ATTACK_COOLDOWN_MS - opCD;
  assert(opRemaining <= 0, 
    `Cooldown contra ${opponent.name}: aguarde ${Math.ceil(opRemaining / 1000)}s.`);

  return opponent;
}

/** Prepara os objetos de entidade para o sistema de batalha. */
function prepareBattleEntities(user, opponent) {
  // Cria objeto do Jogador (apenas dados essenciais para batalha)
  const playerObj = { name: user.name, hp: user.hp || 100, deck: user.decks?.main || [], ...user };
  
  // Obtém dados completos do Oponente (assumido ser um objeto rico em dados)
  const rawEnemy = generateOpponentForRank(opponent.elo);
  const enemyObj = { name: rawEnemy.name, hp: rawEnemy.hp || 100, deck: rawEnemy.deck || [], ...rawEnemy };

  // Aplica lógica do CardController (resolução de templates, embaralhamento)
  const pack = CardController.prepareBattleCardPackages(playerObj, enemyObj);
  pack.applyToEntities();

  return { playerObj, enemyObj };
}

/** Executa a simulação de batalha. */
function executeBattle(player, enemy) {
  const state = battleSystem.initBattle(player, enemy, { auto: true, context: "arena" });
  const result = battleSystem.runBattle(state);
  
  // Extrai Logs (últimas 5 entradas para concisão)
  const logs = state.log
    .slice(-5)
    .map(l => `[T${l.turn}] ${l.actor}: ${l.action || l.note}`)
    .join("\n");

  return { win: result.winner === "player", logs };
}

/* --------------------------
   PROCESSAMENTO DE RESULTADOS
   -------------------------- */

/** Aplica mudanças de ELO, recompensas e logs de história. */
function processBattleResult(user, opponent, win) {
  const arena = user.arena;
  let msg = `⚔️ **${user.name} vs ${opponent.name}**\n`;

  if (win) {
    opponent.defeated = true;
    const rewards = calculateRewards(opponent.elo);
    applyRewards(user, rewards);
    
    // Atualização de ELO
    arena.elo += ARENA_CONFIG.ELO.WIN_GAIN;
    
    // Contadores de Vitória
    arena.dailyWins = Math.min(ARENA_CONFIG.REWARDS_BASE.DAILY_WIN_LIMIT, arena.dailyWins + 1);
    
    // Baú de Pontos (baseado no ELO do oponente)
    const pointsGain = Math.max(5, Math.floor(opponent.elo / 100));
    arena.pointsChest += pointsGain;
    
    msg += `🏆 **Vitória!** (+${pointsGain} pts Baú)\n+${rewards.gems}💎 +${rewards.gold}💰\n+${ARENA_CONFIG.ELO.WIN_GAIN} ELO`;
    
    // Bônus Diário
    if (arena.dailyWins === ARENA_CONFIG.REWARDS_BASE.DAILY_WIN_LIMIT) {
      addGems(user, ARENA_CONFIG.REWARDS_BASE.DAILY_GEM_BONUS);
      msg += `\n🎁 Bônus Diário de ${ARENA_CONFIG.REWARDS_BASE.DAILY_WIN_LIMIT} Vitórias: +${ARENA_CONFIG.REWARDS_BASE.DAILY_GEM_BONUS}💎`;
    }
    
    // Reset da Lista de Oponentes se todos forem derrotados
    if (arena.opponents.every(o => o.defeated)) {
      arena.opponents = generateOpponentList(arena.elo);
      msg += "\n🔄 Todos os oponentes derrotados! Nova lista gerada.";
    }
  } else {
    // Derrota
    arena.elo = clamp(arena.elo - ARENA_CONFIG.ELO.LOSS_DEDUCTION, ARENA_CONFIG.ELO.MIN_ELO, 9999);
    msg += `❌ **Derrota**\n-${ARENA_CONFIG.ELO.LOSS_DEDUCTION} ELO`;
  }

  logHistory(arena, opponent, win);
  return msg;
}

/** Calcula as recompensas com base no ELO do oponente (multiplicador). */
function calculateRewards(elo) {
  // Multiplicador simples: ELO 1000 = 2x base
  const multiplier = 1 + (elo / 1000); 
  return {
    gems: Math.floor(ARENA_CONFIG.REWARDS_BASE.GEM * multiplier),
    gold: Math.floor(ARENA_CONFIG.REWARDS_BASE.GOLD * multiplier),
    xp: Math.floor(ARENA_CONFIG.REWARDS_BASE.XP * multiplier)
  };
}

/** Aplica as recompensas à conta do usuário. */
function applyRewards(user, rewards) {
  addGems(user, rewards.gems);
  addGold(user, rewards.gold);
  addXP(user, rewards.xp);
}

/** Registra o resultado da batalha no histórico. */
function logHistory(arena, opponent, win) {
  arena.history.unshift({
    opponent: opponent.name,
    result: win ? "Vitória" : "Derrota",
    elo: arena.elo, // ELO do usuário após a batalha
    ts: now()
  });
  if (arena.history.length > ARENA_CONFIG.MAX_HISTORY) arena.history.pop();
}

/* --------------------------
   VISUALIZAÇÃO E RECOMPENSAS
   -------------------------- */

/**
 * Gera o status atual da arena para exibição.
 * @param {Object} user - Objeto do usuário.
 * @returns {string} Status formatado.
 */
export function arenaStatus(user) {
  initializeArena(user);
  const a = user.arena;
  const globalCD = ARENA_CONFIG.ATTACK_COOLDOWN_MS - (now() - a.lastBattleTime);
  
  const opsList = a.opponents.map((o, i) => {
    const opCD = ARENA_CONFIG.ATTACK_COOLDOWN_MS - (now() - (o.lastBattle || 0));
    let status = o.defeated ? "✅ Vencido" : (opCD > 0 ? `⏳ ${Math.ceil(opCD/1000)}s` : "⚔️ Lutar");
    if (o.defeated && o.lastBattle === 0) status = "✅ Vencido"; // Caso onde foi resetado

    return `${i + 1}. ${o.name} [${o.elo} ELO] — ${status}`;
  }).join("\n");

  return (
    `🏆 **Arena PvP** (${getLeague(a.elo)})\n` +
    `ELO: **${a.elo}** | Tentativas: **${a.attempts}/${ARENA_CONFIG.MAX_ATTEMPTS}**\n` +
    `Cooldown Global: ${globalCD > 0 ? `${Math.ceil(globalCD/1000)}s` : "Pronto!"}\n` +
    `Baú: **${a.pointsChest} pts** | Vitórias Diárias: **${a.dailyWins}/${ARENA_CONFIG.REWARDS_BASE.DAILY_WIN_LIMIT}**\n\n` +
    `**Oponentes Atuais:**\n${opsList}`
  );
}

/**
 * Abre o Baú de Pontos de Arena.
 * @param {Object} user - Objeto do usuário.
 * @returns {string} Mensagem de recompensa ou erro.
 */
export function arenaReward(user) {
  initializeArena(user);
  const a = user.arena;
  
  const requiredPoints = 50;
  if (a.pointsChest < requiredPoints) return `💼 Precisa de ${requiredPoints} pontos para abrir o Baú de Recompensas (você tem ${a.pointsChest}).`;
  
  const gems = Math.floor(a.pointsChest / 10);
  const gold = a.pointsChest * 5;
  
  addGems(user, gems);
  addGold(user, gold);
  a.pointsChest = 0;
  
  return `🎁 **Baú Aberto!**\nVocê ganhou: ${gems} 💎 e ${gold} 💰`;
}

/**
 * Gera a tabela de classificação (Leaderboard) simples.
 * @param {Array<Object>} users - Lista de todos os usuários.
 * @returns {string} Tabela de classificação formatada.
 */
export function arenaLeaderboard(users) {
  return users
    .filter(u => u.arena && u.arena.elo > ARENA_CONFIG.ELO.MIN_ELO)
    .sort((a, b) => b.arena.elo - a.arena.elo)
    .slice(0, 10)
    .map((u, i) => `${i+1}. ${u.name} — ${u.arena.elo} ELO (${getLeague(u.arena.elo)})`)
    .join("\n") || "Nenhum jogador classificado com ELO positivo.";
}