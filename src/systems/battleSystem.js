import { getCardTemplate } from "./cardSystem.js";
import { runEffectsTrigger, applyFactionModifiers } from "./effectSystem.js";
import { rng, chanceDecimal, setSeed } from "./rngSystem.js";
import { CardController } from "../controllers/cardController.js"; // Assumido ser um módulo existente

/* --------------------------
   CONFIGURAÇÃO & CONSTANTES
   -------------------------- */
const CONFIG = Object.freeze({
  MAX_TURNS: 60,
  MAX_HAND: 5,
  MAX_LOOPS: 500, // Limite de segurança para o loop principal
  CRIT_DEFAULT: 0.07,
  STANDARD_WEAKEN: 0.75, // Dano reduzido em 25%
  STANDARD_VULNERABLE: 1.25, // Dano aumentado em 25%
  CRIT_MULTIPLIER: 1.5,
});

/**
 * Função de logging centralizada.
 * @param {Object} state - Objeto de estado da batalha.
 * @param {Object} entry - Dados do log a serem adicionados.
 */
const LOG = (state, entry) => { 
  entry.turn = state.turn; 
  state.log.push(entry); 
};

/**
 * Retorna o lado oposto ao atacante atual.
 * @param {'player'|'enemy'} side - O lado do atacante.
 * @param {Object} state - O estado da batalha.
 * @returns {Object} A entidade alvo.
 */
const OPPONENT = (side, state) => (side === "player" ? state.enemy : state.player);

/* --------------------------
   INICIALIZAÇÃO DA BATALHA
   -------------------------- */

/**
 * Prepara e inicializa o estado completo da batalha.
 * @param {Object} user - Dados do jogador.
 * @param {Object} enemy - Dados do inimigo.
 * @param {Object} options - Opções de batalha (e.g., auto-play).
 * @returns {Object} O estado inicializado da batalha.
 */
export function initBattle(user, enemy, options = {}) {
  // Configura a semente RNG
  const initialSeed = Date.now();
  setSeed(initialSeed);

  // Cria cópias profundas para evitar modificar objetos de dados mestres
  const rawUser = JSON.parse(JSON.stringify(user || {}));
  const rawEnemy = JSON.parse(JSON.stringify(enemy || {}));

  const state = buildBaseState(rawUser, rawEnemy, options, initialSeed);

  try {
    // Integração com sistema externo de cartas/habilidades
    const pkg = CardController.prepareBattleCardPackages(state.player, state.enemy);
    pkg.applyToEntities();
  } catch (err) {
    LOG(state, { actor: "SYS", note: `Falha na preparação dos Decks: ${err.message}` });
  }

  // Configura recursos de entidade (Guardiões, Vantagens/Perks)
  initializeEntityFeatures(state.player, "player");
  initializeEntityFeatures(state.enemy, "enemy");
  
  return state;
}

/** Cria o estado base da batalha. */
function buildBaseState(user, enemy, options, seed) {
  return {
    turn: 1,
    attacker: "player", // Começa com o jogador
    winner: null,
    log: [],
    player: createEntity(user, "player"),
    enemy: createEntity(enemy, "enemy"),
    summons: [], // Gerenciamento de invocações (summons)
    options: { auto: !!options.auto, mapStage: options.mapStage || null },
    _meta: { timestamp: Date.now(), seed: seed } 
  };
}

/** Cria uma entidade de batalha a partir dos dados brutos. */
function createEntity(data, role) {
  const maxHp = data.maxHp ?? data.hp ?? 100;
  return {
    ...data,
    id: data.id || role,
    name: data.name || role,
    hp: maxHp,
    maxHp: maxHp,
    block: 0,
    deck: [...(data.deck || [])], // As cartas no deck devem ser templates ou objetos resolvidos
    hand: [],
    discard: [],
    guardian: null,
    guardianId: data.guardianId || data.guardian,
    status: {}, // Efeitos de Status (e.g., strength, poison)
    energy: data.energy ?? 0,
    stats: { cardsPlayed: 0, hitsTaken: 0, critChance: CONFIG.CRIT_DEFAULT }
  };
}

/** Configura Guardiões e Vantagens. */
function initializeEntityFeatures(entity, role) {
  if (entity.guardianId) {
    const template = getCardTemplate(entity.guardianId) || entity.guardian;
    if (template) entity.guardian = createGuardianState(template, role);
  }
  // Aplica Vantagens (Perks)
  if (typeof entity.applyPerks === "function") {
    // Assumimos que esta função modifica a entidade (e.g., aumenta HP)
    entity.applyPerks(entity);
  }
}

/** Cria o estado do Guardião. */
function createGuardianState(tpl, owner) {
  return {
    id: tpl.id,
    name: tpl.name || "Guardian",
    owner,
    rage: 0,
    rageMax: tpl.rageMax || 100,
    active: tpl.active, // Habilidade ativa (pode ser um trigger)
    ultimate: tpl.ultimate, // Habilidade Ultimate
    summons: []
  };
}

/* --------------------------
   LOOP PRINCIPAL DE BATALHA
   -------------------------- */

/**
 * Executa a simulação completa da batalha até que haja um vencedor ou empate.
 * @param {Object} state - O estado inicial da batalha.
 * @returns {{state: Object, winner: 'player'|'enemy'|'draw'}} Resultado da batalha.
 */
export function runBattle(state) {
  let loopCount = 0;
  
  while (!state.winner && state.turn <= CONFIG.MAX_TURNS) {
    if (++loopCount > CONFIG.MAX_LOOPS) {
      LOG(state, { actor: "SYS", note: "Limite de loop excedido. Forçando empate." });
      break;
    }

    const actor = state[state.attacker];
    const target = OPPONENT(state.attacker, state);

    // 1. Início do Turno
    processTurnStart(state, actor, target);
    
    // 2. Ação Principal (Jogar Cartas)
    processTurnAction(state, actor, target);
    
    // 3. Fim do Turno
    processTurnEnd(state, actor, target);

    // Verifica condição de vitória/derrota
    checkWinCondition(state);
    
    // Prepara para o próximo turno
    if (!state.winner) {
      state.attacker = state.attacker === "player" ? "enemy" : "player";
      state.turn++;
    }
  }
  
  state.winner = state.winner || "draw";
  LOG(state, { actor: "SYS", action: "end", winner: state.winner });
  return { state, winner: state.winner };
}

function checkWinCondition(state) {
  if (state.player.hp <= 0) state.winner = "enemy";
  else if (state.enemy.hp <= 0) state.winner = "player";
}

/* --------------------------
   FASES DO TURNO
   -------------------------- */

function processTurnStart(state, actor, target) {
  LOG(state, { actor: actor.name, action: "turn_start" });
  
  // 1. Efeitos de Status (Regen, etc.)
  handleStatusStart(actor, state);
  
  // 2. Comprar Carta
  drawCard(actor, state);

  // 3. Triggers de Início de Turno
  runEffectsTrigger("onTurnStart", actor, target, {}, (m) => 
    LOG(state, { actor: actor.name, note: m })
  );

  // 4. Triggers do Guardião
  if (actor.guardian) {
    runEffectsTrigger("guardianStartTurn", actor.guardian, actor, { opponent: target }, 
      (m) => LOG(state, { actor: `G:${actor.guardian.name}`, note: m })
    );
  }
}

function processTurnAction(state, actor, target) {
  const isAI = state.attacker === "enemy" || (state.attacker === "player" && state.options.auto);
  
  // Ações de invocação (Summons)
  state.summons.filter(s => s.owner === actor.id).forEach(s => {
    // Simplesmente causa dano ao alvo
    const dmg = 5; // Exemplo
    target.hp -= dmg;
    LOG(state, { actor: s.name, action: "attack_summon", value: dmg });
  });

  // O loop de batalha síncrono assume que o AI/Auto-Play joga todas as cartas possíveis.
  while (actor.hand.length > 0 && actor.hp > 0 && target.hp > 0) {
    let cardToPlay = null;

    if (isAI) {
      cardToPlay = selectAICard(actor, target);
    } else {
      // No modo síncrono manual (não-AI), pegamos a primeira carta para simular uma jogada.
      // Em um jogo real, esta função não seria chamada para o player.
      cardToPlay = actor.hand[0]; 
    }

    if (cardToPlay) {
      playCardInternal(state, state.attacker, cardToPlay);
    } else {
      break; // Não há mais cartas úteis (AI) ou a mão está vazia.
    }
  }
}

function processTurnEnd(state, actor, target) {
  // 1. Efeitos de Status (Dano por veneno, etc.)
  handleStatusEnd(actor, state);
  
  // 2. Triggers de Fim de Turno
  runEffectsTrigger("onTurnEnd", actor, target, {}, (m) => 
    LOG(state, { actor: actor.name, note: m })
  );
  
  // 3. Limpeza de invocações (Summons) expirados
  state.summons = state.summons.filter(s => s.hp > 0 && --s.ttl > 0);

  // 4. Limpa estatísticas de turno
  actor.stats.cardsPlayed = 0;
  actor.stats.hitsTaken = 0;
}

/* --------------------------
   EXECUÇÃO DE CARTAS
   -------------------------- */

// Ponto de entrada público para jogada manual (em loop assíncrono ou teste)
export function playCard(state, side, cardId) {
  const actor = state[side];
  const cardTemplate = resolveCardObject(cardId);
  if (!cardTemplate) throw new Error(`❌ Template de carta ${cardId} não encontrado.`);

  const handIdx = actor.hand.findIndex(c => c.id === cardId);
  if (handIdx === -1) throw new Error(`❌ Carta ${cardId} não está na mão.`);
  
  const card = actor.hand[handIdx]; // Referência para o objeto na mão
  playCardInternal(state, side, card);
}

/** Executa os efeitos de uma carta e gerencia o estado. */
function playCardInternal(state, side, card) {
  const actor = state[side];
  const target = OPPONENT(side, state);

  // Remove da mão e move para o descarte
  const handIdx = actor.hand.findIndex(c => c.uniqueId === card.uniqueId); // Se houver uniqueId
  if (handIdx > -1) {
    const playedCard = actor.hand.splice(handIdx, 1)[0];
    
    // Pre-Trigger (Antes de causar efeitos)
    runEffectsTrigger("beforeCard", actor, target, { card: playedCard }, (m) => LOG(state, { note: m }));

    // Resolve Efeitos
    resolveCardEffects(state, actor, target, playedCard);

    // Post-Trigger & Cleanup
    runEffectsTrigger("afterCard", actor, target, { card: playedCard }, (m) => LOG(state, { note: m }));
    actor.stats.cardsPlayed++;
    actor.discard.push(playedCard); // Adiciona ao descarte
    
    checkGuardianReaction(state, actor, target, playedCard);
  } else {
    // Se a carta não foi encontrada na mão (pode acontecer no modo auto-play/AI)
    LOG(state, { actor: actor.name, action: "error", note: `Tentativa de jogar carta não existente: ${card.id}` });
  }
}

function resolveCardEffects(state, actor, target, card) {
  // ATACAR
  if (card.type === "attack") {
    const hits = card.hits || 1;
    let totalDmg = 0;
    for (let i = 0; i < hits; i++) {
      const dmg = applyDamage(state, actor, target, card);
      totalDmg += dmg;
      if (target.hp <= 0) break; // Parar se o alvo morrer
    }
    LOG(state, { actor: actor.name, action: "attack", card: card.id, value: totalDmg });
  }
  
  // BLOQUEAR
  if (card.type === "defense") {
    const val = calculateBlock(actor, card);
    actor.block += val;
    LOG(state, { actor: actor.name, action: "block", value: val });
  }

  // CURAR
  if (card.type === "heal") {
    const healAmount = card.value || 0;
    const val = Math.min(healAmount, actor.maxHp - actor.hp);
    actor.hp += val;
    LOG(state, { actor: actor.name, action: "heal", value: val });
  }

  // STATUS
  if (card.apply) {
    card.apply.forEach(eff => applyStatusEffect(state, actor, target, eff));
  }
}

/* --------------------------
   DANO E CÁLCULOS
   -------------------------- */

/** Calcula o dano bruto, aplica modificadores de status e facção, e lida com bloqueio. */
function applyDamage(state, attacker, defender, card) {
  let dmg = calculateRawDamage(attacker, defender, card);
  
  // 1. Mitigação por Bloqueio
  if (defender.block > 0) {
    const blocked = Math.min(defender.block, dmg);
    defender.block -= blocked;
    dmg -= blocked;
  }
  
  dmg = Math.max(0, dmg); // Dano mínimo 0

  // 2. Aplica Dano
  defender.hp -= dmg;
  defender.stats.hitsTaken++;

  // 3. Lógica de Espinhos (Thorns)
  if (hasStatus(defender, "thorns") && dmg > 0) {
    const thorns = getStatusValue(defender, "thorns");
    attacker.hp -= thorns;
    LOG(state, { actor: defender.name, action: "thorns", value: thorns, target: attacker.name });
  }

  // 4. Triggers de Dano
  const ctx = { card, damage: dmg };
  runEffectsTrigger("onHit", attacker, defender, ctx, () => {});
  runEffectsTrigger("onDamageTaken", defender, attacker, ctx, () => {});

  return dmg;
}

/** Calcula o dano bruto base, incluindo buffs/debuffs e crítico. */
function calculateRawDamage(attacker, defender, card) {
  let dmg = card.value ?? card.atk ?? 0;
  
  // Modificadores de Status
  dmg += getStatusValue(attacker, "strength"); // Força
  if (hasStatus(attacker, "weaken")) dmg *= CONFIG.STANDARD_WEAKEN; 
  if (hasStatus(defender, "vulnerable")) dmg *= CONFIG.STANDARD_VULNERABLE;
  
  // Crítico
  let isCrit = false;
  if (chanceDecimal(attacker.stats.critChance)) {
    dmg = Math.floor(dmg * CONFIG.CRIT_MULTIPLIER);
    isCrit = true;
  }
  
  // Modificadores de Facção (External System)
  const fRes = applyFactionModifiers(attacker, defender, Math.max(0, Math.floor(dmg)));
  dmg = fRes.damage;

  // Log de Crit/Fração
  if (isCrit) LOG(state, { actor: attacker.name, action: "crit", damage: dmg });
  if (fRes.modifier !== 1) LOG(state, { actor: attacker.name, action: "faction_mod", mod: fRes.modifier });

  return Math.max(0, Math.floor(dmg));
}

function calculateBlock(actor, card) {
  let val = card.value || card.block || 0;
  if (hasStatus(actor, "frail")) val *= CONFIG.STANDARD_WEAKEN; // Fraco: 25% menos bloqueio
  return Math.floor(val);
}

/* --------------------------
   SISTEMA DE STATUS
   -------------------------- */

function applyStatusEffect(state, actor, target, effect) {
  const dest = effect.target === "self" ? actor : target;
  const name = effect.name;
  
  dest.status[name] = dest.status[name] || { value: 0, turns: 0, stacks: 0, type: effect.type || "debuff" };
  
  const st = dest.status[name];
  st.value = (st.value || 0) + (effect.value || 0); // Acumula valor
  st.turns = Math.max(st.turns, effect.turns || 1); // Mantém a maior duração
  st.stacks = Math.min((st.stacks || 0) + 1, effect.maxStacks || 99);
  
  LOG(state, { actor: actor.name, action: "apply", status: name, target: dest.name, value: st.value });
}

function handleStatusStart(entity, state) {
  if (hasStatus(entity, "regen")) {
    const val = getStatusValue(entity, "regen");
    entity.hp = Math.min(entity.maxHp, entity.hp + val);
    LOG(state, { actor: entity.name, action: "regen", value: val });
  }
}

function handleStatusEnd(entity, state) {
  // Efeitos DoT (Damage over Time)
  const dots = ["poison", "burn", "bleed"]; 
  dots.forEach(type => {
    if (hasStatus(entity, type)) {
      const val = getStatusValue(entity, type);
      entity.hp -= val;
      LOG(state, { actor: entity.name, action: type, damage: val });
    }
  });

  // Decremento de Duração
  for (const k in entity.status) {
    const st = entity.status[k];
    if (--st.turns <= 0) {
      delete entity.status[k];
      LOG(state, { actor: entity.name, action: "status_expire", status: k });
    }
  }
}

function hasStatus(e, n) { return !!e.status[n]; }
function getStatusValue(e, n) { return e.status[n]?.value || 0; }

/* --------------------------
   GUARDIÃO E UTILS
   -------------------------- */

function checkGuardianReaction(state, actor, target, card) {
  if (!actor.guardian) return;
  
  const g = actor.guardian;
  const rageGain = card.grantsGuardianRage || 0;
  
  if (rageGain > 0) {
      g.rage = Math.min(g.rageMax, g.rage + rageGain);
      LOG(state, { actor: g.name, action: "rage_gain", value: rageGain });

      if (g.rage >= g.rageMax) {
          g.rage = 0;
          LOG(state, { actor: g.name, action: "ULTIMATE" });
          runEffectsTrigger("guardianUltimate", g, actor, { opponent: target }, () => {});
          
          // Exemplo de Invocação (Summon)
          if (g.ultimate?.summon) {
            const s = { 
                id: `sum_${Date.now()}_${g.ultimate.summon.name}`, 
                name: g.ultimate.summon.name, 
                hp: g.ultimate.summon.hp || 10, 
                ttl: g.ultimate.summon.ttl || 3, 
                owner: actor.id 
            };
            state.summons.push(s);
            LOG(state, { actor: g.name, action: "summon", name: s.name });
          }
      }
  }
}

/** Comprar uma carta aleatória do deck. */
export function drawCard(entity, state) {
  if (entity.hand.length >= CONFIG.MAX_HAND) return;
  
  // Embaralha o descarte para formar um novo deck
  if (!entity.deck.length) {
    entity.deck = [...entity.discard];
    entity.discard = [];
    LOG(state, { actor: entity.name, action: "deck_shuffle" });
  }
  
  if (entity.deck.length) {
    const i = rng(0, entity.deck.length - 1);
    const [card] = entity.deck.splice(i, 1);
    entity.hand.push(card);
    LOG(state, { actor: entity.name, action: "draw", card: card.id });
  }
}

/** Obtém o template de carta, garantindo que seja um objeto. */
function resolveCardObject(template) {
  if (typeof template === "string") return getCardTemplate(template) || { id: template };
  // Retorna o template se já for um objeto (e.g., já foi resolvido do deck)
  return getCardTemplate(template.id) || template; 
}

/* --------------------------
   LÓGICA AI SIMPLIFICADA
   -------------------------- */

function selectAICard(actor, target) {
  if (!actor.hand.length) return null;
  
  const dangerThreshold = actor.maxHp * 0.3;
  const killThreshold = target.maxHp * 0.3;
  const danger = actor.hp < dangerThreshold;
  const killChance = target.hp < killThreshold;

  // Pontuação simples: Prioriza sobrevivência e finalização
  const scored = actor.hand.map(c => {
    const tpl = resolveCardObject(c);
    let score = (tpl.value || tpl.atk || 0);
    
    // Prioridades
    if (tpl.type === "defense" && danger) score += 500;
    if (tpl.type === "attack" && killChance) score += 400;
    if (tpl.type === "heal" && danger) score += 600;
    
    // Cartas de status são menos previsíveis, damos um boost modesto
    if (tpl.apply) score += 100;

    return { card: c, score };
  });

  scored.sort((a, b) => b.score - a.score);
  
  // Se a carta de maior pontuação for defensiva e o HP estiver bom, talvez não jogar
  if (scored[0].score < 100 && !danger) return null; // Não jogar cartas "fracas" se não estiver em perigo

  return scored[0].card;
}

/* --------------------------
   EXPORTS
   -------------------------- */

export const battleSystem = { initBattle, runBattle, drawCard, playCard };