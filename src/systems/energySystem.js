import { markUserDirty, loadUserCached } from "./userCacheSystem.js";

// -----------------------
// CONFIG
// -----------------------
const REGEN_RATE_MS = 5 * 60 * 1000;
const MAX_ENERGY_DEFAULT = 100;

// -----------------------
// FUNÇÃO BASE
// -----------------------
function ensureEnergy(user) {
  const now = Date.now();
  if (!user.energy) {
    user.energy = {
      current: MAX_ENERGY_DEFAULT,
      max: MAX_ENERGY_DEFAULT,
      lastRegen: now,
      regenBoost: 1,
      regenPaused: false,
      overcharge: 0
    };
    markUserDirty(user.id);
  }
  return user.energy;
}

// -----------------------
// CALCULAR ENERGIA
// -----------------------
function calculateCurrentEnergy(user) {
  const now = Date.now();
  const e = ensureEnergy(user);
  
  if (e.regenPaused) return e; // Buff que congela regeneração
  
  const rate = REGEN_RATE_MS / (e.regenBoost || 1);
  const elapsed = now - e.lastRegen;
  const regen = Math.floor(elapsed / rate);
  
  if (regen > 0) {
    const before = e.current;
    e.current = Math.min(e.max + e.overcharge, e.current + regen);
    
    if (e.current === before) return e;
    
    const applied = e.current - before;
    e.lastRegen += applied * rate;
    markUserDirty(user.id);
  }
  return e;
}

// -----------------------
// STATUS FORMATADO
// -----------------------
export function getEnergyStatus(userId) {
  const user = loadUserCached(userId);
  const e = calculateCurrentEnergy(user);
  
  const cap = `${e.current}/${e.max}${e.overcharge > 0 ? ` (+${e.overcharge} OC)` : ""}`;
  if (e.current >= e.max + e.overcharge) return `${cap} (Máximo)`;
  
  const rate = REGEN_RATE_MS / (e.regenBoost || 1);
  const next = rate - ((Date.now() - e.lastRegen) % rate);
  const m = Math.floor(next / 60000);
  const s = Math.floor((next % 60000) / 1000);
  
  return `${cap} (Próxima em ${m}m ${s}s)`;
}

// -----------------------
// GASTAR ENERGIA
// -----------------------
export function spendEnergy(user, amount) {
  const e = calculateCurrentEnergy(user);
  if (e.current < amount) return false;
  
  const wasMax = e.current === e.max;
  e.current -= amount;
  
  if (wasMax) e.lastRegen = Date.now();
  markUserDirty(user.id);
  return true;
}

// -----------------------
// ADICIONAR ENERGIA (normal ou overcharge)
// -----------------------
export function addEnergy(user, amount, allowOvercharge = false) {
  const e = calculateCurrentEnergy(user);
  
  if (!allowOvercharge) {
    e.current = Math.min(e.max, e.current + amount);
  } else {
    const total = e.current + e.overcharge + amount;
    if (total <= e.max) e.current = total;
    else {
      e.current = e.max;
      e.overcharge = total - e.max;
    }
  }
  
  markUserDirty(user.id);
  return true;
}

// -----------------------
// MODIFICAR LIMITE MÁXIMO
// -----------------------
export function modifyMaxEnergy(user, amount) {
  const e = ensureEnergy(user);
  e.max = Math.max(1, e.max + amount);
  if (e.current > e.max) e.current = e.max;
  markUserDirty(user.id);
}

// -----------------------
// BOOSTS DE REGENERAÇÃO
// -----------------------
export function setRegenBoost(user, multiplier) {
  const e = ensureEnergy(user);
  e.regenBoost = multiplier;
  markUserDirty(user.id);
}

export function pauseRegen(user, state = true) {
  const e = ensureEnergy(user);
  e.regenPaused = state;
  markUserDirty(user.id);
}