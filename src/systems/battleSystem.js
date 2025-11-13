import { getEffectById, runEffectsTrigger, executeEffect } from "./effectSystem.js";
import { getCardTemplate } from "./cardSystem.js"; 

// --- Configurações & Constantes ---
const MAX_TURNS = 100;
const AUTO_MODE_TURN_START = 20;
const BASE_CARD_TURN_TIME = 3; // Tempo padrão para a carta entrar em campo
const MAX_HAND_SIZE = 5; 

// --- Funções Utilitárias e de Estado ---

/** Cria um gerador de números pseudo-aleatórios (RNG) usando uma seed. */
function createRng(seed) {
  if (!seed) return { rand: () => Math.random() };
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

function deepClone(obj) {
  // Clona um objeto de forma profunda
  return JSON.parse(JSON.stringify(obj));
}

/** Soma o HP total de um array de cartas. */
function sumHP(cards) {
  return (cards || []).reduce((s, c) => s + Math.max(0, c.hp ?? 0), 0);
}

/** Soma o HP total de um combatente (Campo + Mão + Guardião) */
function sumTotalHP(combatant) {
  let total = sumHP(combatant.field);
  total += sumHP(combatant.hand);
  if (combatant.guardian) total += Math.max(0, combatant.guardian.hp ?? 0);
  return total;
}

/** Seleciona o primeiro alvo vivo em um array de cartas. */
function pickFirstAlive(cards) {
  return (cards || []).find(c => (c.hp ?? 0) > 0) || null;
}

/** Calcula o dano de uma carta atacante para uma carta defensora. */
function computeDamage(attackerCard, defenderCard, defenderCombatant, rng) {
  // 1. Evasão
  if (defenderCard.evadeChance && rng.rand() < (defenderCard.evadeChance ?? 0)) {
    defenderCard.lastDamage = 0;
    return { damage: 0, evaded: true };
  }
  
  // 2. Dano Base (com variação de RNG)
  const base = Math.round((attackerCard.attack ?? 100) * (0.75 + rng.rand() * 0.5));
  
  // 3. Redução por Defesa
  const reduced = Math.max(0, Math.round(base - (defenderCard.defense ?? 0) * 0.2));
  let remaining = reduced;
  
  // 4. Absorção por Escudo
  if (defenderCard.shield && defenderCard.shield > 0) {
    const absorbed = Math.min(defenderCard.shield, remaining);
    defenderCard.shield -= absorbed;
    remaining -= absorbed;
  }
  
  defenderCard.lastDamage = remaining;
  
  // 5. Acúmulo de Rage no Guardião
  if (remaining > 0 && defenderCombatant.guardian) {
    defenderCombatant.rage = (defenderCombatant.rage ?? 0) + remaining;
  }
  
  return { damage: remaining, evaded: false };
}

/** Processa efeitos de Dano ao Longo do Tempo (DOT) */
function processOverTimeFor(combatant, pushLog = () => {}) {
  if (!combatant.overTime?.length) return;
  const remaining = [];
  
  // O DOT afeta o primeiro alvo vivo no campo ou o guardião.
  const target = pickFirstAlive(combatant.field) || (combatant.guardian && (combatant.guardian.hp ?? 0) > 0 ? combatant.guardian : null);
  if (!target) return;
  
  for (const eff of combatant.overTime) {
    if (eff.turns > 0) {
      const damage = eff.value ?? 0;
      target.hp = Math.max(0, (target.hp ?? 0) - damage);
      pushLog(`🔥 ${target.name} sofreu ${damage} de dano por tempo (${Math.max(0, target.hp)} HP restantes).`);
      eff.turns -= 1;
    }
    if (eff.turns > 0) remaining.push(eff);
  }
  combatant.overTime = remaining;
  combatant.hp = sumTotalHP(combatant); // Atualiza HP total
}

/** Verifica e trata cartas e guardiões derrotados, incluindo lógica de Reviver. */
function checkDeathsAndHandle(combatant, pushLog = () => {}) {
  const died = [];
  
  // Checa cartas no campo
  combatant.field = (combatant.field || []).filter(c => {
    if ((c.hp ?? 0) <= 0) {
      // Tenta Reviver (Efeito Fênix)
      const phoenixEffectId = (c.effects || []).find(eid => {
        const ee = getEffectById(eid);
        return ee && ee.type === "onDeath" && (ee.id === "phoenixSoul");
      });
      
      if (phoenixEffectId) {
        const eff = getEffectById(phoenixEffectId);
        executeEffect(eff, c, combatant, null, null, pushLog);
        if ((c.hp ?? 0) > 0) {
          pushLog(`🔁 ${c.name} revivido por ${eff.name ?? eff.id} com ${c.hp} HP.`);
          return true; // Mantém a carta
        }
      }
      
      // Se não reviveu ou não tinha o efeito
      died.push(c);
      combatant.graveyard = combatant.graveyard || [];
      combatant.graveyard.push(deepClone(c));
      return false; // Remove a carta
    }
    return true;
  });
  
  if (died.length > 0) {
    for (const d of died) pushLog(`⚰️ ${d.name} foi para o cemitério.`);
  }
  
  // Checa Guardião
  if (combatant.guardian && (combatant.guardian.hp ?? 0) <= 0) {
    pushLog(`⚰️ Guardião ${combatant.guardian.name} foi derrotado.`);
  }
  
  combatant.hp = sumTotalHP(combatant); // Atualiza HP total
}

/** Tenta ativar a habilidade especial do Guardião se a Rage estiver cheia. */
function tryActivateGuardianSpecial(combatant, opponent, pushLog = () => {}, rng) {
  if (!combatant.guardian) return;
  combatant.rage = combatant.rage ?? 0;
  const rageMax = combatant.guardian.rageMax ?? 100;
  
  if ((combatant.guardian.hp ?? 0) <= 0 || combatant.rage < rageMax) return;
  
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
  executeEffect(eff, combatant.guardian, combatant, opponent, null, pushLog, rng);
  combatant.rage = 0; // Zera a rage após o uso
}

// --- Funções de Preparação de Batalha ---

/** Cria uma carta de combate com estados iniciais. */
function createCombatCard(cardTemplate, rng) {
  const card = deepClone(cardTemplate);
  card.uniqueId = card.uniqueId ?? `${card.id}_${Math.floor((rng?.rand?.() ?? Math.random()) * 1e9)}`;
  card.turnTime = card.turnTime ?? BASE_CARD_TURN_TIME; 
  card.hp = card.hp ?? card.maxHp ?? 200;
  card.maxHp = card.maxHp ?? card.hp;
  // Inicialização de outros estados de combate
  card.shield = card.shield ?? 0;
  card.stunned = card.stunned ?? 0;
  card.silenced = card.silenced ?? false;
  card.evadeChance = card.evadeChance ?? 0;
  card.lastDamage = 0;
  return card;
}

/** Converte o input (user/opponent) em um objeto de combatente pronto para a batalha. */
function makeCombatantFromInput(input, role, rng) {
  const cardsToUse = (input.cards || []).map(cId => {
    // Tentativa de carregar template, fallback para template mock se usar apenas ID
    const template = getCardTemplate(cId) || (typeof cId === 'object' ? cId : getCardTemplate("default"));
    return template;
  }).filter(c => c !== null);

  const deck = cardsToUse.map(c => createCombatCard(c, rng));
  
  // Guardião, se presente, deve ser um clone profundo
  const guardianData = input.guardian ? deepClone(input.guardian) : null;
  if (guardianData) {
      guardianData.hp = guardianData.hp ?? guardianData.maxHp ?? 1000;
      guardianData.maxHp = guardianData.maxHp ?? guardianData.hp;
  }

  const combatant = {
    id: input.id ?? role,
    name: input.username ?? input.name ?? role,
    nameForLog: input.username ?? input.name ?? role,
    deck: deck,
    hand: [], 
    field: [], 
    graveyard: deepClone(input.graveyard || []),
    guardian: guardianData,
    overTime: deepClone(input.overTime || []),
    rage: input.rage ?? 0,
    rageMax: guardianData?.rageMax ?? 100,
    hp: 0, 
  };
  
  // Puxa as cartas iniciais (Mão inicial)
  for (let i = 0; i < 3 && combatant.deck.length > 0; i++) {
    combatant.hand.push(combatant.deck.shift());
  }

  combatant.hp = sumTotalHP(combatant);
  return combatant;
}

// --- Lógica de Turno e Ação ---

/** Puxa uma carta do deck para a mão. */
function drawCard(combatant, pushLog) {
  if (combatant.deck.length === 0 || combatant.hand.length >= MAX_HAND_SIZE) return null;
  const card = combatant.deck.shift();
  combatant.hand.push(card);
  pushLog(`🃏 ${combatant.nameForLog} puxou ${card.name}.`);
  return card;
}

/** Move cartas prontas da mão para o campo de batalha. */
function moveReadyToField(combatant, pushLog) {
  const ready = combatant.hand.filter(c => (c.turnTime ?? 0) <= 0);
  if (ready.length === 0) return;
  
  combatant.hand = combatant.hand.filter(c => (c.turnTime ?? 0) > 0);
  combatant.field.push(...ready);
  
  for (const c of ready) {
    runEffectsTrigger("onEnterField", combatant, c, null, pushLog);
    pushLog(`⬆️ ${c.name} entrou em campo.`);
  }
}

/** Decrementa o tempo de turno das cartas na mão. */
function processTurnTime(combatant, pushLog) {
  combatant.hand.forEach(c => {
    c.turnTime = Math.max(0, (c.turnTime ?? 0) - 1);
  });
  moveReadyToField(combatant, pushLog);
}

/** Checa se um combatente atingiu a condição de vitória/derrota. */
function checkWinCondition(state) {
  const { player1, player2 } = state;
  // A win condition é determinada pela presença de qualquer unidade viva (Field, Hand ou Guardian)
  const p1Alive = sumHP(player1.field) > 0 || sumHP(player1.hand) > 0 || (player1.guardian?.hp ?? 0) > 0;
  const p2Alive = sumHP(player2.field) > 0 || sumHP(player2.hand) > 0 || (player2.guardian?.hp ?? 0) > 0;
  
  if (!p1Alive && p2Alive) return "opponent";
  if (!p2Alive && p1Alive) return "player";
  if (!p1Alive && !p2Alive) return "draw";
  return null;
}

/** Determina quem ataca primeiro com base no poder de ataque do deck. */
function getFirstAttacker(A, B) {
  // Regra: O oponente mais forte (maior soma de ATK base) ataca primeiro.
  const sumAttackA = (A.cards || []).reduce((sum, c) => sum + (c.attack ?? 0), 0);
  const sumAttackB = (B.cards || []).reduce((sum, c) => sum + (c.attack ?? 0), 0);
  
  if (sumAttackB > sumAttackA) return B.id;
  return A.id; 
}

/** Resolve a fase de ataque de um combatente. */
function resolveAttacks(attacker, defender, pushLog, rng) {
  for (const attackCard of attacker.field.filter(c => (c.hp ?? 0) > 0 && !(c.stunned > 0))) {
    
    // 1. Efeitos de Pré-Ataque
    runEffectsTrigger("onAttackStart", attacker, defender, attackCard, pushLog, rng);

    // 2. Seleção de Alvo: Prioriza primeira carta viva no campo
    const targetCard = defender.field.find(c => (c.hp ?? 0) > 0) || null;
    const targetGuardian = defender.guardian && (defender.guardian.hp ?? 0) > 0 ? defender.guardian : null;

    let targetUnit = targetCard || targetGuardian;
    
    if (!targetUnit) {
      pushLog(`🚫 ${attackCard.name} não encontrou alvos e encerra o ataque.`);
      continue;
    }

    // 3. Cálculo e Aplicação de Dano
    const { damage, evaded } = computeDamage(attackCard, targetUnit, defender, rng);

    if (evaded) {
        pushLog(`💨 ${targetUnit.name} evadiu o ataque de ${attackCard.name}.`);
    } else {
        targetUnit.hp = Math.max(0, (targetUnit.hp ?? 0) - damage);
        pushLog(`💥 ${attackCard.name} (ATK: ${attackCard.attack}) deu ${damage} de dano em ${targetUnit.name} (HP: ${Math.max(0, targetUnit.hp)}).`);
    }

    // 4. Efeitos Pós-Ataque/Defesa e Verificação de Morte
    runEffectsTrigger("onHit", defender, attacker, targetUnit, pushLog, rng);
    checkDeathsAndHandle(defender, pushLog); 
    
    runEffectsTrigger("afterAttack", attacker, defender, attackCard, pushLog, rng);
    runEffectsTrigger("afterDefense", defender, attacker, targetUnit, pushLog, rng);
    
    // Checagem imediata de vitória após cada ataque
    if (checkWinCondition({ player1: attacker, player2: defender })) return;
  }
}

// --- Motor Principal ---

/**
 * Simula uma batalha detalhada entre dois combatentes (usuário e oponente).
 * @param {object} user - O objeto usuário (Combatente A).
 * @param {object} opponent - O objeto oponente (Combatente B).
 * @param {object} [options={}] - Opções de batalha.
 * @returns {object} O resultado final da batalha, incluindo logs.
 */
export function battleSystem(user, opponent, options = {}) {
  const rng = createRng(options.seed ?? null);
  const log = [];
  const pushLog = l => log.push(l);
  
  // 1. Setup da Batalha: Converte objetos user/opponent em combatentes de batalha
  const A = makeCombatantFromInput(user || {}, 'player', rng);
  const B = makeCombatantFromInput(opponent || {}, 'opponent', rng);
  
  // Determina quem ataca primeiro
  let activePlayerId = getFirstAttacker(user, opponent); // Usa inputs originais para o ATK base
  const maxTurns = options.maxTurns ?? MAX_TURNS;
  let winner = "draw";
  let turn = 1;
  let isAutoMode = options.autoMode ?? false;

  pushLog(`⚔️ Batalha: ${A.nameForLog} (A) vs ${B.nameForLog} (B). Primeiro atacante: ${activePlayerId === A.id ? A.nameForLog : B.nameForLog}`);
  
  while (turn <= maxTurns) {
    const attacker = (activePlayerId === A.id) ? A : B;
    const defender = (activePlayerId === A.id) ? B : A;
    
    // 2. Checagem de Vitória (Antes do Turno)
    const winCheck = checkWinCondition({ player1: A, player2: B });
    if (winCheck) { winner = winCheck === "player" ? "player" : "opponent"; break; }
    
    pushLog(`\n--- 🕐 Turno ${turn}: ${attacker.nameForLog} (Ações) ---`);
    
    // 3. Ativação de Guardião e Efeitos de Início de Turno
    tryActivateGuardianSpecial(attacker, defender, pushLog, rng);
    runEffectsTrigger("onTurnStart", attacker, defender, null, pushLog, rng);
    
    // 4. Fase de Gestão de Mão/Campo
    drawCard(attacker, pushLog); 
    processTurnTime(attacker, pushLog); // Cartas com turnTime=0 movem-se para o Field
    
    // 5. Fase de Ataque
    resolveAttacks(attacker, defender, pushLog, rng);
    // Verificar vitória após ataques
    const winCheckAfterAttack = checkWinCondition({ player1: A, player2: B });
    if (winCheckAfterAttack) { winner = winCheckAfterAttack === "player" ? "player" : "opponent"; break; }


    // 6. Dano Over Time (DOT) no DEFENSOR
    processOverTimeFor(defender, pushLog);
    checkDeathsAndHandle(defender, pushLog); // Verifica morte após DOT
    
    // 7. Auto Mode (Se ativado, encerra a simulação com base no HP)
    if (isAutoMode && turn >= AUTO_MODE_TURN_START) {
      pushLog(`⏩ Auto Mode ativado no Turno ${turn}. Simulação acelerada até o fim.`);
      if (sumTotalHP(A) > sumTotalHP(B)) winner = "player";
      else if (sumTotalHP(B) > sumTotalHP(A)) winner = "opponent";
      else winner = "draw";
      break; 
    }

    // 8. Troca de Jogador e Fim do Turno
    runEffectsTrigger("onTurnEnd", attacker, defender, null, pushLog, rng);
    activePlayerId = (activePlayerId === A.id) ? B.id : A.id; 
    turn++;
  }
  
  // 9. Resolução Final
  const finalWinner = checkWinCondition({ player1: A, player2: B }) || winner;
  
  // Cálculo final de recompensas (Simples, idealmente feito no towerSystem)
  const rewards = (finalWinner === "player") ? { xp: 1500, gold: 800 } : { xp: 100, gold: 50 };
  
  return { 
    win: finalWinner === "player", 
    winner: finalWinner, 
    turns: Math.min(turn, maxTurns), 
    log, 
    final: { player: A, opponent: B }, 
    rewards 
  };
}