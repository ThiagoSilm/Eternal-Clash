// src/systems/effectSystem.js
//------------------------------------------------------------
// EFFECT SYSTEM AVANÇADO COM FASES DE BATALHA
// Executor unificado de todos os efeitos (Cartas + Guardiões)
// Fases: Buff/Debuff → Dano/Ataque → Habilidades Especiais
//------------------------------------------------------------

import { deepCloneSafe } from "./utils/helpers.js";
import { EFFECTS, runEffect as runCardEffect } from "./src/config/effects.js";
import { GUARDIAN_EFFECTS, runGuardianEffect } from "./src/config/guardianEffects.js";

/* ----------------- FACÇÕES ----------------- */
export const FACTIONS = {
  Faen: "Faen",
  Gorath: "Gorath",
  Human: "Human",
  Morrath: "Morrath",
};

/* ----------------- UTILIDADES ----------------- */
export function getEffectValue(eff, level = 1) {
  if (!eff || !eff.scaling) return 0;
  return (eff.scaling.base || 0) + (eff.scaling.perLevel || 0) * Math.max(0, level - 1);
}

/* ----------------- EXECUTOR UNIFICADO ----------------- */
function executeEffect(id, ctx) {
  if (EFFECTS[id]) runCardEffect(id, ctx);
  else if (GUARDIAN_EFFECTS[id]) runGuardianEffect(id, ctx);
  else console.warn(`[effectSystem] Efeito não encontrado: ${id}`);
}

/* ----------------- RUN TRIGGER COM FASES ----------------- */
export function runEffectsTrigger(trigger, owner, opponent, extraCtx = {}, pushLog = () => {}) {
  if (!owner || typeof owner !== "object") return;
  
  const entities = [
    ...(owner.field || []),
    ...(owner.hand || []),
    ...(owner.graveyard || []),
  ];
  if (owner.guardian) entities.push(owner.guardian);
  
  const phaseQueues = {
    buff: [],
    damage: [],
    special: [],
  };
  
  // Categoriza efeitos por fase
  for (const subject of entities) {
    if (!subject || !Array.isArray(subject.effects)) continue;
    
    for (const effId of subject.effects) {
      const eff = EFFECTS[effId] || GUARDIAN_EFFECTS[effId];
      if (!eff) {
        pushLog?.(`⚠️ Efeito inválido: ${effId}`);
        continue;
      }
      if (EFFECTS[effId] && (!Array.isArray(eff.trigger) || !eff.trigger.includes(trigger))) continue;
      
      const phase = eff.phase || (GUARDIAN_EFFECTS[effId] ? 'special' : 'damage');
      phaseQueues[phase].push({ effId, subject });
    }
  }
  
  // Executa cada fase em ordem
  for (const phase of ['buff', 'damage', 'special']) {
    for (const { effId, subject } of phaseQueues[phase]) {
      const ctx = {
        subject,
        owner,
        opponent,
        target: extraCtx?.target || opponent,
        allies: extraCtx?.allies || owner.field || [],
        enemies: extraCtx?.enemies || opponent?.field || [],
        ...deepCloneSafe(extraCtx),
        pushLog,
      };
      executeEffect(effId, ctx);
    }
  }
}

/* ----------------- MODIFICADORES DE FACÇÃO ----------------- */
export function applyFactionModifiers(attacker, defender, baseDamage) {
  let dmg = baseDamage || 0;
  const reasons = [];
  if (!attacker || !defender) return { damage: dmg, reasons };
  
  const effIds = Array.isArray(attacker.effects) ? attacker.effects : [];
  for (const id of effIds) {
    const eff = EFFECTS[id];
    if (!eff || !eff.againstFaction) continue;
    const cfg = eff.againstFaction;
    if (cfg.faction && cfg.faction === defender.faction) {
      const mult = typeof cfg.multiplier === "number" ? cfg.multiplier : 1;
      dmg = Math.floor(dmg * mult);
      reasons.push(`effect:${eff.id}@${mult}`);
    }
  }
  
  if (Array.isArray(attacker.perks)) {
    for (const p of attacker.perks) {
      if (p.againstFaction === defender.faction && p.multiplier) {
        dmg = Math.floor(dmg * p.multiplier);
        reasons.push(`perk:${p.id || p.type}@${p.multiplier}`);
      }
    }
  }
  
  return { damage: dmg, reasons };
}

/* ----------------- VERIFICAÇÃO DE FACÇÃO ----------------- */
export function entityHasFactionEffect(entity, faction) {
  if (!entity || !Array.isArray(entity.effects)) return false;
  return entity.effects.some(id => EFFECTS[id]?.againstFaction?.faction === faction);
}