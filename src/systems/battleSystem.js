// src/systems/battleSystem.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const EFFECTS_PATH = path.join(__dirname, "../data/effects.json");

// ---------- PRNG com seed (opcional) ----------
function createRng(seed) {
  if (seed == null) return { rand: () => Math.random() };
  let t = seed >>> 0;
  return {
    rand() {
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    }
  };
}

// ---------- Carrega effects.json (mantemos o JSON intacto) ----------
let EFFECTS = [];
try {
  EFFECTS = JSON.parse(fs.readFileSync(EFFECTS_PATH, "utf-8"));
} catch (e) {
  EFFECTS = [];
  // console.warn("effects.json not found or invalid:", e.message);
}
function getEffectById(id) { return EFFECTS.find(e => e.id === id); }

// ---------- Utils ----------
function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }
function sumHP(cards) { return (cards || []).reduce((s, c) => s + Math.max(0, c.hp || 0), 0); }
function pickFirstAlive(cards) { return (cards || []).find(c => (c.hp || 0) > 0) || null; }

// ---------- Execute single effect (supports condition, action, nextTurnEffect) ----------
function executeEffect(eff, subject, owner, opponent, context = null, pushLog = () => {}, rng = Math) {
  if (!eff) return null;
  try {
    // condition: JS expression string that returns boolean, context: owner, opponent, subject, context
    if (eff.condition) {
      const condFn = new Function('owner', 'opponent', 'subject', 'context', `return (${eff.condition});`);
      const ok = !!condFn(owner, opponent, subject, context);
      if (!ok) return null;
    }

    // action: JS snippet executed with (subject, target, owner, opponent, pushLog, rng)
    if (eff.action) {
      // create safe-ish wrapper function and call it
      const fn = new Function('subject', 'target', 'owner', 'opponent', 'pushLog', 'rng', eff.action);
      fn(subject, context, owner, opponent, pushLog, rng);
      pushLog(`✨ ${subject.name ?? subject.id} used effect: ${eff.name}`);
    }

    // nextTurnEffect: copy to owner.overTime or owner.pendingEffects
    if (eff.nextTurnEffect) {
      owner.overTime = owner.overTime || [];
      owner.overTime.push(deepClone(eff.nextTurnEffect));
      pushLog(`⏳ ${subject.name ?? subject.id} queued next-turn effect: ${eff.nextTurnEffect.name || eff.nextTurnEffect.id}`);
    }

    return true;
  } catch (err) {
    // don't throw — log and continue
    pushLog(`⚠️ Error executing effect ${eff.id}: ${err.message}`);
    return null;
  }
}

// ---------- Run all effects for a trigger (guardian first, then cards) ----------
function runEffectsTrigger(trigger, owner, opponent, context = null, pushLog = () => {}, rng = Math) {
  // guardian effects (if any)
  if (owner.guardian && owner.guardian.effects && owner.guardian.effects.length) {
    for (const eid of owner.guardian.effects) {
      const eff = getEffectById(eid);
      if (!eff || eff.type !== trigger) continue;
      // guardian subject is the guardian object
      executeEffect(eff, owner.guardian, owner, opponent, context, pushLog, rng);
    }
  }

  // cards
  for (const card of (owner.cards || []).filter(c => (c.hp || 0) > 0)) {
    if (card.silenced) continue;
    for (const eid of (card.effects || [])) {
      const eff = getEffectById(eid);
      if (!eff || eff.type !== trigger) continue;
      executeEffect(eff, card, owner, opponent, context, pushLog, rng);
    }
  }
}

// ---------- Damage calc respecting evade/shield/defense ----------
function computeDamage(attackerCard, defenderCard, rng) {
  // evade
  if (defenderCard.evadeChance && rng.rand() < (defenderCard.evadeChance || 0)) {
    defenderCard.lastDamage = 0;
    return { damage: 0, evaded: true };
  }

  const base = Math.round((attackerCard.attack || 100) * (0.75 + rng.rand() * 0.5));
  const reduced = Math.max(0, Math.round(base - (defenderCard.defense || 0) * 0.2));
  let remaining = reduced;

  if (defenderCard.shield && defenderCard.shield > 0) {
    const absorbed = Math.min(defenderCard.shield, remaining);
    defenderCard.shield -= absorbed;
    remaining -= absorbed;
  }

  defenderCard.lastDamage = remaining;
  return { damage: remaining, evaded: false };
}

// ---------- Process over-time effects list (burn/poison/etc) ----------
function processOverTimeFor(combatant, pushLog = () => {}) {
  if (!combatant.overTime || combatant.overTime.length === 0) return;
  const remaining = [];
  for (const eff of combatant.overTime) {
    if (eff.turns > 0) {
      const target = pickFirstAlive(combatant.cards);
      if (!target) continue;
      target.hp = Math.max(0, (target.hp || 0) - (eff.value || 0));
      pushLog(`🔥 ${target.name} took ${eff.value} ${eff.type} damage (${Math.max(0, target.hp)} HP left).`);
      // optionally increase guardian rage when allied cards take damage
      if (combatant.guardian) combatant.rage = (combatant.rage || 0) + (eff.value || 0);
      eff.turns -= 1;
    }
    if (eff.turns > 0) remaining.push(eff);
  }
  combatant.overTime = remaining;
  combatant.hp = sumHP(combatant.cards);
}

// ---------- Deaths + Phoenix handling ----------
function checkDeathsAndHandle(combatant, pushLog = () => {}) {
  // guardian death check is handled elsewhere (battle ends when guardian null)
  const died = [];
  for (const card of [...(combatant.cards || [])]) {
    if ((card.hp || 0) <= 0) {
      // check if card had a one-time onDeath revive (phoenix-like)
      const phoenixEffect = (card.effects || []).find(eid => {
        const ee = getEffectById(eid);
        return ee && ee.type === "onDeath" && ee.effect && (ee.effect.toLowerCase().includes("revive") || ee.id === "phoenixSoul");
      });
      if (phoenixEffect) {
        // revive once then remove the phoenix-like effect to avoid loops
        card.hp = card.maxHp || 200;
        card.effects = (card.effects || []).filter(eid => eid !== phoenixEffect);
        pushLog(`🔁 ${card.name} revived by Phoenix-like effect with full HP.`);
        continue;
      }
      died.push(card);
      combatant.graveyard = combatant.graveyard || [];
      combatant.graveyard.push(deepClone(card));
    }
  }

  if (died.length > 0) {
    combatant.cards = (combatant.cards || []).filter(c => (c.hp || 0) > 0);
    for (const d of died) pushLog(`⚰️ ${d.name} was sent to graveyard.`);
  }
  combatant.hp = sumHP(combatant.cards);
}

// ---------- Guardian special activation ----------
function tryActivateGuardianSpecial(combatant, opponent, pushLog = () => {}, rng = Math) {
  if (!combatant.guardian) return;
  combatant.rage = combatant.rage || 0;
  const rageMax = combatant.guardian.rageMax ?? combatant.rageMax ?? 100;
  if (combatant.rage < rageMax) return;

  // if guardian has a specialEffect id, execute it (special is just another effect id in JSON)
  const specialId = combatant.guardian.specialEffect ?? combatant.guardian.special ?? null;
  if (!specialId) {
    combatant.rage = 0; // still reset to avoid infinite loops
    pushLog(`⚡ ${combatant.guardian.name} rage filled but no specialEffect defined.`);
    return;
  }

  const eff = getEffectById(specialId);
  if (!eff) {
    combatant.rage = 0;
    pushLog(`⚠️ ${combatant.guardian.name} special effect id "${specialId}" not found.`);
    return;
  }

  pushLog(`💥 Guardian ${combatant.guardian.name} activated SPECIAL: ${eff.name}`);
  executeEffect(eff, combatant.guardian, combatant, opponent, null, pushLog, rng);
  combatant.rage = 0;
}

// ---------- Make combatant object from input ----------
function makeCombatantFromInput(input, role, rng) {
  const cards = (input.cards || []).map((c, idx) => ({
    uniqueId: c.uniqueId ?? `${role}_${idx}_${Math.floor((rng?.rand?.() ?? Math.random()) * 1e9)}`,
    id: c.id ?? c.name ?? `card_${idx}`,
    name: c.name ?? `Card ${idx}`,
    type: c.type ?? 'neutral',
    level: c.level ?? 1,
    maxHp: c.maxHp ?? c.hp ?? 200,
    hp: c.hp ?? c.maxHp ?? 200,
    attack: c.attack ?? c.power ?? 100,
    defense: c.defense ?? 0,
    effects: c.effects ?? [],
    shield: c.shield ?? 0,
    stunned: c.stunned ?? 0,
    silenced: c.silenced ?? false,
    evadeChance: c.evadeChance ?? 0,
    lastDamage: 0
  }));

  return {
    id: input.id ?? role,
    name: input.name ?? role,
    nameForLog: input.name ?? role,
    guardian: input.guardian ? deepClone(input.guardian) : null,
    cards,
    graveyard: deepClone(input.graveyard || []),
    overTime: deepClone(input.overTime || []),
    graveLock: input.graveLock ?? false,
    rage: input.rage ?? 0,
    rageMax: input.guardian?.rageMax ?? input.rageMax ?? 100,
    hp: sumHP(cards)
  };
}

// ---------- Single turn execution ----------
function executeSingleTurn(attacker, defender, pushLog, rng) {
  // Guardian special activation (auto) at start of the attacker's turn
  tryActivateGuardianSpecial(attacker, defender, pushLog, rng);

  // Guard/caster-level "onTurnStart"/"onAttackStart" triggers
  runEffectsTrigger("onTurnStart", attacker, defender, null, pushLog, rng);
  runEffectsTrigger("onAttackStart", attacker, defender, null, pushLog, rng);

  // find acting card (first alive, not stunned)
  const acting = attacker.cards.find(c => (c.hp || 0) > 0 && !(c.stunned > 0));
  if (!acting) {
    // reduce stunned counters
    for (const c of attacker.cards) if (c.stunned > 0) c.stunned = Math.max(0, c.stunned - 1);
    return;
  }

  // If acting card has pre-attack triggers that require target context, run them
  runEffectsTrigger("onAttackStart", attacker, defender, acting, pushLog, rng);

  // choose target
  const target = pickFirstAlive(defender.cards);
  if (!target) return;

  // compute damage, apply
  const { damage, evaded } = computeDamage(acting, target, rng);
  if (evaded) {
    pushLog(`💨 ${target.name} evaded ${acting.name}'s attack.`);
  } else {
    target.hp = Math.max(0, (target.hp || 0) - damage);
    pushLog(`💥 ${acting.name} dealt ${damage} to ${target.name} (${Math.max(0, target.hp)} HP).`);
    // increase defender guardian rage if present
    if (defender.guardian) defender.rage = (defender.rage || 0) + damage;
  }

  // onHit reactions (defender's cards + guardian)
  runEffectsTrigger("onHit", defender, attacker, target, pushLog, rng);

  // afterAttack / afterDefense
  runEffectsTrigger("afterAttack", attacker, defender, acting, pushLog, rng);
  runEffectsTrigger("afterDefense", defender, attacker, target, pushLog, rng);

  // process over-time for both sides (burn/poison/etc)
  processOverTimeFor(attacker, pushLog);
  processOverTimeFor(defender, pushLog);

  // check deaths (including phoenix-like one-time revive)
  checkDeathsAndHandle(attacker, pushLog);
  checkDeathsAndHandle(defender, pushLog);
}

// ---------- Main exported battleSystem ----------
/**
 * battleSystem(playerInput, opponentInput, options)
 * - playerInput/opponentInput: objects with cards[], guardian?, etc.
 * - options: { maxTurns, seed, autoMode, allowSkipAfterTurn }
 */
export function battleSystem(playerInput, opponentInput, options = {}) {
  const rng = createRng(options.seed ?? null);
  const maxTurns = options.maxTurns ?? 100;
  const allowSkipAfter = options.allowSkipAfterTurn ?? 20;
  const autoMode = options.autoMode ?? "off"; // "off" | "auto" | "skip"

  const A = makeCombatantFromInput(playerInput || {}, 'player', rng);
  const B = makeCombatantFromInput(opponentInput || {}, 'opponent', rng);

  const log = [];
  const pushLog = (l) => log.push(l);

  pushLog(`⚔️ Battle start: ${A.nameForLog} vs ${B.nameForLog}`);

  let turn = 1;
  let winner = "draw";

  while (turn <= maxTurns) {
    // quick win conditions: guardian death ends battle immediately (the side without guardian loses)
    if ((A.guardian && (A.guardian.hp || 0) <= 0) || (B.guardian && (B.guardian.hp || 0) <= 0)) {
      if (A.guardian && (A.guardian.hp || 0) <= 0 && B.guardian && (B.guardian.hp || 0) <= 0) {
        winner = "draw";
      } else if (A.guardian && (A.guardian.hp || 0) <= 0) {
        winner = "opponent";
      } else if (B.guardian && (B.guardian.hp || 0) <= 0) {
        winner = "player";
      }
      pushLog(`🏁 Guardian death instant result: ${winner}`);
      break;
    }

    // quick win: if one side has zero alive cards and no cards in hand (we only track field here), they lose
    const aAlive = (A.cards || []).some(c => (c.hp || 0) > 0);
    const bAlive = (B.cards || []).some(c => (c.hp || 0) > 0);
    if (!aAlive && !bAlive) {
      winner = "draw";
      break;
    }
    if (!aAlive && bAlive) { winner = "opponent"; break; }
    if (!bAlive && aAlive) { winner = "player"; break; }

    pushLog(`\n🕐 Turn ${turn}`);

    // decide attacker/defender by turn parity
    const attacker = (turn % 2 === 1) ? A : B;
    const defender = (turn % 2 === 1) ? B : A;

    // try guardian special at start of attacker's turn (auto)
    tryActivateGuardianSpecial(attacker, defender, pushLog, rng);

    // execute single turn from attacker -> defender
    executeSingleTurn(attacker, defender, pushLog, rng);

    // afterTurn triggers for both
    runEffectsTrigger("afterTurn", A, B, null, pushLog, rng);
    runEffectsTrigger("afterTurn", B, A, null, pushLog, rng);

    // update graveLock status automatically
    A.graveLock = (A.cards || []).some(c => (c.effects || []).some(eid => getEffectById(eid)?.effect === "graveLock"));
    B.graveLock = (B.cards || []).some(c => (c.effects || []).some(eid => getEffectById(eid)?.effect === "graveLock"));

    // re-evaluate alive cards/guardians for instant win
    const aAliveAfter = (A.cards || []).some(c => (c.hp || 0) > 0);
    const bAliveAfter = (B.cards || []).some(c => (c.hp || 0) > 0);
    if (!aAliveAfter && !bAliveAfter) { winner = "draw"; break; }
    if (!aAliveAfter && bAliveAfter) { winner = "opponent"; break; }
    if (!bAliveAfter && aAliveAfter) { winner = "player"; break; }

    turn++;
  }

  // final evaluation if not decided inside loop
  if (winner === "draw") {
    const playerHP = sumHP(A.cards || []);
    const opponentHP = sumHP(B.cards || []);
    if (playerHP > opponentHP) winner = "player";
    else if (opponentHP > playerHP) winner = "opponent";
    else {
      const pCount = (A.cards || []).filter(c => (c.hp || 0) > 0).length;
      const oCount = (B.cards || []).filter(c => (c.hp || 0) > 0).length;
      if (pCount > oCount) winner = "player";
      else if (oCount > pCount) winner = "opponent";
      else winner = "draw";
    }
  }

  const final = {
    player: { id: A.id, name: A.nameForLog, cards: A.cards, graveyard: A.graveyard, guardian: A.guardian, hp: sumHP(A.cards) },
    opponent: { id: B.id, name: B.nameForLog, cards: B.cards, graveyard: B.graveyard, guardian: B.guardian, hp: sumHP(B.cards) }
  };

  const rewards = (winner === "player") ? { xp: 1500, gold: 800 } : { xp: 100, gold: 50 };

  return {
    winner,
    turns: Math.min(turn, maxTurns),
    log,
    final,
    rewards
  };
}