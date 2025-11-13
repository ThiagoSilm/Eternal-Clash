// src/systems/effectSystem.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const effectsPath = path.join(__dirname, "../../data/effects.json");
const effects = JSON.parse(fs.readFileSync(effectsPath, "utf-8"));

/**
 * Ativa efeitos de uma carta conforme o evento.
 */
export async function triggerEffects(owner, trigger, log, attacker, defender) {
  if (!owner.cards) return;
  
  for (const card of owner.cards) {
    if (!card.effects || card.hp <= 0 || card.silenced) continue;
    
    for (const effId of card.effects) {
      const eff = effects.find(e => e.id === effId && e.type === trigger);
      if (!eff) continue;
      
      // Checagem de chance
      if (eff.chance && Math.random() > eff.chance) continue;
      
      switch (eff.effect) {
        // ======= 💪 Buffs =======
        case "buffAttack": {
          const bonus = Math.round((card.attack || 100) * eff.value);
          card.attack += bonus;
          log.push(`⚔️ ${card.name} ganhou +${bonus} de ataque (${eff.desc})`);
          break;
        }
        
        case "buffDefense": {
          card.defense = (card.defense || 0) + Math.round(eff.value * 100);
          log.push(`🛡️ ${card.name} fortaleceu sua defesa (${eff.desc})`);
          break;
        }
        
        // ======= 💔 Debuffs =======
        case "burn": {
          const target = defender.cards?.[0];
          if (!target) break;
          const dmg = Math.round(card.attack * eff.value);
          addOverTime(defender, "burn", dmg, 2, card.name);
          log.push(`🔥 ${target.name} foi queimado e sofrerá ${dmg} de dano por 2 turnos.`);
          break;
        }
        
        case "poison": {
          const target = defender.cards?.[0];
          if (!target) break;
          const dmg = Math.round((card.attack || 100) * eff.value);
          addOverTime(defender, "poison", dmg, 3, card.name);
          log.push(`☠️ ${target.name} foi envenenado (${dmg}/turno).`);
          break;
        }
        
        // ======= ❤️ Suporte =======
        case "heal": {
          const heal = Math.round((card.maxHp || 200) * eff.value);
          card.hp = Math.min(card.maxHp || 200, card.hp + heal);
          log.push(`💚 ${card.name} se curou em ${heal} HP (${eff.desc})`);
          break;
        }
        
        case "shield": {
          card.shield = (card.shield || 0) + Math.round(eff.value * 200);
          log.push(`🧱 ${card.name} ergueu um escudo de ${Math.round(eff.value * 200)} HP (${eff.desc})`);
          break;
        }
        
        // ======= ☠️ Controle =======
        case "stun": {
          const target = defender.cards?.[0];
          if (!target) break;
          target.stunned = 1;
          log.push(`💫 ${target.name} foi atordoado e perde o próximo turno!`);
          break;
        }
        
        case "silence": {
          const target = defender.cards?.[0];
          if (!target) break;
          target.silenced = true;
          log.push(`🔇 ${target.name} teve seus efeitos bloqueados!`);
          break;
        }
        
        // ======= ⚗️ Sorte =======
        case "evade": {
          card.evadeChance = eff.value; // ex: 0.4 = 40%
          log.push(`💨 ${card.name} agora tem ${eff.value * 100}% de chance de esquivar ataques.`);
          break;
        }
        
        // ======= ⚰️ Ressurreição =======
        case "reviveOne": {
          if (owner.graveyardLocked) {
            log.push(`🚫 ${card.name} tentou reviver, mas o cemitério está bloqueado.`);
            break;
          }
          if (!owner.graveyard || owner.graveyard.length === 0) break;
          const revived = owner.graveyard.pop();
          revived.hp = revived.maxHp || 200;
          owner.cards.push(revived);
          log.push(`✨ ${card.name} reviveu ${revived.name} com 100% do HP.`);
          break;
        }
        
        case "reviveTwo": {
          if (owner.graveyardLocked) {
            log.push(`🚫 ${card.name} tentou reviver, mas o cemitério está bloqueado.`);
            break;
          }
          if (!owner.graveyard || owner.graveyard.length === 0) break;
          const revived = owner.graveyard.splice(-2).map(c => ({
            ...c,
            hp: c.maxHp || 200
          }));
          owner.cards.push(...revived);
          log.push(`🌟 ${card.name} reviveu ${revived.length} cartas com HP total.`);
          break;
        }
        
        // ======= 💀 Sacrifício =======
        case "sacrificeStealPower": {
          const target = owner.cards
            .filter(c => c !== card && c.hp > 0)
            .sort((a, b) => (b.attack || 0) - (a.attack || 0))[0];
          if (!target) break;
          
          const bonus = Math.round((target.attack || 0) * (eff.value || 0.7));
          card.attack += bonus;
          log.push(`🩸 ${card.name} sacrificou ${target.name} e absorveu ${bonus} de ataque!`);
          
          if (!owner.graveyard) owner.graveyard = [];
          owner.graveyard.push({ ...target, hp: 0 });
          owner.cards = owner.cards.filter(c => c !== target);
          break;
        }
        
        // ======= 🔒 Cemitério =======
        case "graveLock": {
          owner.graveyardLocked = true;
          log.push(`🪦 ${card.name} bloqueou o cemitério. Nenhum aliado pode ser revivido enquanto viver.`);
          break;
        }
        
        // ======= 🧬 Combos =======
        case "comboBoost": {
          const sameTypeCount = owner.cards.filter(c => c.type === card.type && c.hp > 0).length;
          const boost = sameTypeCount * eff.value;
          card.attack = Math.round(card.attack * (1 + boost));
          log.push(`⚡ Combo ativo! ${card.name} ganhou ${boost * 100}% de ataque (${sameTypeCount} cartas do mesmo tipo).`);
          break;
        }
        
        default:
          log.push(`❔ Efeito desconhecido: ${eff.effect}`);
      }
      
      // Evita continuar aplicando se a carta morreu no meio
      if (card.hp <= 0) break;
      await delay(50); // micro delay pra garantir ordem
    }
  }
}

/**
 * Aplica efeitos contínuos (burn, poison etc.)
 * Agora eles só agem no turno do dono.
 */
export async function processOverTimeEffects(owner, log, phase = "turnStart") {
  if (!owner.overTime || owner.overTime.length === 0) return false;
  let triggered = false;
  const remaining = [];
  
  if (phase !== "turnStart") return false;
  
  for (const eff of owner.overTime) {
    if (eff.turns > 0) {
      const target = owner.cards.find(c => c.hp > 0);
      if (!target) continue;
      
      target.hp = Math.max(0, target.hp - eff.value);
      eff.turns -= 1;
      triggered = true;
      log.push(`☠️ ${target.name} sofreu ${eff.value} de dano (${eff.type}) de ${eff.source}.`);
      await delay(100);
    }
    
    if (eff.turns > 0) remaining.push(eff);
  }
  
  owner.overTime = remaining;
  return triggered;
}

function addOverTime(owner, type, value, turns, source) {
  if (!owner.overTime) owner.overTime = [];
  owner.overTime.push({ type, value, turns, source });
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}