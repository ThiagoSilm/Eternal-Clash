// src/systems/battleSystem.js
import { getCardTemplate } from "./cardSystem.js";
import { runEffectsTrigger, applyFactionModifiers } from "./effectSystem.js";
import { getGuardian } from "./guardianSystem.js";
import { rng, chanceDecimal, weightedChoice, setSeed } from "./rngSystem.js";

// ------------------ CONFIGS ------------------
const MAX_TURNS = 60;
const MAX_HAND = 5;
const MAX_BATTLE_LOOPS = 500;

// ------------------ HELPERS ------------------
const opposite = (side, state) => (side === "player" ? state.enemy : state.player);
const pushLog = (state, entry) => { entry.turn = state.turn; state.log.push(entry); };

// ------------------ ENTITIES ------------------
export function initBattle(user, enemy, options = {}) {
  setSeed(Date.now()); // define seed para RNG

  const state = {
    turn: 1,
    attacker: "player",
    log: [],
    player: createEntity(user, "player"),
    enemy: createEntity(enemy, "enemy"),
    summons: [],
    options: { auto: !!options.auto, mapStage: options.mapStage || null },
    hooks: { beforeTurn: [], afterTurn: [], beforeCard: [], afterCard: [], battleStart: [], death: [] }
  };

  if (state.player.guardian) state.player.guardian = createGuardian(state.player.guardian, "player");
  if (state.enemy.guardian) state.enemy.guardian = createGuardian(state.enemy.guardian, "enemy");

  if (typeof state.player.applyPerks === "function") state.player.applyPerks(state.player);
  if (typeof state.enemy.applyPerks === "function") state.enemy.applyPerks(state.enemy);

  return state;
}

function createEntity(data, role) {
  return {
    ...data,
    name: data.name || role,
    hp: data.maxHp ?? data.hp ?? 100,
    maxHp: data.maxHp ?? data.hp ?? 100,
    block: data.block ?? 0,
    deck: [...(data.deck || [])],
    hand: [],
    discard: [],
    guardian: getGuardian(data.guardianId) || data.guardian || null,
    status: data.status || {},
    critChance: data.critChance ?? 0.07,
    energy: data.energy ?? 0,
    cardsPlayed: 0,
    hitsTaken: 0,
    meta: {},
  };
}

function createGuardian(template, ownerRole) {
  if (!template) return null;
  return {
    id: template.id,
    name: template.name || "Guardian",
    owner: ownerRole,
    level: template.level || 1,
    hp: template.maxHp || 0,
    maxHp: template.maxHp || 0,
    rage: 0, // substitui energia, aumenta quando sofre dano ou cartas morrem
    rageMax: template.rageMax || 100,
    passive: template.passive || [],
    active: template.active || null,
    ultimate: template.ultimate || null,
    cooldown: 0,
    ultimateCharge: 0,
    summons: [],
    effects: template.effects || []
  };
}

// ------------------ SUMMONS ------------------
function createSummon(template, ownerRole) {
  return {
    id: `summon_${rng(0, 1e9)}`,
    owner: ownerRole,
    name: template.name || "Minion",
    hp: template.hp || 10,
    atk: template.atk || 3,
    ttl: template.turns || 3
  };
}

function cleanupSummons(state) {
  state.summons = state.summons.filter(s => s.hp > 0 && s.ttl > 0);
}

// ------------------ DECK / DRAW ------------------
function refillDeckIfEmpty(entity) {
  if (!entity.deck || entity.deck.length === 0) {
    entity.deck = [...(entity.discard || [])];
    entity.discard = [];
  }
}

function drawCard(entity, state) {
  if (entity.hand.length >= MAX_HAND) return null;
  refillDeckIfEmpty(entity);
  if (!entity.deck || entity.deck.length === 0) return null;

  const i = rng(0, entity.deck.length - 1);
  const card = entity.deck.splice(i, 1)[0];
  entity.hand.push(card);

  runEffectsTrigger("onCardDraw", entity, null, { card }, (m) => pushLog(state, { actor: entity.name, note: m }));
  pushLog(state, { actor: entity.name, action: "draw", card: card.id });
  return card;
}

// ------------------ STATUS ------------------
function getStatus(entity, name) { return entity.status?.[name] || null; }
function hasStatus(entity, name) { return !!getStatus(entity, name); }
function getStatusValue(entity, name) { return entity.status?.[name]?.value || 0; }

function applyStatusAdvanced(entity, name, options = {}) {
  const { value = 1, turns = 1, maxStacks = null, stacking = "add", type = "debuff", source = null, meta = {} } = options;
  if (!entity.status) entity.status = {};
  const ex = entity.status[name];
  if (!ex) { entity.status[name] = { value, turns, stacks: 1, type, source, meta }; return entity.status[name]; }
  if (stacking === "add") ex.value += value;
  if (stacking === "refresh") ex.turns = Math.max(ex.turns, turns);
  ex.stacks = Math.min((ex.stacks || 1) + 1, maxStacks || Infinity);
  ex.turns = Math.max(ex.turns, turns);
  ex.meta = { ...ex.meta, ...meta };
  return ex;
}

function removeStatusAdvanced(entity, name) { if (entity.status?.[name]) delete entity.status[name]; }

function tickStatusStartAdvanced(entity, target, state) {
  if (hasStatus(entity, "regen")) {
    const amt = Math.max(0, Math.floor(getStatusValue(entity, "regen")));
    entity.hp = Math.min(entity.maxHp, entity.hp + amt);
    pushLog(state, { actor: entity.name, action: "regen_start", heal: amt });
  }
  entity.meta = entity.meta || {};
  entity.meta.armorMultiplier = hasStatus(entity, "armorUp") ? 1 + getStatusValue(entity, "armorUp") : 1;
}

function tickStatusEndAdvanced(entity, target, state) {
  if (hasStatus(entity, "poison")) {
    const dmg = Math.max(0, Math.floor(getStatusValue(entity, "poison")));
    entity.hp -= dmg;
    pushLog(state, { actor: entity.name, action: "poison_end", dmg });
  }
  if (hasStatus(entity, "burn") && entity.cardsPlayed) {
    const burn = Math.floor(getStatusValue(entity, "burn") * entity.cardsPlayed);
    entity.hp -= burn;
    pushLog(state, { actor: entity.name, action: "burn_end", dmg: burn });
  }
  if (hasStatus(entity, "bleed") && entity.hitsTaken) {
    const bleed = Math.floor(getStatusValue(entity, "bleed") * entity.hitsTaken);
    entity.hp -= bleed;
    pushLog(state, { actor: entity.name, action: "bleed_end", dmg: bleed });
  }

  for (const k of Object.keys({ ...entity.status })) {
    const st = entity.status[k];
    if (!st) continue;
    st.turns = typeof st.turns === "number" ? st.turns - 1 : st.turns;
    if (st.turns <= 0) removeStatusAdvanced(entity, k);
  }

  entity.cardsPlayed = 0;
  entity.hitsTaken = 0;
  if (entity.meta) {
    entity.meta.armorMultiplier = 1;
    entity.meta.multiplierTaken = 1;
  }
}

// ------------------ DAMAGE ------------------
function calculateDamage(attacker, defender, card) {
  let dmg = card?.value ?? card?.attack ?? card?.atk ?? 0;
  if (hasStatus(attacker, "strength")) dmg += Math.floor(getStatusValue(attacker, "strength"));
  if (hasStatus(attacker, "weaken")) dmg *= 1 - (getStatusValue(attacker, "weaken") / 100);
  
  const vuln = hasStatus(defender, "vulnerable") ? getStatusValue(defender, "vulnerable") : 0;
  if (vuln) dmg *= 1 + (vuln / 100);
  
  if (chanceDecimal(attacker.critChance ?? 0.07)) dmg = Math.floor(dmg * 1.5);
  
  const frailFactor = hasStatus(defender, "frail") ? 1 - getStatusValue(defender, "frail") / 100 : 1;
  const effectiveBlock = (defender.block || 0) * frailFactor;
  
  if (effectiveBlock > 0) {
    const absorbed = Math.min(effectiveBlock, dmg);
    defender.block -= absorbed;
    dmg -= absorbed;
  }
  
  const factionResult = applyFactionModifiers(attacker, defender, Math.max(0, Math.floor(dmg)));
  dmg = factionResult.damage;
  
  return Math.max(0, Math.floor(dmg));
}

// ------------------ CARD EXECUTION ------------------
function executeCardEffect(state, side, card) {
  const actor = state[side];
  const target = opposite(side, state);
  const logEffect = (m) => pushLog(state, { actor: actor.name, note: m });
  
  // Triggers antes da carta
  runEffectsTrigger("beforeCard", actor, target, { card }, logEffect);
  
  // ATAQUE
  if (card.type === "attack") {
    let totalDmg = 0;
    for (let i = 0; i < (card.hits || 1); i++) {
      const dmg = calculateDamage(actor, target, card);
      target.hp -= dmg;
      totalDmg += dmg;
      actor.cardsPlayed++;
      target.hitsTaken++;
      
      runEffectsTrigger("onHit", actor, target, { card, damage: dmg }, logEffect);
      runEffectsTrigger("onDamageTaken", target, actor, { card, damage: dmg }, logEffect);
      
      // Thorns
      if (hasStatus(target, "thorns")) {
        const th = Math.floor(getStatusValue(target, "thorns"));
        actor.hp -= th;
        pushLog(state, { actor: actor.name, action: "thorns", dmg: th });
      }
      
      // Rage do guardião do alvo
      if (target.guardian) {
        target.guardian.rage = Math.min(target.guardian.rageMax, (target.guardian.rage || 0) + dmg);
      }
    }
    pushLog(state, { actor: actor.name, action: "attack", card: card.id, dmg: totalDmg });
  }
  
  // DEFESA
  if (card.type === "defense") {
    const armorMult = actor.meta?.armorMultiplier ?? 1;
    const frail = getStatusValue(actor, "frail") || 0;
    const val = Math.max(0, Math.floor((card.value || card.block || 0) * armorMult - frail));
    actor.block += val;
    pushLog(state, { actor: actor.name, action: "block", block: val });
  }
  
  // CURA
  if (card.type === "heal") {
    const healAmt = Math.min(card.value || card.heal || 0, actor.maxHp - actor.hp);
    actor.hp += healAmt;
    pushLog(state, { actor: actor.name, action: "heal", heal: healAmt });
  }
  
  // APLICAR STATUS
  if (Array.isArray(card.apply)) {
    for (const a of card.apply) {
      const dest = a.target === "self" ? actor : target;
      applyStatusAdvanced(dest, a.name, { value: a.value ?? 1, turns: a.turns ?? 1, maxStacks: a.maxStacks || null, stacking: a.stacking || "add", type: a.type || "debuff", source: actor.name, meta: a.meta || {} });
      pushLog(state, { actor: actor.name, action: "applyStatus", status: a.name, value: a.value || 1, turns: a.turns || 1, target: dest.name });
      runEffectsTrigger("onApplyStatus", dest, actor, { sourceCard: card }, (m) => pushLog(state, { actor: actor.name, note: m }));
    }
  }
  
  // Triggers após a carta
  runEffectsTrigger("afterCard", actor, target, { card }, logEffect);
  
  // Mover carta para discard
  actor.discard.push(card);
  
  // Guardião do jogador
  if (actor.guardian) {
    runEffectsTrigger("guardianOnOwnerCard", actor.guardian, actor, { card }, (m) => pushLog(state, { actor: `guardian:${actor.guardian.name}`, note: m }));
    actor.guardian.rage = Math.min(actor.guardian.rageMax, (actor.guardian.rage || 0) + (card.grantsGuardianRage || 0));
    
    // Tentativa de ativar ultimate com rage
    if ((actor.guardian.rage || 0) >= actor.guardian.rageMax) {
      pushLog(state, { actor: `guardian:${actor.guardian.name}`, action: "rage_ultimate" });
      actor.guardian.rage = 0;
      runEffectsTrigger("guardianUltimate", actor.guardian, actor, { opponent: target }, (m) => pushLog(state, { actor: `guardian:${actor.guardian.name}`, note: m }));
      
      if (actor.guardian.ultimate?.summon) {
        const s = createSummon(actor.guardian.ultimate.summon, actor.name);
        state.summons.push(s);
        actor.guardian.summons.push(s.id);
        pushLog(state, { actor: actor.guardian.name, action: "summon", summon: s.name, owner: actor.name });
      }
    }
  }
}

// ------------------ PLAY CARD ------------------
function playCard(state, side, cardId) {
  const actor = state[side];
  const idx = actor.hand.findIndex(c => c.id === cardId);
  if (idx === -1) return;
  const cardTemplate = actor.hand[idx];
  const card = getCardTemplate(cardTemplate) || cardTemplate;
  actor.hand.splice(idx, 1);
  executeCardEffect(state, side, card);
}

// ------------------ AI AVANÇADA ------------------
function chooseAutoCardAdvanced(actor, target, state) {
  if (!actor.hand?.length) return null;
  
  const lowHpSelf = actor.hp / actor.maxHp < 0.35;
  const lowHpTarget = target.hp / target.maxHp < 0.3;
  const highBlockTarget = target.block / target.maxHp > 0.25;
  const hasDebuff = actor.hand.some(c => c.apply?.some(a => a.type === "debuff"));
  
  let cardPriority = [];
  
  if (lowHpTarget) cardPriority.push(...actor.hand.filter(c => c.type === "attack"));
  if (lowHpSelf) cardPriority.push(...actor.hand.filter(c => c.type === "defense"));
  if (lowHpSelf) cardPriority.push(...actor.hand.filter(c => c.type === "heal"));
  if (hasDebuff) cardPriority.push(...actor.hand.filter(c => c.apply?.some(a => a.type === "debuff")));
  if (!cardPriority.length) cardPriority.push(...actor.hand.filter(c => c.type === "attack"));
  if (!cardPriority.length) cardPriority.push(actor.hand[0]);
  
  cardPriority.sort((a, b) => {
    const aScore = (a.value || a.atk || 0) + (a.apply?.reduce((s, x) => s + (x.value || 0), 0) || 0);
    const bScore = (b.value || b.atk || 0) + (b.apply?.reduce((s, x) => s + (x.value || 0), 0) || 0);
    return bScore - aScore;
  });
  
  return cardPriority[0];
}

// ------------------ BATTLE LOOP ------------------
export function runBattle(state) {
  let loop = 0;
  
  while (state.player.hp > 0 && state.enemy.hp > 0 && state.turn <= MAX_TURNS) {
    loop++;
    if (loop > MAX_BATTLE_LOOPS) {
      pushLog(state, { actor: "system", note: "loop limit reached" });
      break;
    }
    
    const actorSide = state.attacker;
    const actor = state[actorSide];
    const target = opposite(actorSide, state);
    
    // INÍCIO DO TURNO
    tickStatusStartAdvanced(actor, target, state);
    
    drawCard(actor, state);
    if (actor.guardian) runEffectsTrigger("guardianStartTurn", actor.guardian, actor, { opponent: target }, (m) => pushLog(state, { actor: `guardian:${actor.guardian.name}`, note: m }));
    
    runEffectsTrigger("onTurnStart", actor, target, {}, (m) => pushLog(state, { actor: actor.name, note: m }));
    
    // EXECUÇÃO DE CARTAS
    const playable = [...actor.hand];
    while (playable.length) {
      const card = actorSide === "enemy" ? chooseAutoCardAdvanced(actor, target, state) : playable.shift();
      if (!card) break;
      
      executeCardEffect(state, actorSide, card);
      playable.splice(playable.indexOf(card), 1);
    }
    
    // FIM DO TURNO
    tickStatusEndAdvanced(actor, target, state);
    runEffectsTrigger("onTurnEnd", actor, target, {}, (m) => pushLog(state, { actor: actor.name, note: m }));
    
    cleanupSummons(state);
    
    // Alterna turno
    state.attacker = actorSide === "player" ? "enemy" : "player";
    state.turn++;
  }
  
  const winner = state.player.hp > 0 ? "player" : state.enemy.hp > 0 ? "enemy" : "draw";
  pushLog(state, { actor: "system", action: "battle_end", winner });
  return { state, winner };
}

// ------------------ EXPORT ------------------
export const battleSystem = {
  initBattle,
  runBattle,
  drawCard,
  playCard,
};