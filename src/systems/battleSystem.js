// src/systems/battleSystem.js
// BattleSystem integrado com novo effectSystem (facções, applyFactionModifiers, runEffectsTrigger)
// Compatível com cardSystem e effectSystem fornecidos

import { getCardTemplate } from "./cardSystem.js";
import { runEffectsTrigger, applyFactionModifiers } from "./effectSystem.js";
import { getGuardian } from "./guardianSystem.js";
import { rng, chance } from "./rngSystem.js";

// ------------------ CONFIGS ------------------
const MAX_TURNS = 60;
const BASE_DRAW = 1;
const MAX_HAND = 5;

// ------------------ HELPERS ------------------
const opposite = (side, state) => (side === "player" ? state.enemy : state.player);
const pushLog = (state, entry) => { entry.turn = state.turn; state.log.push(entry); };

// ------------------ INIT / ENTITIES ------------------
export function initBattle(user, enemy, options = {}) {
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

  // apply perks/passives from cardSystem if present (backwards compat)
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
    energy: template.startEnergy || 0,
    energyMax: template.energyMax || 100,
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
  return { id: `summon_${Math.floor(Math.random()*1e9)}`, owner: ownerRole, name: template.name || "Minion", hp: template.hp || 10, atk: template.atk || 3, ttl: template.turns || 3 };
}
function cleanupSummons(state) { state.summons = state.summons.filter(s => s.hp > 0 && s.ttl > 0); }

// ------------------ DECK / DRAW ------------------
function refillDeckIfEmpty(entity) { if (!entity.deck || entity.deck.length === 0) { entity.deck = [...(entity.discard || [])]; entity.discard = []; } }
function drawCard(entity, state) {
  if (entity.hand.length >= MAX_HAND) return null;
  refillDeckIfEmpty(entity);
  if (!entity.deck || entity.deck.length === 0) return null;
  const i = rng(0, entity.deck.length - 1);
  const card = entity.deck.splice(i, 1)[0];
  entity.hand.push(card);
  runEffectsTrigger("onCardDraw", entity, null, { card }, (m)=>pushLog(state, { actor: entity.name, note: m }));
  pushLog(state, { actor: entity.name, action: "draw", card: card.id });
  return card;
}

// ------------------ STATUS ADVANCED API ------------------
function getStatus(entity, name) { return entity.status && entity.status[name] ? entity.status[name] : null; }
function hasStatus(entity, name) { return !!getStatus(entity, name); }
function getStatusValue(entity, name) { const s = getStatus(entity, name); return s ? s.value : 0; }

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
function removeStatusAdvanced(entity, name) { if (entity.status && entity.status[name]) delete entity.status[name]; }

function tickStatusStartAdvanced(entity, target, state) {
  if (hasStatus(entity, "regen")) {
    const amt = Math.max(0, Math.floor(getStatusValue(entity, "regen")));
    entity.hp = Math.min(entity.maxHp, entity.hp + amt);
    pushLog(state, { actor: entity.name, action: "regen_start", heal: amt });
  }
  entity.meta = entity.meta || {};
  entity.meta.armorMultiplier = hasStatus(entity, "armorUp") ? 1 + (getStatusValue(entity, "armorUp") || 0) : 1;
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
    st.turns = (typeof st.turns === "number") ? st.turns - 1 : st.turns;
    if (st.turns <= 0) removeStatusAdvanced(entity, k);
  }
  entity.cardsPlayed = 0;
  entity.hitsTaken = 0;
  if (entity.meta) {
    entity.meta.armorMultiplier = 1;
    entity.meta.multiplierTaken = 1;
  }
}

// ------------------ DAMAGE PIPELINE INTEGRATION ------------------
function calculateDamage(attacker, defender, card) {
  let dmg = (card && (card.value ?? card.attack ?? card.atk)) ? (card.value ?? card.attack ?? card.atk) : 0;
  // strength flat
  if (hasStatus(attacker, "strength")) dmg += Math.floor(getStatusValue(attacker, "strength"));
  // weaken percent on attacker
  if (hasStatus(attacker, "weaken")) dmg *= 1 - (getStatusValue(attacker, "weaken") / 100);
  // vulnerable increases taken
  const vuln = hasStatus(defender, "vulnerable") ? getStatusValue(defender, "vulnerable") : 0;
  if (vuln) dmg *= 1 + (vuln / 100);
  // critical
  if (chance(attacker.critChance || 0.07)) dmg = Math.floor(dmg * 1.5);
  // apply block with frail interaction
  const frailFactor = hasStatus(defender, "frail") ? (1 - getStatusValue(defender, "frail") / 100) : 1;
  const effectiveBlock = (defender.block || 0) * frailFactor;
  if (effectiveBlock > 0) {
    const absorbed = Math.min(effectiveBlock, dmg);
    defender.block -= absorbed;
    dmg -= absorbed;
  }
  // apply faction modifiers (new)
  const factionResult = applyFactionModifiers(attacker, defender, Math.max(0, Math.floor(dmg)));
  dmg = factionResult.damage;
  if (factionResult.reasons && factionResult.reasons.length) {
    pushLogGlobal(`faction_mods: ${factionResult.reasons.join(", ")}`);
  }
  dmg = Math.max(0, Math.floor(dmg));
  return dmg;
}

// small helper to use state.log push when runEffectsTrigger wants pushLog callback
function pushLogGlobal(msg) { /* placeholder, real pushes done in callers with state */ }

// ------------------ EXECUTE CARD (integra status avançado + effects) ------------------
function executeCardEffect(state, side, card) {
  const actor = state[side];
  const target = opposite(side, state);

  // prepare pushLog callback for effects
  const effectLogger = (m) => pushLog(state, { actor: actor.name, note: m });

  runEffectsTrigger("beforeCard", actor, target, { card }, effectLogger);

  if (card.type === "attack") {
    const hits = card.hits || 1;
    let totalDmg = 0;
    for (let i = 0; i < hits; i++) {
      const dmg = calculateDamage(actor, target, card);
      target.hp -= dmg;
      totalDmg += dmg;
      actor.cardsPlayed = (actor.cardsPlayed || 0) + 1;
      target.hitsTaken = (target.hitsTaken || 0) + 1;

      runEffectsTrigger("onHit", actor, target, { card, damage: dmg }, effectLogger);
      runEffectsTrigger("onDamageTaken", target, actor, { card, damage: dmg }, effectLogger);

      if (hasStatus(target, "thorns")) {
        const th = Math.floor(getStatusValue(target, "thorns"));
        actor.hp -= th;
        pushLog(state, { actor: actor.name, action: "thorns", dmg: th });
      }

      if (Array.isArray(state.summons)) {
        // passive interactions from summons can be processed here if needed
      }
    }
    pushLog(state, { actor: actor.name, action: "attack", card: card.id, dmg: totalDmg, hp: { player: state.player.hp, enemy: state.enemy.hp } });
  }

  if (card.type === "defense") {
    let val = card.value || card.block || 0;
    const armorMult = actor.meta && actor.meta.armorMultiplier ? actor.meta.armorMultiplier : 1;
    const frail = getStatusValue(actor, "frail") || 0;
    val = Math.max(0, Math.floor((val * armorMult) - frail));
    actor.block = (actor.block || 0) + val;
    pushLog(state, { actor: actor.name, action: "block", block: val });
  }

  if (card.type === "heal") {
    const healBase = card.value || card.heal || 0;
    const healAmt = Math.min(healBase, actor.maxHp - actor.hp);
    actor.hp += healAmt;
    pushLog(state, { actor: actor.name, action: "heal", heal: healAmt });
  }

  // apply statuses via advanced API
  if (Array.isArray(card.apply)) {
    for (const a of card.apply) {
      const dest = (a.target === "self") ? actor : target;
      applyStatusAdvanced(dest, a.name, { value: a.value ?? 1, turns: a.turns ?? 1, maxStacks: a.maxStacks || null, stacking: a.stacking || "add", type: a.type || "debuff", source: actor.name, meta: a.meta || {} });
      pushLog(state, { actor: actor.name, action: "applyStatus", status: a.name, value: a.value || 1, turns: a.turns || 1, target: dest.name });
      runEffectsTrigger("onApplyStatus", dest, actor, { sourceCard: card }, (m)=>pushLog(state, { actor: actor.name, note: m }));
    }
  }

  runEffectsTrigger("afterCard", actor, target, { card }, effectLogger);
  actor.discard.push(card);

  // guardian synergy
  if (actor.guardian) {
    runEffectsTrigger("guardianOnOwnerCard", actor.guardian, actor, { card }, (m)=>pushLog(state, { actor: `guardian:${actor.guardian.name}`, note: m }));
    if (actor.guardian.energy !== undefined) actor.guardian.energy = Math.min(actor.guardian.energyMax || 100, (actor.guardian.energy || 0) + (card.grantsGuardianEnergy || 0));
  }
}

// ------------------ PLAY CARD ------------------
function playCard(state, side, cardId) {
  const actor = state[side];
  const idx = actor.hand.findIndex(c => c.id === cardId);
  if (idx === -1) return;
  const cardTemplate = actor.hand[idx];
  const card = getCardTemplate(cardTemplate) || cardTemplate; // support both template ids and full templates
  actor.hand.splice(idx, 1);
  executeCardEffect(state, side, card);
}

// ------------------ AI ------------------
function determineEnemyArchetype(enemy) {
  if (!enemy.deck) return "balanced";
  let atk = 0, def = 0, util = 0;
  enemy.deck.forEach(c => {
    const card = getCardTemplate(c) || c;
    if (!card) return;
    if (card.type === "attack") atk++;
    if (card.type === "defense") def++;
    if (card.type === "heal" || card.type === "debuff" || card.type === "apply") util++;
  });
  if (atk > def && atk > util) return "aggressive";
  if (def > atk && def > util) return "defensive";
  if (util > atk && util > def) return "controller";
  return "balanced";
}
function evaluateCardScore(state, enemy, player, card) {
  let score = 0;
  if (card.type === "attack") score += (card.value || card.attack || 0) * 2;
  if (card.type === "defense") score += (card.value || card.block || 0) * 1.5;
  if (card.type === "heal") score += (card.value || card.heal || 0) * 1.2;
  const potentialDmg = card.type === "attack" ? calculateDamage(enemy, player, card) : 0;
  if (potentialDmg >= player.hp) score += 9999;
  if (enemy.hp < enemy.maxHp * 0.25) {
    if (card.type === "defense") score += 30;
    if (card.type === "heal") score += 35;
  }
  if (hasStatus(player, "vulnerable") && card.type === "attack") score += 10;
  const type = determineEnemyArchetype(enemy);
  if (type === "aggressive" && card.type === "attack") score += 5;
  if (type === "defensive" && card.type === "defense") score += 5;
  if (type === "controller" && card.type === "debuff") score += 5;
  score += Math.random() * 0.1;
  return score;
}
function chooseBestAICard(state, enemy, player) {
  if (!enemy.hand || enemy.hand.length === 0) return null;
  let best = null, bestScore = -Infinity;
  for (const c of enemy.hand) {
    const card = getCardTemplate(c) || c;
    if (!card) continue;
    const sc = evaluateCardScore(state, enemy, player, card);
    if (sc > bestScore) { bestScore = sc; best = card; }
  }
  return best;
}

// ------------------ GUARDIAN ------------------
function guardianStartTurn(guardian, ownerEntity, opponentEntity, state) {
  if (!guardian) return;
  runEffectsTrigger("guardianStartTurn", guardian, ownerEntity, { opponent: opponentEntity }, (m)=>pushLog(state, { actor: `guardian:${guardian.name}`, note: m }));
  if (guardian.ultimate) guardian.ultimateCharge = Math.min(guardian.energyMax, (guardian.ultimateCharge || 0) + (guardian.ultimate.chargePerTurn || 10));
}
function guardianTryActivate(guardian, ownerEntity, opponentEntity, state, forced = false) {
  if (!guardian || !guardian.active) return false;
  if (guardian.cooldown > 0 && !forced) return false;
  const cost = guardian.active.cost || 0;
  if (guardian.energy < cost && !forced) return false;
  guardian.energy = Math.max(0, guardian.energy - cost);
  guardian.cooldown = guardian.active.cooldown || 1;
  runEffectsTrigger("guardianActivate", guardian, ownerEntity, { opponent: opponentEntity }, (m)=>pushLog(state, { actor: `guardian:${guardian.name}`, note: m }));
  pushLog(state, { actor: `guardian:${guardian.name}`, action: "activate", owner: ownerEntity.name });
  if (guardian.active && guardian.active.summon) {
    const s = createSummon(guardian.active.summon, ownerEntity.name);
    state.summons.push(s);
    guardian.summons.push(s.id);
    pushLog(state, { actor: guardian.name, action: "summon", summon: s.name, owner: ownerEntity.name });
  }
  return true;
}
function guardianTryUltimate(guardian, ownerEntity, opponentEntity, state) {
  if (!guardian || !guardian.ultimate) return false;
  const charge = guardian.ultimateCharge || 0;
  const cost = guardian.ultimate.cost || guardian.energyMax;
  if (charge < cost) return false;
  guardian.ultimateCharge = 0;
  runEffectsTrigger("guardianUltimate", guardian, ownerEntity, { opponent: opponentEntity }, (m)=>pushLog(state, { actor: `guardian:${guardian.name}`, note: m }));
  pushLog(state, { actor: `guardian:${guardian.name}`, action: "ultimate", owner: ownerEntity.name });
  if (guardian.ultimate && guardian.ultimate.summon) {
    const s = createSummon(guardian.ultimate.summon, ownerEntity.name);
    state.summons.push(s);
    guardian.summons.push(s.id);
  }
  return true;
}
function guardianEndTurn(guardian, state) {
  if (!guardian) return;
  if (guardian.cooldown > 0) guardian.cooldown = Math.max(0, guardian.cooldown - 1);
  if (guardian.summons && guardian.summons.length) {
    for (const id of [...guardian.summons]) {
      const sm = state.summons.find(x => x.id === id);
      if (!sm) continue;
      sm.ttl -= 1;
      if (sm.ttl <= 0 || sm.hp <= 0) guardian.summons = guardian.summons.filter(x => x !== id);
    }
  }
}

// ------------------ TOWER GEM EFFECTS ------------------
export function applyTowerGems(entity, state) {
  if (!entity.tempGems || entity.tempGems.length === 0) return;
  for (const gem of entity.tempGems) {
    switch (gem.toLowerCase()) {
      case "fúria":
        applyStatusAdvanced(entity, "strength", { value: 5, turns: 1, stacking: "add", source: "Tower Gem: Fúria" });
        pushLog(state, { actor: entity.name, action: "gem_buff", gem, note: "+5 Strength" });
        break;
      case "proteção":
        applyStatusAdvanced(entity, "armorUp", { value: 0.25, turns: 1, stacking: "add", source: "Tower Gem: Proteção" });
        pushLog(state, { actor: entity.name, action: "gem_buff", gem, note: "+25% Armor" });
        break;
      case "velocidade":
        applyStatusAdvanced(entity, "haste", { value: 1, turns: 1, stacking: "add", source: "Tower Gem: Velocidade" });
        pushLog(state, { actor: entity.name, action: "gem_buff", gem, note: "Extra Draw / Action" });
        break;
      case "crítico":
        applyStatusAdvanced(entity, "critBuff", { value: 0.15, turns: 1, stacking: "add", source: "Tower Gem: Crítico" });
        pushLog(state, { actor: entity.name, action: "gem_buff", gem, note: "+15% Crit Chance" });
        break;
      default:
        pushLog(state, { actor: entity.name, action: "gem_buff", gem, note: "Gema não reconhecida" });
    }
  }
}

// ------------------ INTEGRAR NO TURN ------------------
function runTurn(state) {
  const side = state.attacker;
  const actor = state[side];
  const target = opposite(side, state);
  
  const logger = (m) => pushLog(state, { actor: actor.name, note: m });
  
  runEffectsTrigger("startTurn", actor, target, {}, logger);
  
  // 1️⃣ Aplicar efeitos de status no início
  tickStatusStartAdvanced(actor, target, state);
  
  // 2️⃣ Aplicar GEMAS TOWER
  if (actor.tempGems && actor.tempGems.length) applyTowerGems(actor, state);
  
  // 3️⃣ Guardian start
  if (actor.guardian) guardianStartTurn(actor.guardian, actor, target, state);
  
  // 4️⃣ Verifica stun
  if (hasStatus(actor, "stun") || actor.stunned) {
    pushLog(state, { actor: actor.name, action: "stunned_skip" });
    runEffectsTrigger("endTurn", actor, target, {}, logger);
    if (actor.guardian) guardianEndTurn(actor.guardian, state);
    tickStatusEndAdvanced(actor, target, state);
    cleanupSummons(state);
    state.turn++;
    state.attacker = side === "player" ? "enemy" : "player";
    return;
  }
  
  // 5️⃣ Draw cards
  if (!hasStatus(actor, "freeze")) {
    for (let i = 0; i < BASE_DRAW; i++) drawCard(actor, state);
  } else removeStatusAdvanced(actor, "freeze");
  
  // 6️⃣ Guardian actions
  if (actor.guardian) {
    guardianTryUltimate(actor.guardian, actor, target, state);
    if (side === "enemy" || state.options.auto) guardianTryActivate(actor.guardian, actor, target, state, false);
  }
  
  // 7️⃣ Escolha de ação
  if (side === "enemy" || state.options.auto) {
    const best = chooseBestAICard(state, actor, target);
    if (best) playCard(state, side, best.id);
  } else {
    if (actor.hand.length > 0) playCard(state, side, actor.hand[0].id);
  }
  
  // 8️⃣ Summons atacam
  for (const s of state.summons.filter(x => x.owner === actor.name)) {
    if (s.hp > 0) {
      target.hp -= s.atk;
      pushLog(state, { actor: s.name, action: "summon_attack", dmg: s.atk, target: target.name });
      runEffectsTrigger("onSummonHit", s, target, { summon: s }, logger);
    }
  }
  
  // 9️⃣ End turn effects
  runEffectsTrigger("endTurn", actor, target, {}, logger);
  tickStatusEndAdvanced(actor, target, state);
  if (actor.guardian) guardianEndTurn(actor.guardian, state);
  
  cleanupSummons(state);
  if (actor.hp <= 0) runEffectsTrigger("death", actor, target, {}, logger);
  if (target.hp <= 0) runEffectsTrigger("death", target, actor, {}, logger);
  runEffectsTrigger("afterTurn", actor, target, {}, logger);
  
  state.turn++;
  state.attacker = side === "player" ? "enemy" : "player";
}

// ------------------ END CHECK & RUN BATTLE ------------------
function isBattleEnded(state) {
  if (state.player.hp <= 0) return "enemy";
  if (state.enemy.hp <= 0) return "player";
  if (state.turn > MAX_TURNS) return "timeout";
  return null;
}

export function runBattle(user, enemy, options = {}) {
  const state = initBattle(user, enemy, options);
  state.log = [];
  const logger = (m) => pushLog(state, { actor: "system", note: m });

  runEffectsTrigger("battleStart", state.player, state.enemy, {}, logger);
  runEffectsTrigger("battleStart", state.enemy, state.player, {}, logger);

  while (true) {
    runTurn(state);
    const result = isBattleEnded(state);
    if (result) return finalizeBattle(state, result);
  }
}

// ------------------ FINALIZE ------------------
function finalizeBattle(state, winner) {
  const rewards = {};
  const stage = state.options.mapStage;
  if (winner === "player") {
    const level = stage ? stage.chapter : 1;
    rewards.xp = 15 + level * 5;
    rewards.gold = 10 + level * 3;
    if (chance(0.12)) rewards.shards = rng(1, 3);
  }
  pushLog(state, { actor: "system", action: "end", winner, rewards });
  return { state, winner, rewards };
}