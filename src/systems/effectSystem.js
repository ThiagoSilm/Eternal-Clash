// src/systems/effectSystem.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const effectsPath = path.join(__dirname, "../data/effects.json");
const effects = JSON.parse(fs.readFileSync(effectsPath, "utf-8"));

/**
 * Ativa todos os efeitos de um jogador que correspondem ao trigger atual.
 * @param {Object} owner - O jogador (player ou opponent).
 * @param {string} trigger - Tipo de evento (onAttackStart, onHit, afterAttack, afterDefense).
 * @param {Array} log - Array para registrar os eventos do turno.
 * @param {Object} attacker - Quem atacou.
 * @param {Object} defender - Quem defende.
 */
export function triggerEffects(owner, trigger, log, attacker, defender) {
  const allCards = owner.cards || [];
  
  for (const card of allCards) {
    if (!card.effects || card.hp <= 0) continue;
    
    for (const effId of card.effects) {
      const eff = effects.find(e => e.id === effId && e.type === trigger);
      if (!eff) continue;
      
      switch (eff.effect) {
        case "buffAttack": {
          const bonus = Math.round(card.attack * eff.value);
          card.attack += bonus;
          log.push(`⚔️ ${card.name} ganhou +${bonus} de ataque (${eff.desc})`);
          break;
        }
        
        case "heal": {
          const healAmount = Math.round(card.hp * eff.value);
          card.hp += healAmount;
          log.push(`💚 ${card.name} se curou em ${healAmount} HP (${eff.desc})`);
          break;
        }
        
        case "reflect": {
          const target = defender.cards?.[0];
          if (!target) break;
          const reflect = Math.round((target.attack || 0) * eff.value);
          target.hp = Math.max(0, target.hp - reflect);
          log.push(`🪞 ${card.name} refletiu ${reflect} de dano em ${target.name} (${eff.desc})`);
          break;
        }
        
        case "burn": {
          const target = defender.cards?.[0];
          if (!target) break;
          const burnDmg = Math.round(card.attack * eff.value);
          if (!defender.overTime) defender.overTime = [];
          defender.overTime.push({
            type: "burn",
            value: burnDmg,
            turns: 2,
            source: card.name
          });
          log.push(`🔥 ${target.name} foi queimado! Sofrerá ${burnDmg} por 2 turnos.`);
          break;
        }
        
        default:
          log.push(`❔ Efeito desconhecido: ${eff.effect}`);
          break;
      }
    }
  }
}

/**
 * Processa efeitos contínuos (ex: queimaduras) que agem ao longo dos turnos.
 * @param {Object} owner - O jogador que tem efeitos ativos sobre suas cartas.
 * @param {Array} log - Array para registrar eventos.
 */
export function processOverTimeEffects(owner, log) {
  if (!owner.overTime || owner.overTime.length === 0) return;
  
  const remaining = [];
  
  for (const eff of owner.overTime) {
    if (eff.turns > 0) {
      const targetCard = owner.cards.find(c => c.hp > 0);
      if (!targetCard) continue;
      
      targetCard.hp = Math.max(0, targetCard.hp - eff.value);
      eff.turns -= 1;
      log.push(`🔥 ${targetCard.name} sofreu ${eff.value} de dano contínuo (${eff.type} de ${eff.source}).`);
    }
    
    if (eff.turns > 0) remaining.push(eff);
  }
  
  owner.overTime = remaining;
}