// --- INÍCIO: DEFINIÇÕES DE EFEITOS (Mock para execução autocontida) ---
// Em um ambiente real, estes estariam em effectSystem.js e cardSystem.js

const EFFECT_DEFINITIONS = {
  "eff001": { "id": "eff001", "name": "Buff Attack Small", "type": "onAttackStart", "valueBase": 0.15, "valuePerLevel": 0.03, "level": 10, "xpBase": 100, "xpMax": 100, "desc": "Increases your attack by 15%.", "action": "card.attack *= (1 + 0.15); pushLog('⬆️ Ataque Buffado.');" },
  "eff002": { "id": "eff002", "name": "Buff Attack Big", "type": "onAttackStart", "valueBase": 0.40, "valuePerLevel": 0.05, "level": 10, "xpBase": 500, "xpMax": 500, "desc": "Increases your attack by 40%.", "action": "card.attack *= (1 + 0.40); pushLog('⬆️ Ataque Buffado Forte.');" },
  "eff003": { "id": "eff003", "name": "Buff Defense", "type": "afterDefense", "valueBase": 0.25, "valuePerLevel": 0.04, "level": 10, "xpBase": 200, "xpMax": 200, "desc": "Increases your defense by 25%.", "action": "card.defense *= (1 + 0.25); pushLog('🛡️ Defesa Buffada.');" },
  "eff004": { "id": "eff004", "name": "Heal Small", "type": "afterDefense", "valueBase": 0.25, "valuePerLevel": 0.03, "level": 10, "xpBase": 150, "xpMax": 150, "desc": "Heals 25% of your max HP.", "action": "const heal = card.maxHp * 0.25; card.hp += heal; if(card.hp > card.maxHp) card.hp = card.maxHp; pushLog('💚 Curado em ' + heal.toFixed(0) + ' HP.');" },
  "eff005": { "id": "eff005", "name": "Heal All", "type": "onTurnEnd", "valueBase": 0.50, "valuePerLevel": 0.05, "level": 10, "xpBase": 800, "xpMax": 800, "desc": "Heals 50% of all allies' max HP.", "action": "owner.field.forEach(t=>{ if(t.hp > 0) { const heal = t.maxHp * 0.5; t.hp += heal; if(t.hp > t.maxHp) t.hp = t.maxHp; pushLog('💚 ' + t.name + ' curado em ' + heal.toFixed(0)); } });" },
  "eff006": { "id": "eff006", "name": "Shield Small", "type": "onDefense", "valueBase": 0.25, "valuePerLevel": 0.03, "level": 10, "xpBase": 300, "xpMax": 300, "desc": "Creates a shield equal to 25% of your HP.", "action": "const shield = card.maxHp * 0.25; card.shield = (card.shield || 0) + shield; pushLog('🛡️ Escudo +'+shield.toFixed(0));" },
  "eff007": { "id": "eff007", "name": "Burn", "type": "onAttackStart", "valueBase": 0.15, "valuePerLevel": 0.02, "level": 10, "xpBase": 200, "xpMax": 200, "desc": "Applies burn to the target.", "action": "if(target){ target.status = target.status||{}; target.status.burn = (target.status.burn || 0) + 1; pushLog('🔥 ' + target.name + ' queimando.'); }" },
  "eff008": { "id": "eff008", "name": "Poison", "type": "onAttackStart", "valueBase": 0.10, "valuePerLevel": 0.02, "level": 10, "xpBase": 200, "xpMax": 200, "desc": "Applies poison for 3 turns.", "action": "if(target){ target.status = target.status||{}; target.status.poison = 3; pushLog('🧪 ' + target.name + ' envenenado por 3 turnos.'); }" },
  "eff009": { "id": "eff009", "name": "Stun", "type": "onHit", "valueBase": 0.25, "valuePerLevel": 0.03, "level": 10, "xpBase": 300, "xpMax": 300, "desc": "25% chance to stun the target.", "action": "if(target && rng.rand() < 0.25) { target.stunned = (target.stunned || 0) + 1; pushLog('💫 ' + target.name + ' atordoado.'); }" },
  "eff010": { "id": "eff010", "name": "Silence", "type": "onAttackStart", "valueBase": 0.20, "valuePerLevel": 0.02, "level": 10, "xpBase": 300, "xpMax": 300, "desc": "20% chance to silence the target.", "action": "if(target && rng.rand() < 0.20) { target.silenced = true; pushLog('🔇 ' + target.name + ' silenciado.'); }" },
  "eff011": { "id": "eff011", "name": "Evade", "type": "afterDefense", "valueBase": 0.40, "valuePerLevel": 0.04, "level": 10, "xpBase": 400, "xpMax": 400, "desc": "40% chance to evade incoming attacks.", "action": "card.evadeChance = 0.40; pushLog('💨 Chance de Evasão aumentada para 40%.');" },
  "eff012": { "id": "eff012", "name": "Revive", "type": "afterDefense", "valueBase": 1, "valuePerLevel": 0, "level": 10, "xpBase": 1000, "xpMax": 1000, "desc": "Revives 1 ally from the graveyard at full HP.", "action": "pushLog('🔄 Reviver: Necessita lógica de sistema complexa (Placeholder).');" },
  "eff013": { "id": "eff013", "name": "Sacrifice Steal Power", "type": "onAttackStart", "valueBase": 0.70, "valuePerLevel": 0, "level": 10, "xpBase": 1200, "xpMax": 1200, "desc": "Sacrifices the strongest ally to gain 70% of its attack.", "action": "if(allies.length > 1){ const strongest = allies.slice().sort((a, b) => b.attack - a.attack)[0]; if(strongest && strongest.id !== card.id) { const powerGain = strongest.attack * 0.70; card.attack += powerGain; strongest.hp = 0; pushLog('🔪 Sacrifício: '+strongest.name+' fortaleceu '+card.name+' (+'+powerGain.toFixed(0)+').'); } }" },
  "eff014": { "id": "eff014", "name": "Grave Lock", "type": "afterTurn", "valueBase": 1, "valuePerLevel": 0, "level": 10, "xpBase": 800, "xpMax": 800, "desc": "Blocks the graveyard while alive.", "action": "pushLog('🔒 Bloqueio de Cemitério Ativo (Passivo de Sistema).');" },
  "eff015": { "id": "eff015", "name": "Combo Boost", "type": "onAttackStart", "valueBase": 0.10, "valuePerLevel": 0.02, "level": 10, "xpBase": 500, "xpMax": 500, "desc": "Gains 10% attack per card of the same type on the field.", "action": "const count = owner.field.filter(a => a.type === card.type).length; const boost = 1 + 0.10 * count; card.attack *= boost; pushLog('⚡ Combo: Ataque Buffado por ' + (boost*100-100).toFixed(0) + '%.');" },
  "eff016": { "id": "eff016", "name": "Reflect", "type": "onHit", "valueBase": 0.25, "valuePerLevel": 0.03, "level": 10, "xpBase": 400, "xpMax": 400, "desc": "Reflects 25% of damage received.", "action": "if(attacker && damage > 0) { const reflected = damage * 0.25; attacker.hp = Math.max(0, attacker.hp - reflected); pushLog('↩️ ' + card.name + ' refletiu ' + reflected.toFixed(0) + ' dano em ' + attacker.name + '.'); }" },
  "eff017": { "id": "eff017", "name": "Bleed", "type": "onAttackStart", "valueBase": 0.08, "valuePerLevel": 0.02, "level": 10, "xpBase": 300, "xpMax": 300, "desc": "Causes light bleeding to the target.", "action": "if(target){ target.status = target.status||{}; target.status.bleed = (target.status.bleed||0)+1; pushLog('🩸 ' + target.name + ' sangrando.'); }" },
  "eff018": { "id": "eff018", "name": "Rage Boost", "type": "afterDefense", "valueBase": 0.25, "valuePerLevel": 0.03, "level": 10, "xpBase": 400, "xpMax": 400, "desc": "Gains 25% attack when hit.", "action": "card.attack *= 1.25; pushLog('💥 Fúria: Ataque +25%.');" },
  "eff019": { "id": "eff019", "name": "Regen", "type": "onTurnEnd", "valueBase": 0.20, "valuePerLevel": 0.03, "level": 10, "xpBase": 300, "xpMax": 300, "desc": "Regenerates 20% of HP each turn.", "action": "const heal = card.maxHp * 0.20; card.hp += heal; if(card.hp > card.maxHp) card.hp = card.maxHp; pushLog('💚 Regeneração de ' + heal.toFixed(0) + ' HP.');" },
  "eff020": { "id": "eff020", "name": "Frost", "type": "onAttackStart", "valueBase": 0.15, "valuePerLevel": 0.02, "level": 10, "xpBase": 250, "xpMax": 250, "desc": "15% chance to freeze the target.", "action": "if(target && rng.rand() < 0.15) { target.stunned = (target.stunned || 0) + 1; pushLog('❄️ ' + target.name + ' congelado.'); }" },
  "eff021": { "id": "eff021", "name": "Curse", "type": "onHit", "valueBase": 0.12, "valuePerLevel": 0.02, "level": 10, "xpBase": 300, "xpMax": 300, "desc": "Curses attacker to receive continuous damage.", "action": "if(attacker){ attacker.status = attacker.status||{}; attacker.status.curse = true; pushLog('😈 ' + attacker.name + ' amaldiçoado.'); }" },
  "eff022": { "id": "eff022", "name": "Siphon Life", "type": "onAttackStart", "valueBase": 0.30, "valuePerLevel": 0.04, "level": 10, "xpBase": 500, "xpMax": 500, "desc": "Steals 30% of damage dealt as healing.", "action": "if(target){ const dmg = card.attack; const heal = dmg * 0.30; card.hp = Math.min(card.maxHp, card.hp + heal); pushLog('🩸 Sifão de Vida: Curado em ' + heal.toFixed(0) + ' HP.'); }" },
  "eff023": { "id": "eff023", "name": "Bravery", "type": "onTurnStart", "valueBase": 0.20, "valuePerLevel": 0.03, "level": 10, "xpBase": 350, "xpMax": 350, "desc": "Increases your attack by 20% when starting the turn.", "action": "owner.field.forEach(c => c.attack *= 1.20); pushLog('✨ Coragem: Ataque Buffado para todos os aliados.');" },
  "eff024": { "id": "eff024", "name": "Mirror Shield", "type": "onHit", "valueBase": 0.30, "valuePerLevel": 0.03, "level": 10, "xpBase": 400, "xpMax": 400, "desc": "Reflects 30% of damage received.", "action": "if(attacker && damage > 0) { const reflected = damage * 0.30; attacker.hp = Math.max(0, attacker.hp - reflected); pushLog('🛡️ Reflexão: ' + card.name + ' devolveu ' + reflected.toFixed(0) + ' dano.'); }" },
  "eff025": { "id": "eff025", "name": "Berserk", "type": "onTurnEnd", "valueBase": 0.50, "valuePerLevel": 0.05, "level": 10, "xpBase": 800, "xpMax": 800, "desc": "Increases 50% attack when HP < 30%.", "action": "if(card.hp < card.maxHp * 0.3) { card.attack *= 1.5; pushLog('👹 Berserk: Ataque +50%.'); }" },
  "eff026": { "id": "eff026", "name": "Holy Aura", "type": "onTurnEnd", "valueBase": 0.15, "valuePerLevel": 0.03, "level": 10, "xpBase": 400, "xpMax": 400, "desc": "Heals all living allies by 15% per turn.", "action": "owner.field.forEach(t=>{ if(t.hp>0){ const heal = t.maxHp*0.15; t.hp+=heal; if(t.hp>t.maxHp) t.hp=t.maxHp; pushLog('✨ Aura Sagrada: '+t.name+' curado em ' + heal.toFixed(0)); } });" },
  "eff027": { "id": "eff027", "name": "Dark Link", "type": "onAttackStart", "valueBase": 0.50, "valuePerLevel": 0, "level": 10, "xpBase": 1000, "xpMax": 1000, "desc": "Sacrifices 1 ally and gains 50% of its power.", "action": "if(allies.length > 1){ const ally = allies.find(a => a.hp > 0 && a.id !== card.id); if(ally){ const powerGain = ally.attack*0.5; card.attack+=powerGain; ally.hp=0; pushLog('🔪 Link Sombrio: '+ally.name+' sacrificado para dar +'+powerGain.toFixed(0)+' Ataque.'); } }" },
  "eff028": { "id": "eff028", "name": "Grave Blessing", "type": "afterDefense", "valueBase": 1, "valuePerLevel": 0, "level": 10, "xpBase": 1000, "xpMax": 1000, "desc": "Revives 1 random ally after defending.", "action": "pushLog('🔄 Benção: Reviver requer lógica de sistema (Placeholder).');" },
  "eff029": { "id": "eff029", "name": "Phoenix Soul", "type": "onDeath", "valueBase": 1, "valuePerLevel": 0, "level": 10, "xpBase": 1200, "xpMax": 1200, "desc": "Revives automatically once upon death.", "action": "card.status = card.status||{}; if(!card.status.reviveUsed){ card.hp = card.maxHp; card.status.reviveUsed=true; pushLog('🔥 ' + card.name + ' renasceu da cinzas!'); }" },
  "eff030": { "id": "eff030", "name": "Skip Enemy Turn", "type": "onAttackStart", "valueBase": 0.20, "valuePerLevel": 0.02, "level": 10, "xpBase": 500, "xpMax": 500, "desc": "20% chance to make the enemy skip their next turn.", "action": "if(rng.rand() < 0.20) { opponent.status = opponent.status||{}; opponent.status.skipTurn=true; pushLog('🚫 Turno do oponente ignorado!'); }" },
  "eff031": { "id": "eff031", "name": "Auto Attack Guardian", "type": "onTurnEnd", "valueBase": 1, "valuePerLevel": 0, "level": 10, "xpBase": 800, "xpMax": 800, "desc": "Automatically attacks the Guardian each turn.", "action": "if(opponent.guardian){ opponent.guardian.hp = Math.max(0, opponent.guardian.hp - card.attack); pushLog('🎯 '+card.name+' atacou Guardião por '+card.attack.toFixed(0)); }" },
  "eff032": { "id": "eff032", "name": "Freeze Enemy", "type": "onAttackStart", "valueBase": 0.25, "valuePerLevel": 0.03, "level": 10, "xpBase": 600, "xpMax": 600, "desc": "25% chance to freeze the enemy, skipping their next action.", "action": "if(target && rng.rand() < 0.25) { target.stunned = (target.stunned || 0) + 1; pushLog('🥶 ' + target.name + ' congelado.'); }" },
  "eff033": { "id": "eff033", "name": "Damage Over Time", "type": "onAttackStart", "valueBase": 0.10, "valuePerLevel": 0.02, "level": 10, "xpBase": 400, "xpMax": 400, "desc": "Deals 10% of your attack as damage over 3 turns.", "action": "if(target){ owner.overTime.push({ id: 'dot_eff', name: 'DOT', value: card.attack * 0.10, turns: 3, targetId: target.uniqueId }); pushLog('⏳ Dano por tempo aplicado.'); }" },
  "eff034": { "id": "eff034", "name": "Counter Attack", "type": "onHit", "valueBase": 0.30, "valuePerLevel": 0.03, "level": 10, "xpBase": 500, "xpMax": 500, "desc": "Reflects 30% of incoming damage immediately.", "action": "if(attacker && damage > 0) { const reflected = damage * 0.30; attacker.hp = Math.max(0, attacker.hp - reflected); pushLog('↩️ Contra-Ataque: ' + reflected.toFixed(0) + ' dano em ' + attacker.name + '.'); }" },
  "eff035": { "id": "eff035", "name": "Increase Defense", "type": "afterDefense", "valueBase": 0.30, "valuePerLevel": 0.03, "level": 10, "xpBase": 400, "xpMax": 400, "desc": "Increases your defense by 30% after being attacked.", "action": "card.defense *= 1.30; pushLog('🛡️ Defesa aumentada em 30%.');" },
  "eff036": { "id": "eff036", "name": "Life Link", "type": "onHit", "valueBase": 0.25, "valuePerLevel": 0.03, "level": 10, "xpBase": 500, "xpMax": 500, "desc": "Shares 25% of damage taken among allies.", "action": "if(damage > 0 && allies.length > 0){ const share = damage * 0.25 / allies.length; owner.field.forEach(a=>{ if(a.hp > 0 && a.id !== card.id) a.hp = Math.max(0, a.hp - share); }); pushLog('🔗 Dano compartilhado: ' + share.toFixed(0) + ' a cada aliado.'); }" },
  "eff037": { "id": "eff037", "name": "Self Destruct", "type": "onAttackStart", "valueBase": 0.50, "valuePerLevel": 0, "level": 10, "xpBase": 1000, "xpMax": 1000, "desc": "Sacrifices self to deal 50% attack to all enemies.", "action": "const aoeDmg = card.attack * 0.5; opponent.field.forEach(e=>{ if(e.hp > 0) e.hp = Math.max(0, e.hp - aoeDmg); }); if(opponent.guardian) opponent.guardian.hp = Math.max(0, opponent.guardian.hp - aoeDmg); card.hp=0; pushLog('💣 AUTO-DESTRUIÇÃO! Dano em área de ' + aoeDmg.toFixed(0) + '.');" },
  "eff038": { "id": "eff038", "name": "Armor Break", "type": "onAttackStart", "valueBase": 0.20, "valuePerLevel": 0.03, "level": 10, "xpBase": 500, "xpMax": 500, "desc": "Reduces enemy defense by 20%.", "action": "if(target){ target.defense = Math.max(0, target.defense * 0.80); pushLog('🔨 Defesa de ' + target.name + ' reduzida.'); }" },
  "eff039": { "id": "eff039", "name": "Double Strike", "type": "onAttackStart", "valueBase": 2, "valuePerLevel": 0, "level": 10, "xpBase": 800, "xpMax": 800, "desc": "Attacks twice in one turn.", "action": "if(target){ target.hp = Math.max(0, target.hp - card.attack); pushLog('⚔️ Golpe Duplo ativado!'); }" },
  "eff040": { "id": "eff040", "name": "Magic Shield", "type": "onDefense", "valueBase": 0.40, "valuePerLevel": 0.03, "level": 10, "xpBase": 600, "xpMax": 600, "desc": "Absorbs 40% of magical damage received.", "action": "pushLog('✨ Escudo Mágico (Requer tipo de dano - Placeholder).');" },
  "eff041": { "id": "eff041", "name": "Silence Aura", "type": "onTurnEnd", "valueBase": 0.15, "valuePerLevel": 0.02, "level": 10, "xpBase": 500, "xpMax": 500, "desc": "15% chance to silence all enemies at the end of your turn.", "action": "opponent.field.forEach(e=>{ if(e.hp > 0 && rng.rand() < 0.15) { e.silenced = true; pushLog('🔇 Aura: ' + e.name + ' silenciado.'); } });" },
  "eff042": { "id": "eff042", "name": "Burn Aura", "type": "onTurnEnd", "valueBase": 0.10, "valuePerLevel": 0.02, "level": 10, "xpBase": 400, "xpMax": 400, "desc": "Deals 10% attack as burn damage to all enemies at the end of turn.", "action": "const aoeDmg = card.attack * 0.10; opponent.field.forEach(e=>{ if(e.hp > 0) e.hp = Math.max(0, e.hp - aoeDmg); }); if(opponent.guardian) opponent.guardian.hp = Math.max(0, opponent.guardian.hp - aoeDmg); pushLog('🔥 Aura: Dano por queimação em área.');" },
  "eff043": { "id": "eff043", "name": "Vampiric Aura", "type": "onTurnEnd", "valueBase": 0.20, "valuePerLevel": 0.03, "level": 10, "xpBase": 500, "xpMax": 500, "desc": "Heals 20% of damage dealt to all enemies.", "action": "let totalHeal = 0; const drainDmg = card.attack * 0.2; opponent.field.forEach(e=>{ if(e.hp > 0) { e.hp = Math.max(0, e.hp - drainDmg); totalHeal += drainDmg; } }); card.hp = Math.min(card.maxHp, card.hp + totalHeal); pushLog('🩸 Aura: Drenou ' + totalHeal.toFixed(0) + ' HP.');" },
  "eff044": { "id": "eff044", "name": "Curse Aura", "type": "onTurnEnd", "valueBase": 0.10, "valuePerLevel": 0.02, "level": 10, "xpBase": 400, "xpMax": 400, "desc": "Curses all attackers to take 10% of their max HP as damage each turn.", "action": "pushLog('😈 Aura: Maldição (Requer estado de atacante - Placeholder).');" },
  "eff045": { "id": "eff045", "name": "Poison Aura", "type": "onTurnEnd", "valueBase": 0.08, "valuePerLevel": 0.02, "level": 10, "xpBase": 400, "xpMax": 400, "desc": "Applies poison damage to all enemies every turn.", "action": "opponent.overTime.push({ id: 'poison_aura', name: 'Veneno Aura', value: 15, turns: 2 }); pushLog('🧪 Aura de Veneno aplicada no oponente.');" },
  "eff046": { "id": "eff046", "name": "Life Drain", "type": "onAttackStart", "valueBase": 0.30, "valuePerLevel": 0.03, "level": 10, "xpBase": 500, "xpMax": 500, "desc": "Steals 30% of damage dealt as HP.", "action": "if(target){ const heal = card.attack * 0.30; card.hp = Math.min(card.maxHp, card.hp + heal); pushLog('🩸 Dreno de Vida: Curado em ' + heal.toFixed(0) + ' HP.'); }" },
  "eff047": { "id": "eff047", "name": "Counterspell", "type": "onHit", "valueBase": 0.25, "valuePerLevel": 0.03, "level": 10, "xpBase": 500, "xpMax": 500, "desc": "25% chance to block enemy spell effects.","action":"pushLog('✨ Contra-Feitiço (Requer sistema de feitiços - Placeholder).');"},
  "eff048": { "id": "eff048", "name": "Mana Burn", "type": "onAttackStart", "valueBase": 0.20, "valuePerLevel": 0.03, "level": 10, "xpBase": 400, "xpMax": 400, "desc": "Burns 20% of target's mana.", "action": "pushLog('🔋 Queima de Mana (Requer sistema de Mana - Placeholder).');" },
};

function getEffectById(id) {
  return EFFECT_DEFINITIONS[id];
}

function getCardTemplate(id) {
  return null; // Mocked
}
// --- FIM: DEFINIÇÕES DE EFEITOS (Mock para execução autocontida) ---

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

// NOVO: Loga o estado completo do combatente (USADO APENAS NO TURNO 1)
function logCombatantState(combatant, pushLog, isInitialLog = false) {
  if (!isInitialLog) return;
  
  const handNames = combatant.hand.map(c => `${c.name} (T: ${c.turnTime})`);
  const fieldNames = combatant.field.map(c => `${c.name} (HP: ${Math.max(0, Number(c.hp) || 0)})`);
  
  pushLog(`📋 Estado de ${combatant.nameForLog}:`);
  pushLog(`  Mão [${combatant.hand.length}/${MAX_HAND_SIZE}]: ${handNames.join(', ') || 'Vazia'}`);
  pushLog(`  Campo [${combatant.field.length}]: ${fieldNames.join(', ') || 'Vazio'}`);
  if (combatant.guardian) {
    pushLog(`  Guardião: ${combatant.guardian.name} (HP: ${Math.max(0, Number(combatant.guardian.hp) || 0)}, Raiva: ${combatant.rage}/${combatant.rageMax})`);
  }
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
        // FIX CRÍTICO: Injeção de Contexto para string effects
        const allies = owner.field.filter(c => (Number(c.hp) || 0) > 0);
        const enemies = opponent ? opponent.field.filter(c => (Number(c.hp) || 0) > 0) : [];

        // Injeta todas as variáveis necessárias para as strings de efeito
        const fn = new Function(
          "card", "owner", "opponent", "pushLog", "rng", 
          "target", "attacker", "damage", "allies", "enemies",
          effect.action // O script JS real
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
      
      // ESTÉTICA: Frase dramática ao morrer
      const isCompletelyDefeated = sumHP(combatant.field) <= 0 && sumHP(combatant.hand) <= 0;
      if (isCompletelyDefeated) {
        pushLog(`💔 ${combatant.guardian.name}: Eu não tenho mais nenhuma carta... mas isso não é uma derrota. É apenas o começo. 💔`);
      }
      
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
  if (!combatant || combatant.deck.length === 0) return null; // Remove check for MAX_HAND_SIZE
  
  // Condição para logar o draw (apenas se a mão não estiver cheia)
  if (combatant.hand.length >= MAX_HAND_SIZE) {
    // Não puxa, mas também não loga nada, mantendo o silêncio.
    return null; 
  }

  const card = combatant.deck.shift();
  combatant.hand.push(card);
  // Logamos apenas se a carta foi puxada
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
  
  // REGRA: Vitória por Limpeza Total (Guardião + Campo + Mão)
  const p1Alive = sumHP(player1.field) > 0 || sumHP(player1.hand) > 0 || (Number(player1.guardian?.hp) || 0) > 0;
  const p2Alive = sumHP(player2.field) > 0 || sumHP(player2.hand) > 0 || (Number(player2.guardian?.hp) || 0) > 0;
  
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

    // 4. onHit (Defensor) - passa atacante, alvo e dano
    runEffectsTrigger("onHit", defender, attacker, targetUnit, pushLog, rng, context);
    checkDeathsAndHandle(defender, pushLog);
    
    // Checa a condição de vitória
    if (checkWinCondition({ player1: attacker, player2: defender })) return;
    
    // 5. afterAttack (Atacante) - passa alvo e dano
    runEffectsTrigger("afterAttack", attacker, defender, attackCard, pushLog, rng, context);
    
    // 6. afterDefense (Defensor) - passa atacante, alvo e dano
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
    
    // Loga o estado do atacante e defensor APENAS no Turno 1 (Máxima Concisão)
    if (turn === 1) {
        logCombatantState(attacker, pushLog, true);
        logCombatantState(defender, pushLog, true);
    }

    tryActivateGuardianSpecial(attacker, defender, pushLog, rng);
    
    // onTurnStart: Passa contexto vazio
    runEffectsTrigger("onTurnStart", attacker, defender, null, pushLog, rng, {});

    drawCard(attacker, pushLog); // O DrawCard loga a ação internamente
    processTurnTime(attacker, pushLog);

    resolveAttacks(attacker, defender, pushLog, rng);
    
    // Checa a condição de vitória após ataques
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
  
  // Nenhuma mensagem de log final, dependemos do sistema externo para exibir o resultado.

  return {
    win: finalWinner === "player",
    winner: finalWinner,
    turns: Math.min(turn, maxTurns),
    log,
    final: { player: A, opponent: B },
    rewards,
  };
}