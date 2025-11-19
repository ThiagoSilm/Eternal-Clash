// src/systems/guardianEffects.js
//------------------------------------------------------------
// GUARDIÕES COM 1 HABILIDADE ESPECIAL + 3 SECUNDÁRIOS
// EFEITOS: HP, ATAQUE, TEMP ATTACK BUFF, STATUS (burn, poison, stun, revive)
//----------------------------------------

export const GUARDIAN_EFFECTS = {
  // Fire Sentinel
  special_fireSentinel: { fn: ctx => ctx.enemies?.forEach(e => e.hp>0&&(e.hp-=ctx.owner.attack*0.3)), phase: 'damage' },
  buffAttackTurn_fireSentinel: { fn: ctx => ctx.allies?.forEach(a=>a.hp>0&&(a.tempAttackBuff=(a.tempAttackBuff||0)+a.attack*0.2)), phase: 'buff' },
  burnEnemies_fireSentinel: { fn: ctx => ctx.enemies?.forEach(e=>e.hp>0&&applyStatus(e,"burn",{dmg:ctx.owner.attack*0.1,turns:2})), phase: 'damage' },
  healSelf_fireSentinel: { fn: ctx => ctx.owner.hp=Math.min(ctx.owner.maxHp, ctx.owner.hp+ctx.owner.maxHp*0.15), phase: 'buff' },

  // Ice Guardian
  special_iceGuardian: { fn: ctx => ctx.enemies?.forEach(e=>e.hp>0&&applyStatus(e,"stun",true)), phase: 'damage' },
  buffAllyAttack_iceGuardian: { fn: ctx => ctx.allies?.forEach(a=>a.hp>0&&(a.tempAttackBuff=(a.tempAttackBuff||0)+a.attack*0.15)), phase: 'buff' },
  slowEnemies_iceGuardian: { fn: ctx => ctx.enemies?.forEach(e=>applyStatus(e,"slow",2)), phase: 'damage' },
  healAlly_iceGuardian: { fn: ctx => { const alive=ctx.allies?.filter(a=>a.hp>0); if(alive?.length) alive[Math.floor(Math.random()*alive.length)].hp+=alive[0].maxHp*0.15 }, phase: 'buff' },

  // Phoenix
  special_phoenix: { fn: ctx => { if(!ctx.owner.status) ctx.owner.status={}; if(!ctx.owner.status.reviveUsed){ ctx.owner.hp=ctx.owner.maxHp; ctx.owner.status.reviveUsed=true; } }, phase: 'special' },
  fireball_phoenix: { fn: ctx => ctx.enemies?.forEach(e=>e.hp>0&&(e.hp-=ctx.owner.attack*0.25)), phase: 'damage' },
  buffAllyAttack_phoenix: { fn: ctx => ctx.allies?.forEach(a=>a.hp>0&&(a.tempAttackBuff=(a.tempAttackBuff||0)+a.attack*0.2)), phase: 'buff' },
  burnEnemies_phoenix: { fn: ctx => ctx.enemies?.forEach(e=>e.hp>0&&applyStatus(e,"burn",{dmg:ctx.owner.attack*0.15,turns:3})), phase: 'damage' },

  // Vitae
  resurrectAlly_vitae: { fn: ctx => { const dead=ctx.allies?.filter(a=>a.hp<=0); if(dead?.length) dead[Math.floor(Math.random()*dead.length)].hp=dead[0].maxHp }, phase: 'special' },
};

// ---------------------------------------
// UTILITÁRIOS
// ---------------------------------------
const chance = p => Math.random() < p;
const applyStatus = (t, k, v) => { if(!t) return; t.status={...t.status,[k]:v}; };