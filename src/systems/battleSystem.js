import { getEffectById } from "./effectSystem.js";
import { getCardTemplate } from "./cardSystem.js";

// Configs
const MAX_TURNS = 100;
const AUTO_MODE_TURN_START = 20;
const BASE_CARD_TURN_TIME = 3;
const MAX_HAND_SIZE = 5;

/* ----------------------
   Utilitários & RNG
---------------------- */
function createRng(seed) {
  if (seed === undefined || seed === null) return { rand: () => Math.random() };
  let t = seed >>> 0;
  return {
    rand() {
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    },
  };
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function sumHP(cards) {
  // FIX: Garantir que NaN/null/undefined HP seja tratado como 0
  return (cards || []).reduce((s, c) => s + Math.max(0, Number(c.hp) || 0), 0);
}

function sumTotalHP(combatant) {
  let total = sumHP(combatant.field);
  total += sumHP(combatant.hand);
  // FIX: Garantir que NaN/null/undefined HP do guardian seja tratado como 0
  if (combatant.guardian) total += Math.max(0, Number(combatant.guardian.hp) || 0);
  return total;
}

function pickFirstAlive(cards) {
  // FIX: Considerar apenas cartas onde o HP é um número positivo
  return (cards || []).find((c) => (Number(c.hp) || 0) > 0) || null;
}

/* ----------------------
   EFEITOS (VERSÃO SEGURA)
---------------------- */
function executeEffect(effect, card, owner, opponent, pushLog, rng, context = {}) {
  if (!effect) return;
  try {
    // Se a ação é função
    if (typeof effect.action === "function") {
      // Funções nativas não precisam de injeção de string
      effect.action(card, owner, opponent, pushLog, rng);
    }
    // Se a ação é string (JS)
    else if (typeof effect.action === "string") {
      try {
        // FIX: Injeção de Contexto para string effects
        const allies = owner.field.filter(c => (Number(c.hp) || 0) > 0);
        const enemies = opponent ? opponent.field.filter(c => (Number(c.hp) || 0) > 0) : [];

        const fn = new Function(
          "card", "owner", "opponent", "pushLog", "rng", 
          "target", "attacker", "damage", "allies", "enemies",
          effect.action
        );
        
        fn(
          card, 
          owner, 
          opponent, 
          pushLog, 
          rng, 
          context.target || null,
          context.attacker || null,
          context.damage || 0,
          allies,
          enemies
        );
      } catch (err) {
        // Log detalhado do erro para facilitar o debug dos scripts de efeito
        pushLog(`⚠️ Efeito "${effect.id}" ignorado: erro na execução da string. Detalhe: ${err.message}`);
      }
    }
  } catch (err) {
    pushLog(`⚠️ Efeito "${effect.id}" ignorado: ${err.message}`);
  }
}

function runEffectsTrigger(trigger, combatant, opponent, card, pushLog, rng, context = {}) {
  const effects = [];
  
  // Efeitos da Carta
  if (card && card.effects) effects.push(...card.effects.map(getEffectById).filter(Boolean));
  
  // Efeitos do Guardião
  if (combatant.guardian && combatant.guardian.effects) effects.push(...combatant.guardian.effects.map(getEffectById).filter(Boolean));
  
  // FIX: Coleta efeitos de campo/aura para triggers de turno e entrada/saída
  if (trigger === "onTurnEnd" || trigger === "onTurnStart" || trigger === "onEnterField") {
      combatant.field.forEach(c => {
          // Garante que a carta ainda está viva antes de rodar a Aura
          if ((Number(c.hp) || 0) > 0 && c.effects) effects.push(...c.effects.map(getEffectById).filter(Boolean));
      });
  }

  for (const eff of effects) {
    if (eff.type === trigger) {
      // Passa o contexto relevante
      executeEffect(eff, card || combatant, combatant, opponent, pushLog, rng, context);
    }
  }
}

/* ----------------------
   Dano
---------------------- */
function computeDamage(attackerCard, defenderCard, defenderCombatant, rng) {
  // FIX: Garante que evadeChance é numérico
  const evadeChance = Number(defenderCard.evadeChance) || 0;
  if (evadeChance > 0 && rng.rand() < evadeChance) {
    defenderCard.lastDamage = 0;
    return { damage: 0, evaded: true };
  }

  // FIX: Garante que attack e defense são numéricos, usando 100 como default para attack
  const atk = Math.max(0, Number(attackerCard.attack) || 100);
  const base = Math.round(atk * (0.85 + rng.rand() * 0.3));
  const def = Number(defenderCard.defense) || 0;
  let reduced = Math.max(0, Math.round(base - def * 0.2));
  let remaining = reduced;

  // FIX: Garante que shield é numérico
  if (Number(defenderCard.shield) > 0) {
    const absorbed = Math.min(defenderCard.shield, remaining);
    defenderCard.shield -= absorbed;
    remaining -= absorbed;
  }

  defenderCard.lastDamage = remaining;
  if (remaining > 0 && defenderCombatant.guardian) {
    defenderCombatant.rage = (defenderCombatant.rage ?? 0) + remaining;
  }

  return { damage: remaining, evaded: false };
}

/* ----------------------
   DOT / OverTime
---------------------- */
function processOverTimeFor(combatant, pushLog) {
  if (!combatant.overTime || combatant.overTime.length === 0) return;
  const remaining = [];
  const target = pickFirstAlive(combatant.field) || (combatant.guardian && (Number(combatant.guardian.hp) || 0) > 0 ? combatant.guardian : null);
  if (!target) return;

  for (const eff of combatant.overTime) {
    if (eff.turns > 0) {
      const damage = eff.value ?? 0;
      target.hp = Math.max(0, (Number(target.hp) || 0) - damage); // FIX: Safe subtraction
      pushLog(`🔥 ${target.name} sofreu ${damage} de dano por tempo (${Math.max(0, target.hp)} HP restantes).`);
      eff.turns -= 1;
    }
    if (eff.turns > 0) remaining.push(eff);
  }
  combatant.overTime = remaining;
  combatant.hp = sumTotalHP(combatant);
}

/* ----------------------
   Mortes & Phoenix
---------------------- */
function checkDeathsAndHandle(combatant, pushLog) {
  const died = [];
  combatant.field = (combatant.field || []).filter((c) => {
    // FIX: Garantir que a checagem de morte funcione corretamente com NaN
    if ((Number(c.hp) || 0) <= 0) {
      const phoenixEffectId = (c.effects || []).find((eid) => {
        const ee = getEffectById(eid);
        return ee && ee.type === "onDeath" && (ee.id === "eff029" || ee.id === "phoenixSoul" || ee.id === "phoenix_soul");
      });

      if (phoenixEffectId) {
        const eff = getEffectById(phoenixEffectId);
        // Passa contexto vazio para onDeath
        executeEffect(eff, c, combatant, null, pushLog, null, {});
        if ((Number(c.hp) || 0) > 0) {
          pushLog(`🔁 ${c.name} revivido por ${eff.name ?? eff.id} com ${c.hp} HP.`);
          return true;
        }
      }

      died.push(c);
      combatant.graveyard = combatant.graveyard || [];
      combatant.graveyard.push(deepClone(c));
      return false;
    }
    return true;
  });

  if (died.length > 0) died.forEach((d) => pushLog(`⚰️ ${d.name} foi para o cemitério.`));
  
  // FIX CRÍTICO (Anti-Redundância): Logar a morte do Guardião apenas uma vez
  if ((Number(combatant.guardian?.hp) || 0) <= 0 && combatant.guardian) {
    if (!combatant.isGuardianDefeated) {
      pushLog(`⚰️ Guardião ${combatant.guardian.name} foi derrotado.`);
      combatant.isGuardianDefeated = true; 
    }
  }

  combatant.hp = sumTotalHP(combatant);
}

/* ----------------------
   Guardião
---------------------- */
function tryActivateGuardianSpecial(combatant, opponent, pushLog, rng) {
  if (!combatant.guardian) return;
  combatant.rage = combatant.rage ?? 0;
  const rageMax = combatant.guardian.rageMax ?? 100;
  // FIX: Checagem de HP do Guardião
  if ((Number(combatant.guardian.hp) || 0) <= 0 || combatant.rage < rageMax) return;

  const specialId = combatant.guardian.specialEffect ?? combatant.guardian.special ?? null;
  if (!specialId) {
    combatant.rage = 0;
    pushLog(`⚡ ${combatant.guardian.name} rage cheia, mas sem efeito especial definido.`);
    return;
  }

  const eff = getEffectById(specialId);
  if (!eff) {
    combatant.rage = 0;
    pushLog(`⚠️ Efeito especial do Guardião "${specialId}" não encontrado.`);
    return;
  }

  pushLog(`💥 Guardião ${combatant.guardian.name} ativou ESPECIAL: ${eff.name ?? eff.id}`);
  // Passa contexto vazio para ativação de Guardião
  executeEffect(eff, combatant.guardian, combatant, opponent, pushLog, rng, {});
  combatant.rage = 0;
}

/* ----------------------
   Preparação das cartas
---------------------- */
function createCombatCard(cardTemplate, rng) {
  const card = deepClone(cardTemplate);
  card.uniqueId = card.uniqueId ?? `${card.id}_${Math.floor((rng?.rand?.() ?? Math.random()) * 1e9)}`;
  card.turnTime = card.turnTime ?? BASE_CARD_TURN_TIME;
  // FIX: Inicializa HP, MaxHP, Defense e Attack como números válidos
  card.hp = Number(card.hp) || Number(card.maxHp) || 200;
  card.maxHp = Number(card.maxHp) || Number(card.hp) || 200;
  card.attack = Number(card.attack) || 100;
  card.defense = Number(card.defense) || 0;
  
  card.shield = card.shield ?? 0;
  card.stunned = card.stunned ?? 0;
  card.silenced = card.silenced ?? false;
  card.evadeChance = card.evadeChance ?? 0;
  card.lastDamage = 0;
  return card;
}

function makeCombatantFromInput(input = {}, role = "player", rng) {
  const cardsToUse = (input.cards || [])
    .map((cIdOrObj) => {
      if (typeof cIdOrObj === "string") {
        const template = getCardTemplate(cIdOrObj);
        return template ? deepClone(template) : null;
      }
      if (typeof cIdOrObj === "object") {
        const template = getCardTemplate(cIdOrObj.id) || cIdOrObj;
        return Object.assign(deepClone(template), deepClone(cIdOrObj));
      }
      return null;
    })
    .filter(Boolean);

  const deck = cardsToUse.map((c) => createCombatCard(c, rng));
  const guardianData = input.guardian ? deepClone(input.guardian) : null;
  if (guardianData) {
    guardianData.hp = Number(guardianData.hp) || Number(guardianData.maxHp) || 1000;
    guardianData.maxHp = Number(guardianData.maxHp) || Number(guardianData.hp) || 1000;
  }

  const combatant = {
    id: input.id ?? role,
    name: input.username ?? input.name ?? role,
    nameForLog: input.username ?? input.name ?? role,
    deck,
    hand: [],
    field: [],
    graveyard: deepClone(input.graveyard || []),
    guardian: guardianData,
    overTime: deepClone(input.overTime || []),
    rage: input.rage ?? 0,
    rageMax: guardianData?.rageMax ?? 100,
    // FIX: Adicionar flag para evitar log duplicado de morte do Guardião
    isGuardianDefeated: (Number(guardianData?.hp) || 0) <= 0,
    hp: 0,
  };

  for (let i = 0; i < 3 && combatant.deck.length > 0; i++) {
    combatant.hand.push(combatant.deck.shift());
  }
  combatant.hp = sumTotalHP(combatant);
  return combatant;
}

/* ----------------------
   Hand/Field
---------------------- */
function drawCard(combatant, pushLog) {
  if (!combatant || combatant.deck.length === 0 || combatant.hand.length >= MAX_HAND_SIZE) return null;
  const card = combatant.deck.shift();
  combatant.hand.push(card);
  pushLog(`🃏 ${combatant.nameForLog} puxou ${card.name}.`);
  return card;
}

function moveReadyToField(combatant, pushLog) {
  const ready = combatant.hand.filter((c) => (c.turnTime ?? 0) <= 0);
  if (ready.length === 0) return;
  combatant.hand = combatant.hand.filter((c) => (c.turnTime ?? 0) > 0);
  combatant.field.push(...ready);
  for (const c of ready) {
    // Passa contexto vazio para onEnterField
    runEffectsTrigger("onEnterField", combatant, null, c, pushLog, null, {});
    pushLog(`⬆️ ${c.name} entrou em campo.`);
  }
}

function processTurnTime(combatant, pushLog) {
  combatant.hand.forEach((c) => (c.turnTime = Math.max(0, (c.turnTime ?? 0) - 1)));
  moveReadyToField(combatant, pushLog);
}

/* ----------------------
   Win / Ordem atacante
---------------------- */
function checkWinCondition(state) {
  const { player1, player2 } = state;
  
  // NOVA REGRA CRÍTICA: Se o Guardião for derrotado, o jogo termina imediatamente.
  const p1GuardianDefeated = player1.guardian && (Number(player1.guardian.hp) || 0) <= 0;
  const p2GuardianDefeated = player2.guardian && (Number(player2.guardian.hp) || 0) <= 0;

  if (p1GuardianDefeated && !p2GuardianDefeated) return "opponent";
  if (p2GuardianDefeated && !p1GuardianDefeated) return "player";

  // Se ambos os guardiões estiverem vivos, usa a regra original (total wipe)
  const p1Alive = sumHP(player1.field) > 0 || sumHP(player1.hand) > 0 || (Number(player1.guardian?.hp) || 0) > 0;
  const p2Alive = sumHP(player2.field) > 0 || sumHP(player2.hand) > 0 || (Number(player2.guardian?.hp) || 0) > 0;
  
  // Cenários onde o Guardião já foi removido (pode não acontecer no seu jogo)
  if (!p1Alive && p2Alive) return "opponent";
  if (!p2Alive && p1Alive) return "player";
  if (!p1Alive && !p2Alive) return "draw";
  
  return null;
}

function getFirstAttacker(inputA, inputB) {
  const sumAttackA = (inputA.cards || []).reduce((s, c) => s + (typeof c === "object" ? Number(c.attack) || 0 : Number(getCardTemplate(c)?.attack) || 0), 0);
  const sumAttackB = (inputB.cards || []).reduce((s, c) => s + (typeof c === "object" ? Number(c.attack) || 0 : Number(getCardTemplate(c)?.attack) || 0), 0);
  return sumAttackB > sumAttackA ? inputB.id ?? "opponent" : inputA.id ?? "player";
}

/* ----------------------
   Ataques
---------------------- */
function resolveAttacks(attacker, defender, pushLog, rng) {
  for (const attackCard of attacker.field.filter((c) => (Number(c.hp) || 0) > 0 && !(c.stunned > 0))) {
    
    // 1. Determinar alvo
    const targetCard = defender.field.find((c) => (Number(c.hp) || 0) > 0) || null;
    const targetGuardian = defender.guardian && (Number(defender.guardian.hp) || 0) > 0 ? defender.guardian : null;
    const targetUnit = targetCard || targetGuardian;
    
    // Inicialização do Contexto
    const context = { target: targetUnit, attacker: attackCard, damage: 0 };

    if (!targetUnit) {
      pushLog(`🚫 ${attackCard.name} não encontrou alvos e encerra o ataque.`);
      continue;
    }

    // onAttackStart (Atacante) - GARANTIDO: Efeitos modificam ATK/DEF antes do dano
    runEffectsTrigger("onAttackStart", attacker, defender, attackCard, pushLog, rng, context);

    // 2. Calcular Dano
    const { damage, evaded } = computeDamage(attackCard, targetUnit, defender, rng);
    
    // Atualiza o dano no contexto (crucial para onHit/afterDefense/afterAttack)
    context.damage = damage; 

    // 3. Aplicar Dano
    if (evaded) pushLog(`💨 ${targetUnit.name} evadiu o ataque de ${attackCard.name}.`);
    else {
      // FIX: Garante que HP seja sempre um número válido antes de subtrair
      targetUnit.hp = Math.max(0, (Number(targetUnit.hp) || 0) - damage);
      pushLog(`💥 ${attackCard.name} (ATK: ${attackCard.attack}) causou ${damage} de dano em ${targetUnit.name} (HP: ${Math.max(0, targetUnit.hp)}).`);
    }

    // 4. onHit (Defensor)
    runEffectsTrigger("onHit", defender, attacker, targetUnit, pushLog, rng, context);
    checkDeathsAndHandle(defender, pushLog);
    
    // FIX CRÍTICO: Checa a condição de vitória imediatamente após a morte/limpeza de campo
    if (checkWinCondition({ player1: attacker, player2: defender })) return;
    
    // 5. afterAttack (Atacante)
    runEffectsTrigger("afterAttack", attacker, defender, attackCard, pushLog, rng, context);
    
    // 6. afterDefense (Defensor)
    runEffectsTrigger("afterDefense", defender, attacker, targetUnit, pushLog, rng, context);

    // Checa novamente caso algum afterEffect cause mais mortes
    if (checkWinCondition({ player1: attacker, player2: defender })) return;
  }
}

/* ----------------------
   Motor principal
---------------------- */
export function runBattle(userInput, opponentInput, options = {}) {
  const rng = createRng(options.seed ?? null);
  const log = [];
  const pushLog = (line) => log.push(String(line));

  const A = makeCombatantFromInput(userInput || {}, "player", rng);
  const B = makeCombatantFromInput(opponentInput || {}, "opponent", rng);
  let activePlayerId = getFirstAttacker(userInput || {}, opponentInput || {});
  const maxTurns = options.maxTurns ?? MAX_TURNS;
  let winner = "draw";
  let turn = 1;
  const isAutoMode = !!options.autoMode;

  pushLog(`⚔️ Batalha: ${A.nameForLog} (A) vs ${B.nameForLog} (B). Primeiro atacante: ${activePlayerId === A.id ? A.nameForLog : B.nameForLog}`);

  while (turn <= maxTurns) {
    const attacker = activePlayerId === A.id ? A : B;
    const defender = activePlayerId === A.id ? B : A;

    const preCheck = checkWinCondition({ player1: A, player2: B });
    if (preCheck) {
      winner = preCheck === "player" ? "player" : preCheck === "opponent" ? "opponent" : "draw";
      break;
    }

    pushLog(`\n--- 🕐 Turno ${turn}: ${attacker.nameForLog} ---`);
    tryActivateGuardianSpecial(attacker, defender, pushLog, rng);
    
    // onTurnStart: Passa contexto vazio
    runEffectsTrigger("onTurnStart", attacker, defender, null, pushLog, rng, {});

    drawCard(attacker, pushLog);
    processTurnTime(attacker, pushLog);

    resolveAttacks(attacker, defender, pushLog, rng);
    
    // FIX CRÍTICO: A saída mais garantida
    const postAttackCheck = checkWinCondition({ player1: A, player2: B });
    if (postAttackCheck) {
      winner = postAttackCheck === "player" ? "player" : postAttackCheck === "opponent" ? "opponent" : "draw";
      break;
    }

    processOverTimeFor(defender, pushLog);
    checkDeathsAndHandle(defender, pushLog);
    
    // Checa após DOT e limpeza final
    const postDOTCheck = checkWinCondition({ player1: A, player2: B });
    if (postDOTCheck) {
      winner = postDOTCheck === "player" ? "player" : postDOTCheck === "opponent" ? "opponent" : "draw";
      break;
    }


    if (isAutoMode && turn >= AUTO_MODE_TURN_START) {
      pushLog(`⏩ Auto Mode ativado no Turno ${turn}. Simulação acelerada.`);
      if (sumTotalHP(A) > sumTotalHP(B)) winner = "player";
      else if (sumTotalHP(B) > sumTotalHP(A)) winner = "opponent";
      else winner = "draw";
      break;
    }

    // onTurnEnd: Passa contexto vazio
    runEffectsTrigger("onTurnEnd", attacker, defender, null, pushLog, rng, {});
    activePlayerId = activePlayerId === A.id ? B.id : A.id;
    turn += 1;
  }

  const finalWinner = checkWinCondition({ player1: A, player2: B }) || winner;
  const rewards = finalWinner === "player" ? { xp: 1500, gold: 800 } : { xp: 100, gold: 50 };
  
  // REMOVIDO: O log final de vitória para evitar duplicidade no ambiente de execução.

  return {
    win: finalWinner === "player",
    winner: finalWinner,
    turns: Math.min(turn, maxTurns),
    log,
    final: { player: A, opponent: B },
    rewards,
  };
}