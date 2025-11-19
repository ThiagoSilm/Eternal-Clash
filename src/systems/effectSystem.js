//------------------------------------------------------------
// EFFECT SYSTEM AVANÇADO COM FASES DE BATALHA
// Executor unificado de todos os efeitos (Cartas + Guardiões)
// Fases: Buff/Debuff → Dano/Ataque → Habilidades Especiais
//------------------------------------------------------------

import { deepCloneSafe } from "./utils/helpers.js";
import { EFFECTS, runEffect as runCardEffect } from "../config/effects.js";
import { GUARDIAN_EFFECTS } from "../config/guardianEffects.js";

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
  if (EFFECTS[id]) {
    try {
      runCardEffect(id, ctx);
    } catch (err) {
      console.error(`[effectSystem] Erro ao executar efeito de carta ${id}:`, err);
      ctx.pushLog?.(`❌ Erro no efeito de carta: ${id}`);
    }
  } else if (GUARDIAN_EFFECTS[id]) {
    const eff = GUARDIAN_EFFECTS[id];
    if (typeof eff.effect === "function") {
      try {
        eff.effect(ctx);
      } catch (err) {
        console.error(`[effectSystem] Erro ao executar efeito de guardião ${id}:`, err);
        ctx.pushLog?.(`❌ Erro no efeito de guardião: ${id}`);
      }
    } else {
      console.warn(`[effectSystem] Guardião sem função: ${id}`);
      ctx.pushLog?.(`⚠️ Guardião sem função: ${id}`);
    }
  } else {
    console.warn(`[effectSystem] Efeito não encontrado: ${id}`);
    ctx.pushLog?.(`⚠️ Efeito não encontrado: ${id}`);
  }
}

/* ----------------- RUN TRIGGER COM FASES PROTEGIDO ----------------- */
export function runEffectsTrigger(trigger, owner, opponent, extraCtx = {}, pushLog = () => {}) {
  if (!owner || typeof owner !== "object") return;
  
  const entities = [
    ...(Array.isArray(owner.field) ? owner.field : []),
    ...(Array.isArray(owner.hand) ? owner.hand : []),
    ...(Array.isArray(owner.graveyard) ? owner.graveyard : []),
  ];
  if (owner.guardian) entities.push(owner.guardian);
  
  const phaseQueues = { buff: [], damage: [], special: [] };
  
  for (const subject of entities) {
    if (!subject || !Array.isArray(subject.effects)) continue;
    
    for (const effId of subject.effects) {
      const eff = EFFECTS[effId] || GUARDIAN_EFFECTS[effId];
      if (!eff) {
        pushLog?.(`⚠️ Efeito inválido: ${effId}`);
        continue;
      }
      
      if (EFFECTS[effId] && Array.isArray(eff.trigger) && !eff.trigger.includes(trigger)) continue;
      
      const phase = eff.phase || (GUARDIAN_EFFECTS[effId] ? "special" : "damage");
      phaseQueues[phase].push({ effId, subject });
    }
  }
  
  for (const phase of ["buff", "damage", "special"]) {
    for (const { effId, subject } of phaseQueues[phase]) {
      const ctx = {
        subject,
        owner,
        opponent,
        target: extraCtx?.target || opponent,
        allies: Array.isArray(extraCtx?.allies) ? extraCtx.allies : (Array.isArray(owner.field) ? owner.field : []),
        enemies: Array.isArray(extraCtx?.enemies) ? extraCtx.enemies : (opponent?.field || []),
        ...deepCloneSafe(extraCtx),
        pushLog,
      };
      
      try {
        executeEffect(effId, ctx);
      } catch (err) {
        console.error(`[effectSystem] Erro ao executar efeito ${effId}:`, err);
        pushLog?.(`❌ Erro no efeito ${effId}`);
      }
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