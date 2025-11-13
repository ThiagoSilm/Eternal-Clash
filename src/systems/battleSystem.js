// src/systems/battleSystem.js (FINAL REVISADO)

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// IMPORTAÇÃO ESSENCIAL: Traz as funções de lógica de efeitos do EffectSystem
import { 
    getEffectById, 
    runEffectsTrigger,
    executeEffect 
} from "./effectSystem.js"; 

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- UTILS ---
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

function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }
function sumHP(cards) { return (cards || []).reduce((s, c) => s + Math.max(0, c.hp ?? 0), 0); }
function pickFirstAlive(cards) { return (cards || []).find(c => (c.hp ?? 0) > 0) || null; }
// -------------

/**
 * @description Aplica o cálculo de dano, chance de esquiva e absorção de escudo.
 * @description Adiciona ganho de rage APENAS para dano direto no defensor.
 */
function computeDamage(attackerCard, defenderCard, defenderCombatant, rng) {
  if (defenderCard.evadeChance && rng.rand() < (defenderCard.evadeChance ?? 0)) {
    defenderCard.lastDamage = 0;
    return { damage: 0, evaded: true };
  }

  const base = Math.round((attackerCard.attack ?? 100) * (0.75 + rng.rand() * 0.5));
  const reduced = Math.max(0, Math.round(base - (defenderCard.defense ?? 0) * 0.2));
  let remaining = reduced;

  if (defenderCard.shield && defenderCard.shield > 0) {
    const absorbed = Math.min(defenderCard.shield, remaining);
    defenderCard.shield -= absorbed;
    remaining -= absorbed;
  }

  defenderCard.lastDamage = remaining;
  
  // Lógica de Ganho de Rage (apenas dano direto)
  if (remaining > 0 && defenderCombatant.guardian) {
    defenderCombatant.rage = (defenderCombatant.rage ?? 0) + remaining;
  }

  return { damage: remaining, evaded: false };
}

/**
 * @description Processa danos contínuos (DOT).
 * @description REMOVIDA A LÓGICA DE GANHO DE RAGE.
 */
function processOverTimeFor(combatant, pushLog = () => {}) {
  if (!combatant.overTime || combatant.overTime.length === 0) return;
  const remaining = [];
  for (const eff of combatant.overTime) {
    if (eff.turns > 0) {
      const target = pickFirstAlive(combatant.cards);
      if (!target) continue;
      
      const damage = eff.value ?? 0;
      target.hp = Math.max(0, (target.hp ?? 0) - damage);
      pushLog(`🔥 ${target.name} took ${damage} ${eff.type ?? 'OT'} damage (${Math.max(0, target.hp)} HP left).`);
      
      eff.turns -= 1;
    }
    if (eff.turns > 0) remaining.push(eff);
  }
  combatant.overTime = remaining;
  combatant.hp = sumHP(combatant.cards);
}

/**
 * @description Checa por mortes e lida com efeitos "onDeath" de ressurreição.
 * @description Se um efeito onDeath for ativado e a carta for revivida, ela não é enviada ao cemitério.
 */
function checkDeathsAndHandle(combatant, pushLog = () => {}) {
  const died = [];
  // Usa [...(combatant.cards || [])] para iterar sobre uma cópia, pois o array pode ser modificado
  for (const card of [...(combatant.cards || [])]) { 
    if ((card.hp ?? 0) <= 0) {
      
      // 1. Checa por efeitos onDeath que podem reviver
      const phoenixEffect = (card.effects || []).find(eid => {
        const ee = getEffectById(eid);
        return ee && ee.type === "onDeath" && (ee.effect?.toLowerCase().includes("revive") || ee.id === "phoenixSoul");
      });
      
      // 2. Se houver, executa o efeito (que deve restaurar o HP da carta)
      if (phoenixEffect) {
        const eff = getEffectById(phoenixEffect.id);
        // O efeito é executado com a carta morta como 'subject'
        executeEffect(eff, card, combatant, null, null, pushLog); 
        
        // 3. Se o efeito restaurou o HP, a carta sobrevive
        if ((card.hp ?? 0) > 0) {
          pushLog(`🔁 ${card.name} revived by ${eff.name ?? eff.id} with ${card.hp} HP.`);
          continue; 
        }
      }
      
      // 4. Se não reviveu, morre e vai para o cemitério
      died.push(card);
      combatant.graveyard = combatant.graveyard || [];
      combatant.graveyard.push(deepClone(card)); // Adiciona uma cópia ao cemitério
    }
  }

  if (died.length > 0) {
    // Remove cartas mortas do array principal
    combatant.cards = (combatant.cards || []).filter(c => (c.hp ?? 0) > 0); 
    for (const d of died) pushLog(`⚰️ ${d.name} was sent to graveyard.`);
  }
  combatant.hp = sumHP(combatant.cards); // Atualiza o HP total do combatente
}

function tryActivateGuardianSpecial(combatant, opponent, pushLog = () => {}, rng = Math) {
  if (!combatant.guardian) return;
  combatant.rage = combatant.rage ?? 0;
  const rageMax = combatant.guardian.rageMax ?? combatant.rageMax ?? 100;
  if (combatant.rage < rageMax) return;

  const specialId = combatant.guardian.specialEffect ?? combatant.guardian.special ?? null;
  if (!specialId) {
    combatant.rage = 0;
    pushLog(`⚡ ${combatant.guardian.name} rage filled but no specialEffect defined.`);
    return;
  }

  const eff = getEffectById(specialId);
  if (!eff) {
    combatant.rage = 0;
    pushLog(`⚠️ ${combatant.guardian.name} special effect id "${specialId}" not found.`);
    return;
  }

  pushLog(`💥 Guardian ${combatant.guardian.name} activated SPECIAL: ${eff.name ?? eff.id}`);
  executeEffect(eff, combatant.guardian, combatant, opponent, null, pushLog, rng);
  combatant.rage = 0;
}

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

function reduceTurnCounters(combatant) {
  for (const c of combatant.cards) {
    if (c.stunned > 0) c.stunned = Math.max(0, c.stunned - 1);
  }
}

function executeSingleTurn(attacker, defender, pushLog, rng) {
  // Garantia de estado limpo no início do turno (Melhoria)
  attacker.graveLock = false; 
  defender.graveLock = false;
  
  tryActivateGuardianSpecial(attacker, defender, pushLog, rng);

  runEffectsTrigger("onTurnStart", attacker, defender, null, pushLog, rng);
  
  // Processa DoT e Checa Mortes (do Attacker) antes de atacar
  processOverTimeFor(attacker, pushLog);
  checkDeathsAndHandle(attacker, pushLog); 

  const acting = attacker.cards.find(c => (c.hp ?? 0) > 0 && !(c.stunned > 0));
  
  if (!acting) {
    pushLog(`🚫 ${attacker.nameForLog} skipped turn (no cards or all stunned).`);
    reduceTurnCounters(attacker);
    return;
  }

  // Disparo Único e Focado de onAttackStart (Melhoria)
  runEffectsTrigger("onAttackStart", attacker, defender, acting, pushLog, rng);

  const target = pickFirstAlive(defender.cards);
  if (!target) return;

  // Dano e Rage
  const { damage, evaded } = computeDamage(acting, target, defender, rng);
  
  if (evaded) {
    pushLog(`💨 ${target.name} evaded ${acting.name}'s attack.`);
  } else {
    target.hp = Math.max(0, (target.hp ?? 0) - damage);
    pushLog(`💥 ${acting.name} dealt ${damage} to ${target.name} (${Math.max(0, target.hp)} HP).`);
  }

  runEffectsTrigger("onHit", defender, attacker, target, pushLog, rng);

  // Checa se o defensor morreu APÓS o ataque
  checkDeathsAndHandle(defender, pushLog); 

  runEffectsTrigger("afterAttack", attacker, defender, acting, pushLog, rng);
  runEffectsTrigger("afterDefense", defender, attacker, target, pushLog, rng);
  
  reduceTurnCounters(attacker);
}

export function battleSystem(playerInput, opponentInput, options = {}) {
  const rng = createRng(options.seed ?? null);
  const maxTurns = options.maxTurns ?? 100;
  const A = makeCombatantFromInput(playerInput || {}, 'player', rng);
  const B = makeCombatantFromInput(opponentInput || {}, 'opponent', rng);

  const log = [];
  const pushLog = (l) => log.push(l);

  pushLog(`⚔️ Battle start: ${A.nameForLog} vs ${B.nameForLog}`);

  let turn = 1;
  let winner = "draw";

  while (turn <= maxTurns) {
    const aAliveCards = (A.cards || []).some(c => (c.hp ?? 0) > 0);
    const bAliveCards = (B.cards || []).some(c => (c.hp ?? 0) > 0);
    const aGuardianAlive = A.guardian && (A.guardian.hp ?? 0) > 0;
    const bGuardianAlive = B.guardian && (B.guardian.hp ?? 0) > 0;

    // Checagem de vitória/derrota (MANTIDA)
    if (A.guardian && !aGuardianAlive) { winner = "opponent"; break; }
    if (B.guardian && !bGuardianAlive) { winner = "player"; break; }
    if (!aAliveCards && bAliveCards) { winner = "opponent"; break; }
    if (!bAliveCards && aAliveCards) { winner = "player"; break; }
    if (!aAliveCards && !bAliveCards) { winner = "draw"; break; }


    pushLog(`\n🕐 Turn ${turn}`);

    const attacker = (turn % 2 === 1) ? A : B;
    const defender = (turn % 2 === 1) ? B : A;

    executeSingleTurn(attacker, defender, pushLog, rng);
    
    // Processa DoT e Mortes (do Defender) após o ataque do Attacker
    processOverTimeFor(defender, pushLog);
    checkDeathsAndHandle(defender, pushLog); 

    runEffectsTrigger("afterTurn", A, B, null, pushLog, rng);
    runEffectsTrigger("afterTurn", B, A, null, pushLog, rng);

    turn++;
  }

  // Lógica de desempate final (MANTIDA)
  if (winner === "draw") {
    const playerHP = sumHP(A.cards || []);
    const opponentHP = sumHP(B.cards || []);
    if (playerHP > opponentHP) winner = "player";
    else if (opponentHP > playerHP) winner = "opponent";
    else {
      const pCount = (A.cards || []).filter(c => (c.hp ?? 0) > 0).length;
      const oCount = (B.cards || []).filter(c => (c.hp ?? 0) > 0).length;
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
