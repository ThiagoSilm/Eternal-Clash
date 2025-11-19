import { getCardTemplate } from "./cardSystem.js";
import { runEffectsTrigger, applyFactionModifiers } from "./effectSystem.js";
import { rng, chanceDecimal, setSeed } from "./rngSystem.js";
import { CardController } from "./CardController.js";

/* --------------------------
   CONFIG & CONSTANTS
   -------------------------- */
const BATTLE_CONFIG = Object.freeze({
  MAX_TURNS: 60,
  MAX_HAND: 5,
  MAX_LOOPS: 500,
  CRIT_DEFAULT: 0.07
});

const LOG = (state, entry) => { 
  entry.turn = state.turn; 
  state.log.push(entry); 
};

const OPPONENT = (side, state) => (side === "player" ? state.enemy : state.player);

/* --------------------------
   INITIALIZATION
   -------------------------- */

export function initBattle(user, enemy, options = {}) {
  setSeed(Date.now());
  const rawUser = JSON.parse(JSON.stringify(user || {}));
  const rawEnemy = JSON.parse(JSON.stringify(enemy || {}));

  const state = buildBaseState(rawUser, rawEnemy, options);

  try {
    // Integração blindada com CardController
    const pkg = CardController.prepareBattleCardPackages(state.player, state.enemy);
    pkg.applyToEntities();
  } catch (err) {
    LOG(state, { actor: "SYS", note: `Deck prep failed: ${err.message}` });
  }

  initializeEntityFeatures(state.player, "player");
  initializeEntityFeatures(state.enemy, "enemy");
  
  return state;
}

function buildBaseState(user, enemy, options) {
  return {
    turn: 1,
    attacker: "player",
    winner: null,
    log: [],
    player: createEntity(user, "player"),
    enemy: createEntity(enemy, "enemy"),
    summons: [],
    options: { auto: !!options.auto, mapStage: options.mapStage || null },
    // Snapshot para auditoria se necessário
    _meta: { timestamp: Date.now(), seed: Date.now() } 
  };
}

function createEntity(data, role) {
  return {
    ...data,
    id: data.id || role,
    name: data.name || role,
    hp: data.maxHp ?? data.hp ?? 100,
    maxHp: data.maxHp ?? data.hp ?? 100,
    block: 0,
    deck: [...(data.deck || [])],
    hand: [],
    discard: [],
    guardian: null, // Inicializado depois
    guardianId: data.guardianId || data.guardian,
    status: {},
    energy: data.energy ?? 0,
    stats: { cardsPlayed: 0, hitsTaken: 0, critChance: BATTLE_CONFIG.CRIT_DEFAULT }
  };
}

function initializeEntityFeatures(entity, role) {
  // Setup Guardian
  if (entity.guardianId) {
    const template = getCardTemplate(entity.guardianId) || entity.guardian;
    if (template) entity.guardian = createGuardianState(template, role);
  }
  // Apply Perks
  if (typeof entity.applyPerks === "function") {
    entity.applyPerks(entity);
  }
}

function createGuardianState(tpl, owner) {
  return {
    id: tpl.id,
    name: tpl.name || "Guardian",
    owner,
    rage: 0,
    rageMax: tpl.rageMax || 100,
    active: tpl.active,
    ultimate: tpl.ultimate,
    summons: []
  };
}

/* --------------------------
   CORE: BATTLE LOOP
   -------------------------- */

export function runBattle(state) {
  let loopCount = 0;
  
  while (!state.winner && state.turn <= BATTLE_CONFIG.MAX_TURNS) {
    if (++loopCount > BATTLE_CONFIG.MAX_LOOPS) break;

    const actor = state[state.attacker];
    const target = OPPONENT(state.attacker, state);

    processTurnStart(state, actor, target);
    processTurnAction(state, actor, target);
    processTurnEnd(state, actor, target);

    checkWinCondition(state);
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
   TURN PHASES
   -------------------------- */

function processTurnStart(state, actor, target) {
  // 1. Status Effects (Regen, etc)
  handleStatusStart(actor, state);
  
  // 2. Draw Card
  drawCard(actor, state);

  // 3. Triggers
  runEffectsTrigger("onTurnStart", actor, target, {}, (m) => 
    LOG(state, { actor: actor.name, note: m })
  );

  if (actor.guardian) {
    runEffectsTrigger("guardianStartTurn", actor.guardian, actor, { opponent: target }, 
      (m) => LOG(state, { actor: `G:${actor.guardian.name}`, note: m })
    );
  }
}

function processTurnAction(state, actor, target) {
  const isAI = state.attacker === "enemy" || (state.attacker === "player" && state.options.auto);
  const playable = [...actor.hand]; // Snapshot da mão

  // Limite de jogadas por turno pode ser implementado aqui se necessário
  while (playable.length > 0 && actor.hp > 0 && target.hp > 0) {
    let card = null;

    if (isAI) {
      card = selectAICard(actor, target);
      if (!card) break; // AI decidiu parar ou não tem cartas úteis
    } else {
      // Modo manual: em runBattle síncrono, assume-se que a AI joga tudo ou 
      // que a função runBattle é apenas para simulação/AI vs AI.
      // Para player real, usa-se playCard externamente.
      card = playable[0]; 
    }

    if (card) {
      playCardInternal(state, state.attacker, card);
      // Remove da lista local para não repetir no loop
      const idx = playable.findIndex(c => c.id === card.id);
      if (idx > -1) playable.splice(idx, 1);
    } else {
      break;
    }
  }
}

function processTurnEnd(state, actor, target) {
  handleStatusEnd(actor, state);
  
  runEffectsTrigger("onTurnEnd", actor, target, {}, (m) => 
    LOG(state, { actor: actor.name, note: m })
  );
  
  // Cleanup summons expirados
  state.summons = state.summons.filter(s => s.hp > 0 && --s.ttl > 0);
}

/* --------------------------
   CARD EXECUTION
   -------------------------- */

// Ponto de entrada público para jogada manual
export function playCard(state, side, cardId) {
  const actor = state[side];
  const idx = actor.hand.findIndex(c => c.id === cardId);
  if (idx === -1) return;
  
  const card = actor.hand[idx]; // Ref
  playCardInternal(state, side, card);
}

function playCardInternal(state, side, cardTemplate) {
  const actor = state[side];
  const target = OPPONENT(side, state);
  const card = resolveCardObject(cardTemplate);
  
  // Remove from hand
  const handIdx = actor.hand.findIndex(c => c.id === card.id);
  if (handIdx > -1) actor.hand.splice(handIdx, 1);

  // Pre-Trigger
  runEffectsTrigger("beforeCard", actor, target, { card }, (m) => LOG(state, { note: m }));

  // Resolve Effects
  resolveCardEffects(state, actor, target, card);

  // Post-Trigger & Cleanup
  runEffectsTrigger("afterCard", actor, target, { card }, (m) => LOG(state, { note: m }));
  actor.stats.cardsPlayed++;
  actor.discard.push(card);
  
  checkGuardianReaction(state, actor, target, card);
}

function resolveCardEffects(state, actor, target, card) {
  // Attack
  if (card.type === "attack") {
    const hits = card.hits || 1;
    let totalDmg = 0;
    for (let i = 0; i < hits; i++) {
      const dmg = applyDamage(state, actor, target, card);
      totalDmg += dmg;
    }
    LOG(state, { actor: actor.name, action: "attack", card: card.id, value: totalDmg });
  }
  
  // Block
  if (card.type === "defense") {
    const val = calculateBlock(actor, card);
    actor.block += val;
    LOG(state, { actor: actor.name, action: "block", value: val });
  }

  // Heal
  if (card.type === "heal") {
    const val = Math.min(card.value || 0, actor.maxHp - actor.hp);
    actor.hp += val;
    LOG(state, { actor: actor.name, action: "heal", value: val });
  }

  // Status
  if (card.apply) {
    card.apply.forEach(eff => applyStatusEffect(state, actor, target, eff));
  }
}

/* --------------------------
   DAMAGE & MATH
   -------------------------- */

function applyDamage(state, attacker, defender, card) {
  let dmg = calculateRawDamage(attacker, defender, card);
  
  // Block Mitigation
  if (defender.block > 0) {
    const blocked = Math.min(defender.block, dmg);
    defender.block -= blocked;
    dmg -= blocked;
  }

  defender.hp -= dmg;
  defender.stats.hitsTaken++;

  // Thorns Logic
  if (hasStatus(defender, "thorns")) {
    const thorns = getStatusValue(defender, "thorns");
    attacker.hp -= thorns;
    LOG(state, { actor: defender.name, action: "thorns", value: thorns });
  }

  // Triggers
  const ctx = { card, damage: dmg };
  runEffectsTrigger("onHit", attacker, defender, ctx, () => {});
  runEffectsTrigger("onDamageTaken", defender, attacker, ctx, () => {});

  return dmg;
}

function calculateRawDamage(attacker, defender, card) {
  let dmg = card.value ?? card.atk ?? 0;
  
  // Buffs/Debuffs
  dmg += getStatusValue(attacker, "strength");
  if (hasStatus(attacker, "weaken")) dmg *= 0.75; // Standard 25% weak
  if (hasStatus(defender, "vulnerable")) dmg *= 1.25; // Standard 25% vuln
  
  // Crit
  if (chanceDecimal(attacker.stats.critChance)) dmg = Math.floor(dmg * 1.5);
  
  // Faction Modifiers
  const fRes = applyFactionModifiers(attacker, defender, Math.max(0, Math.floor(dmg)));
  return Math.max(0, Math.floor(fRes.damage));
}

function calculateBlock(actor, card) {
  let val = card.value || card.block || 0;
  if (hasStatus(actor, "frail")) val *= 0.75;
  return Math.floor(val);
}

/* --------------------------
   STATUS SYSTEM
   -------------------------- */

function applyStatusEffect(state, actor, target, effect) {
  const dest = effect.target === "self" ? actor : target;
  const name = effect.name;
  
  if (!dest.status[name]) {
    dest.status[name] = { value: 0, turns: 0, stacks: 0, type: effect.type || "debuff" };
  }
  
  const st = dest.status[name];
  st.value += (effect.value || 0);
  st.turns = Math.max(st.turns, effect.turns || 1);
  st.stacks = Math.min((st.stacks || 0) + 1, effect.maxStacks || 99);
  
  LOG(state, { actor: actor.name, action: "apply", status: name, target: dest.name });
}

function handleStatusStart(entity, state) {
  if (hasStatus(entity, "regen")) {
    const val = getStatusValue(entity, "regen");
    entity.hp = Math.min(entity.maxHp, entity.hp + val);
    LOG(state, { actor: entity.name, action: "regen", value: val });
  }
}

function handleStatusEnd(entity, state) {
  // DoT Effects
  const dots = ["poison", "burn", "bleed"]; // Expansível
  dots.forEach(type => {
    if (hasStatus(entity, type)) {
      const val = getStatusValue(entity, type); // Simplificado: valor direto
      entity.hp -= val;
      LOG(state, { actor: entity.name, action: type, value: val });
    }
  });

  // Decrement & Cleanup
  for (const k in entity.status) {
    const st = entity.status[k];
    if (--st.turns <= 0) delete entity.status[k];
  }
  
  // Reset turn stats
  entity.stats.cardsPlayed = 0;
  entity.stats.hitsTaken = 0;
}

function hasStatus(e, n) { return !!e.status[n]; }
function getStatusValue(e, n) { return e.status[n]?.value || 0; }

/* --------------------------
   GUARDIAN & UTILS
   -------------------------- */

function checkGuardianReaction(state, actor, target, card) {
  if (!actor.guardian) return;
  
  const g = actor.guardian;
  g.rage = Math.min(g.rageMax, g.rage + (card.grantsGuardianRage || 0));

  if (g.rage >= g.rageMax) {
    g.rage = 0;
    LOG(state, { actor: g.name, action: "ULTIMATE" });
    runEffectsTrigger("guardianUltimate", g, actor, { opponent: target }, () => {});
    
    // Exemplo de summon via ult
    if (g.ultimate?.summon) {
      const s = { id: `sum_${Date.now()}`, name: g.ultimate.summon.name, hp: 10, ttl: 3, owner: actor.id };
      state.summons.push(s);
    }
  }
}

export function drawCard(entity, state) {
  if (entity.hand.length >= BATTLE_CONFIG.MAX_HAND) return;
  
  if (!entity.deck.length) {
    entity.deck = [...entity.discard];
    entity.discard = [];
  }
  
  if (entity.deck.length) {
    const i = rng(0, entity.deck.length - 1);
    const card = entity.deck.splice(i, 1)[0];
    entity.hand.push(card);
    LOG(state, { actor: entity.name, action: "draw", card: card.id });
  }
}

function resolveCardObject(template) {
  if (typeof template === "string") return getCardTemplate(template) || { id: template };
  return getCardTemplate(template.id) || template;
}

/* --------------------------
   AI LOGIC
   -------------------------- */

function selectAICard(actor, target) {
  if (!actor.hand.length) return null;
  
  const danger = actor.hp < (actor.maxHp * 0.3);
  const killChance = target.hp < (target.maxHp * 0.3);

  // Sistema de pontuação simples
  const scored = actor.hand.map(c => {
    let score = (c.value || c.atk || 0);
    if (c.type === "defense" && danger) score += 50;
    if (c.type === "attack" && killChance) score += 50;
    if (c.type === "heal" && danger) score += 100;
    return { c, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0].c;
}

// Export único e limpo
export const battleSystem = { initBattle, runBattle, drawCard, playCard };
