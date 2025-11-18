// src/systems/effectSystem.js

/**
 * Sistema de efeitos totalmente refeito (expansão)
 * - Adicionado suporte a facções e efeitos condicionais por facção
 * - Exporta helpers para o battleSystem aplicar modificadores de facção
 * - Mantém compatibilidade com a API anterior
 */

import { deepCloneSafe } from "./utils/helpers.js"; // utilitário opcional

/* ----------------- FACÇÕES (4) ----------------- */
export const FACTIONS = {
  Faen: "Faen",
  Gorath: "Gorath",
  Human: "Human",
  Morrath: "Morrath",
};

/* -------------------------------------------------- */
/*                    DEFINIÇÃO BASE                  */
/*  Cada efeito pode opcionalmente ter um campo       */
/*  `againstFaction: { faction: 'Morrath', multiplier: 1.9 }` */
/*  que será aplicado via applyFactionModifiers(...)   */
/* -------------------------------------------------- */

export const EFFECTS = {
  
  buffAttackSmall: {
    id: "buffAttackSmall",
    name: "Buff de Ataque Pequeno",
    desc: "Aumenta o ataque do usuário por 1 turno.",
    trigger: ["onUse", "beforeAttack"],
    scaling: { base: 0.10, perLevel: 0.02 },
    xp: { current: 0, max: 200 },
    action(ctx) {
      const value = getEffectValue(this, ctx.subject.level ?? 1);
      ctx.owner.tempAttackBuff = (ctx.owner.tempAttackBuff || 0) + value;
      ctx.pushLog?.(`🟩 Ataque aumentado em ${Math.round(value * 100)}%`);
    }
  },
  
  // exemplo de efeito com condição por facção (padrão: aplica bônus contra Morrath)
  antiMorrathStrike: {
    id: "antiMorrathStrike",
    name: "Fúria contra Morrath",
    desc: "Aumenta em 90% o dano contra inimigos da facção Morrath.",
    trigger: ["beforeAttack"],
    // configuração específica para uso via applyFactionModifiers
    againstFaction: { faction: FACTIONS.Morrath, multiplier: 1.90 },
    scaling: { base: 0, perLevel: 0 },
    action(ctx) {
      // comportamento secundário opcional: log apenas
      if (ctx.opponent?.faction === FACTIONS.Morrath) ctx.pushLog?.(`🔥 Bônus contra Morrath aplicado por ${ctx.subject.name}`);
    }
  },
  
  burnEffect: {
    id: "burnEffect",
    name: "Burn",
    desc: "Causa dano baseado no ataque do dono a cada início de turno.",
    trigger: ["onTurnStart"],
    scaling: { base: 0.15, perLevel: 0.03 },
    xp: { current: 0, max: 350 },
    condition(ctx) { return ctx.target && ctx.target.hp > 0; },
    action(ctx) {
      const value = getEffectValue(this, ctx.owner.level || 1);
      const burnDmg = Math.floor((ctx.owner.attack || 0) * value);
      ctx.target.hp = Math.max(0, ctx.target.hp - burnDmg);
      ctx.pushLog?.(`🔥 Burn causa ${burnDmg} de dano em ${ctx.target.name}`);
    }
  },
  
  healSmall: {
    id: "healSmall",
    name: "Cura Pequena",
    desc: "Cura 15% do HP máximo.",
    trigger: ["onUse"],
    scaling: { base: 0.15, perLevel: 0.02 },
    xp: { current: 0, max: 180 },
    action(ctx) {
      const value = getEffectValue(this, ctx.owner.level || 1);
      const healAmount = Math.floor((ctx.owner.maxHp || 0) * value);
      ctx.owner.hp = Math.min(ctx.owner.maxHp || 0, (ctx.owner.hp || 0) + healAmount);
      ctx.pushLog?.(`💚 Cura de ${healAmount} aplicada em ${ctx.owner.name}`);
    }
  },
  
  stunEffect: {
    id: "stunEffect",
    name: "Stun",
    desc: "Impossibilita o alvo de agir no próximo turno.",
    trigger: ["onHit"],
    scaling: { base: 1, perLevel: 0 },
    action(ctx) {
      ctx.target.stunned = true;
      ctx.target.stunDuration = 1;
      ctx.pushLog?.(`💫 ${ctx.target.name} ficou atordoado!`);
    }
  },
  
};

/* -------------------------------------------------- */
/*                     UTILIDADES                     */
/* -------------------------------------------------- */

export function getEffect(id) { return EFFECTS[id] || null; }

export function getEffectValue(eff, level = 1) {
  if (!eff || !eff.scaling) return 0;
  return (eff.scaling.base || 0) + (eff.scaling.perLevel || 0) * Math.max(0, level - 1);
}

/**
 * Executa um único efeito (seguro)
 */
export function executeEffect(eff, ctx) {
  if (!eff || !ctx) return false;
  try {
    if (typeof eff.condition === "function" && !eff.condition(ctx)) return false;
    if (typeof eff.action === "function") eff.action(ctx);
    if (eff.xp) eff.xp.current = Math.min(eff.xp.max || eff.xp.current, (eff.xp.current || 0) + 1);
    return true;
  } catch (err) {
    ctx.pushLog?.(`⚠️ ERRO executando ${eff.id}: ${err.message}`);
    return false;
  }
}

/**
 * Aplica modificadores de facção baseado em effects presentes no atacante (ou em perks)
 * - procura efeitos que tenham `againstFaction` e aplica multiplier quando corresponder
 * - retorna { damage: Number, reasons: Array<string> }
 */
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
  
  // perks on attacker can also contain faction bonuses (backwards compat)
  if (Array.isArray(attacker.perks)) {
    for (const p of attacker.perks) {
      if (p.againstFaction === defender.faction && p.multiplier) {
        dmg = Math.floor(dmg * p.multiplier);
        reasons.push(`perk:${p.id||p.type}@${p.multiplier}`);
      }
    }
  }
  
  return { damage: dmg, reasons };
}

/**
 * Verifica se uma entidade possui efeito específico voltado para uma facção
 */
export function entityHasFactionEffect(entity, faction) {
  if (!entity || !Array.isArray(entity.effects)) return false;
  return entity.effects.some(id => EFFECTS[id] && EFFECTS[id].againstFaction && EFFECTS[id].againstFaction.faction === faction);
}

/**
 * Dispara todos os efeitos de um tipo de trigger
 * - owner/opponent são entidades (player/enemy)
 * - extraCtx é opcional (ex: { target, damage, card })
 * - pushLog é opcional
 */
export function runEffectsTrigger(trigger, owner, opponent, extraCtx = {}, pushLog = () => {}) {
  if (!owner || typeof owner !== "object") return;
  const entities = [
    ...(owner.field || []),
    ...(owner.hand || []),
    ...(owner.graveyard || []),
  ];
  if (owner.guardian) entities.push(owner.guardian);
  
  for (const subject of entities) {
    if (!subject || !Array.isArray(subject.effects)) continue;
    for (const effId of subject.effects) {
      const eff = EFFECTS[effId];
      if (!eff) { pushLog?.(`⚠️ Efeito inválido: ${effId}`); continue; }
      if (!Array.isArray(eff.trigger) || !eff.trigger.includes(trigger)) continue;
      
      const ctx = {
        subject,
        owner,
        opponent,
        target: extraCtx?.target || opponent,
        ...deepCloneSafe(extraCtx || {}),
        pushLog,
      };
      
      executeEffect(eff, ctx);
    }
  }
}