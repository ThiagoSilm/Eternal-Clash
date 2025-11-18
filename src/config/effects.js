// src/systems/effects.js

// Cada efeito é uma função real.
// Sem eval, sem strings mágicas—execução 100% segura e rápida.
// O battleSystem chama runEffect(effectId, context).

export const EFFECTS = {
  eff001: ctx => ctx.card.attack *= 1 + ctx.v,
  eff002: ctx => ctx.card.attack *= 1 + ctx.v,
  eff003: ctx => ctx.card.defense *= 1 + ctx.v,
  eff004: ctx => heal(ctx.card, ctx.card.maxHp * ctx.v),
  eff005: ctx => ctx.targets?.forEach(t => heal(t, t.maxHp * ctx.v)),
  eff006: ctx => ctx.card.shield = (ctx.card.shield || 0) + ctx.card.maxHp * ctx.v,
  eff007: ctx => applyStatus(ctx.target, "burn", 1),
  eff008: ctx => applyStatus(ctx.target, "poison", 3),
  eff009: ctx => chance(ctx.v) && applyStatus(ctx.target, "stun", true),
  eff010: ctx => chance(ctx.v) && applyStatus(ctx.target, "silence", true),
  eff011: ctx => chance(ctx.v) && applyStatus(ctx.card, "evade", true),
  eff012: ctx => reviveOne(ctx.targets),
  eff013: ctx => stealStrongestAlly(ctx),
  eff014: ctx => ctx.game && (ctx.game.graveLocked = true),
  eff015: ctx => comboBoost(ctx),
  eff016: ctx => reflect(ctx),
  eff017: ctx => applyStatus(ctx.target, "bleed", 1),
  eff018: ctx => ctx.card.attack *= 1 + ctx.v,
  eff019: ctx => heal(ctx.card, ctx.card.maxHp * ctx.v),
  eff020: ctx => chance(ctx.v) && applyStatus(ctx.target, "stun", true),
  eff021: ctx => applyStatus(ctx.attacker, "curse", true),
  eff022: ctx => lifeSteal(ctx),
  eff023: ctx => ctx.card.attack *= 1 + ctx.v,
  eff024: ctx => reflect(ctx),
  eff025: ctx => { if (ctx.card.hp < ctx.card.maxHp * 0.3) ctx.card.attack *= 1.5 },
  eff026: ctx => ctx.allies?.forEach(a => a.hp > 0 && heal(a, a.maxHp * ctx.v)),
  eff027: ctx => darkLink(ctx),
  eff028: ctx => reviveRandom(ctx.allies),
  eff029: ctx => phoenix(ctx.card),
  eff030: ctx => chance(ctx.v) && applyStatus(ctx.enemy, "skipTurn", true),
  eff031: ctx => ctx.guardian && (ctx.guardian.hp -= ctx.card.attack),
  eff032: ctx => chance(ctx.v) && applyStatus(ctx.target, "stun", true),
  eff033: ctx => applyStatus(ctx.target, "dot", { dmg: ctx.card.attack * ctx.v, turns: 3 }),
  eff034: ctx => reflect(ctx),
  eff035: ctx => ctx.card.defense *= 1 + ctx.v,
  eff036: ctx => lifeLink(ctx),
  eff037: ctx => selfDestruct(ctx),
  eff038: ctx => ctx.target && (ctx.target.defense *= 1 - ctx.v),
  eff039: ctx => doubleStrike(ctx),
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
  const strong = [...ctx.allies].sort((a, b) => b.attack - a.attack)[0];
  if (strong) {
    ctx.card.attack += strong.attack * ctx.v;
    strong.hp = 0;
  }
};

const darkLink = ctx => {
  const ally = ctx.allies?.find(a => a.hp > 0);
  if (ally) {
    ctx.card.attack += ally.attack * 0.5;
    ally.hp = 0;
  }
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
    } catch (e) {
      console.error(`[effectSystem] Erro ao executar efeito ${id}:`, e.message);
    }
  }
}