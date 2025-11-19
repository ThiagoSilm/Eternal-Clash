// src/systems/effects.js

// Cada efeito é uma função pura.
// Apenas armazenamento; o battleSystem chama runEffect(effectId, ctx).

export const EFFECTS = {
  eff001: { fn: ctx => ctx.card.attack *= 1 + ctx.v, phase: 'buff' },
  eff002: { fn: ctx => ctx.card.attack *= 1 + ctx.v, phase: 'buff' },
  eff018: { fn: ctx => ctx.card.attack *= 1 + ctx.v, phase: 'buff' },
  eff023: { fn: ctx => ctx.card.attack *= 1 + ctx.v, phase: 'buff' },
  eff025: { fn: ctx => { if(ctx.card.hp < ctx.card.maxHp * 0.3) ctx.card.attack *= 1.5 }, phase: 'buff' },

  // Defesa
  eff003: { fn: ctx => ctx.card.defense *= 1 + ctx.v, phase: 'buff' },
  eff035: { fn: ctx => ctx.card.defense *= 1 + ctx.v, phase: 'buff' },
  eff038: { fn: ctx => ctx.target && (ctx.target.defense *= 1 - ctx.v), phase: 'damage' },

  // Cura
  eff004: { fn: ctx => heal(ctx.card, ctx.card.maxHp * ctx.v), phase: 'buff' },
  eff005: { fn: ctx => ctx.targets?.forEach(t => heal(t, t.maxHp * ctx.v)), phase: 'buff' },
  eff019: { fn: ctx => heal(ctx.card, ctx.card.maxHp * ctx.v), phase: 'buff' },
  eff026: { fn: ctx => ctx.allies?.forEach(a => a.hp > 0 && heal(a, a.maxHp * ctx.v)), phase: 'buff' },

  // Shield / Block
  eff006: { fn: ctx => ctx.card.shield = (ctx.card.shield || 0) + ctx.card.maxHp * ctx.v, phase: 'buff' },
  effBlock: { fn: ctx => ctx.card.block = true, phase: 'special' },

  // Status
  eff007: { fn: ctx => applyStatus(ctx.target, "burn", 1), phase: 'damage' },
  eff008: { fn: ctx => applyStatus(ctx.target, "poison", 3), phase: 'damage' },
  eff009: { fn: ctx => chance(ctx.v) && applyStatus(ctx.target, "stun", true), phase: 'damage' },
  eff010: { fn: ctx => chance(ctx.v) && applyStatus(ctx.target, "silence", true), phase: 'damage' },
  eff011: { fn: ctx => chance(ctx.v) && applyStatus(ctx.card, "evade", true), phase: 'buff' },
  eff017: { fn: ctx => applyStatus(ctx.target, "bleed", 1), phase: 'damage' },
  eff020: { fn: ctx => chance(ctx.v) && applyStatus(ctx.target, "stun", true), phase: 'damage' },
  eff030: { fn: ctx => chance(ctx.v) && applyStatus(ctx.enemy, "skipTurn", true), phase: 'damage' },
  eff033: { fn: ctx => applyStatus(ctx.target, "dot", { dmg: ctx.card.attack * ctx.v, turns: 3 }), phase: 'damage' },
  eff021: { fn: ctx => applyStatus(ctx.attacker, "curse", true), phase: 'damage' },

  // Revive / Phoenix
  eff012: { fn: ctx => reviveOne(ctx.targets), phase: 'special' },
  eff028: { fn: ctx => reviveRandom(ctx.allies), phase: 'special' },
  eff029: { fn: ctx => phoenix(ctx.card), phase: 'special' },

  // Ataques especiais
  eff039: { fn: ctx => doubleStrike(ctx), phase: 'damage' },
  eff016: { fn: ctx => reflect(ctx), phase: 'damage' },
  eff024: { fn: ctx => reflect(ctx), phase: 'damage' },
  eff034: { fn: ctx => reflect(ctx), phase: 'damage' },
  eff022: { fn: ctx => lifeSteal(ctx), phase: 'damage' },
  eff036: { fn: ctx => lifeLink(ctx), phase: 'damage' },
  eff037: { fn: ctx => selfDestruct(ctx), phase: 'damage' },
  eff031: { fn: ctx => ctx.guardian && (ctx.guardian.hp -= ctx.card.attack), phase: 'damage' },

  // Combo / Estratégia
  eff013: { fn: ctx => stealStrongestAlly(ctx), phase: 'damage' },
  eff015: { fn: ctx => comboBoost(ctx), phase: 'buff' },
  eff027: { fn: ctx => darkLink(ctx), phase: 'damage' },
  eff014: { fn: ctx => ctx.game && (ctx.game.graveLocked = true), phase: 'special' },

  // Buff/Aura
  eff040: { fn: ctx => { if(ctx.card.hp < ctx.card.maxHp * 0.5) ctx.card.attack *= 1.2 }, phase: 'buff' },
  eff041: { fn: ctx => ctx.allies?.forEach(a => a.attack *= 1 + ctx.v), phase: 'buff' },
  eff042: { fn: ctx => ctx.allies?.forEach(a => a.defense *= 1 + ctx.v), phase: 'buff' },
  eff043: { fn: ctx => { if(ctx.target.hp > ctx.card.hp) ctx.extraDamage = (ctx.extraDamage || 0) + ctx.card.attack * ctx.v }, phase: 'damage' },
  eff044: { fn: ctx => chance(ctx.v) && applyStatus(ctx.target, "fear", 1), phase: 'damage' },
  eff045: { fn: ctx => chance(ctx.v) && applyStatus(ctx.target, "silence", 2), phase: 'damage' },
  eff046: { fn: ctx => { ctx.card.attack += ctx.allies?.reduce((sum,a)=>sum+(a.attack||0)*0.1,0) || 0 }, phase: 'buff' },
  eff047: { fn: ctx => ctx.targets?.forEach(t => t.attack *= 1 - ctx.v), phase: 'damage' },
  eff048: { fn: ctx => { if(ctx.card.hp < ctx.card.maxHp * 0.2) selfDestruct(ctx) }, phase: 'damage' },
  eff049: { fn: ctx => doubleStrike(ctx), phase: 'damage' },
  eff050: { fn: ctx => { ctx.card.attack *= 1 + ctx.v; ctx.card.defense *= 1 + ctx.v }, phase: 'buff' },
};

// ---------------------------------------
// UTILITÁRIOS COMPLETAMENTE SEGUROS
// ---------------------------------------
const chance = p => Math.random() < p;

const heal = (t, v) => {
  if (!t) return;
  t.hp = Math.min(t.maxHp, t.hp + v);
};

const applyStatus = (t, k, v) => {
  if (!t) return;
  t.status = { ...t.status, [k]: v };
};

const reviveOne = arr => {
  if (!arr) return;
  const dead = arr.find(a => a.hp <= 0);
  if (dead) dead.hp = dead.maxHp;
};

const reviveRandom = arr => {
  if (!arr) return;
  const dead = arr.filter(a => a.hp <= 0);
  if (dead.length) {
    const pick = dead[Math.floor(Math.random() * dead.length)];
    pick.hp = pick.maxHp;
  }
};

const phoenix = card => {
  if (!card) return;
  card.status = card.status || {};
  if (!card.status.reviveUsed) {
    card.hp = card.maxHp;
    card.status.reviveUsed = true;
  }
};

const reflect = ctx => {
  if (!ctx.attacker || typeof ctx.damage !== "number") return;
  ctx.attacker.hp -= ctx.damage * ctx.v;
};

const lifeSteal = ctx => {
  const dmg = ctx.card.attack;
  ctx.target.hp -= dmg;
  heal(ctx.card, dmg * ctx.v);
};

const comboBoost = ctx => {
  const count = ctx.allies?.filter(a => a.type === ctx.card.type).length || 0;
  ctx.card.attack *= 1 + ctx.v * count;
};

const stealStrongestAlly = ctx => {
  if (!ctx.allies) return;
  const strong = [...ctx.allies].sort((a,b)=>b.attack-b.attack)[0];
  if (strong) { ctx.card.attack += strong.attack * ctx.v; strong.hp = 0; }
};

const darkLink = ctx => {
  const ally = ctx.allies?.find(a => a.hp > 0);
  if (ally) { ctx.card.attack += ally.attack * 0.5; ally.hp = 0; }
};

const lifeLink = ctx => {
  if (!ctx.allies || typeof ctx.damage !== "number") return;
  const share = (ctx.damage * ctx.v) / ctx.allies.length;
  ctx.allies.forEach(a => a.hp -= share);
};

const selfDestruct = ctx => {
  if (!ctx.enemies) return;
  ctx.enemies.forEach(e => e.hp -= ctx.card.attack * 0.5);
  ctx.card.hp = 0;
};

const doubleStrike = ctx => {
  ctx.target.hp -= ctx.card.attack;
  ctx.target.hp -= ctx.card.attack;
};

// ---------------------------------------
// EXECUTOR PRINCIPAL
// ---------------------------------------
export function runEffect(id, context) {
  const eff = EFFECTS[id];
  if (typeof eff === "function") {
    try {
      eff(context);
    } catch(e) {
      console.error(`[effectSystem] Erro ao executar efeito ${id}:`, e.message);
    }
  }
}