// src/systems/battleSimulator.js
import { triggerEffects } from "./effectSystem.js";

export function simulateBattle(attacker, defender) {
  const log = [`⚔️ **Batalha iniciada entre ${attacker.name || "Atacante"} e ${defender.name || "Defensor"}!**`];
  const state = {
    attacker: initCombatant(attacker),
    defender: initCombatant(defender),
    turn: 1
  };
  
  while (state.attacker.hp > 0 && state.defender.hp > 0 && state.turn <= 30) {
    log.push(`\n🌀 **Turno ${state.turn}:** ${state.attacker.name} ataca!`);
    executeTurn(state, log);
    
    const temp = state.attacker;
    state.attacker = state.defender;
    state.defender = temp;
    state.turn++;
  }
  
  const winner = state.attacker.hp > state.defender.hp ? state.attacker : state.defender;
  log.push(`\n🏁 **Fim da batalha!** Vencedor: ${winner.name} com ${winner.hp.toFixed(0)} HP restante.`);
  return { winner: winner === state.attacker ? "attacker" : "defender", log };
}

function executeTurn(state, log) {
  const { attacker, defender } = state;
  
  for (const card of attacker.deck) {
    if (card.hp <= 0) continue;
    
    triggerEffects(attacker, "onAttackStart", log, attacker, defender);
    
    const dmg = calculateDamage(card, defender);
    defender.hp -= dmg;
    log.push(`💥 ${card.name} causou ${dmg.toFixed(0)} de dano (${defender.hp.toFixed(0)} HP restante)`);
    
    triggerEffects(defender, "onHit", log, defender, attacker);
    triggerEffects(attacker, "afterAttack", log, attacker, defender);
    
    if (defender.hp <= 0) {
      log.push(`💀 ${defender.name} foi derrotado!`);
      break;
    }
  }
  
  triggerEffects(attacker, "afterTurn", log, attacker, defender);
  triggerEffects(defender, "afterDefense", log, defender, attacker);
}

function initCombatant(player) {
  const hp = player.deck.reduce((acc, c) => acc + (c.hp || 200) + (c.level || 1) * 20, 0);
  return {
    name: player.name || "Jogador",
    deck: player.deck.map(c => ({ ...c, hp: (c.hp || 200) })),
    hp,
    buffs: [],
    debuffs: []
  };
}

function calculateDamage(card, defender) {
  const base = (card.attack || card.power || 100) * (1 + (card.level || 1) * 0.05);
  const random = 0.9 + Math.random() * 0.2;
  return Math.max(base * random, 0);
}