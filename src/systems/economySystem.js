export function spendEnergy(user, amount) {
  if ((user.energy?.current || 0) < amount) throw new Error("Energia insuficiente.");
  user.energy.current -= amount;
  return true;
}

export function getXPForNextLevel(currentLevel) {
  return Math.floor(1000 * Math.pow(currentLevel, 2.2));
}

export function addGold(user, amount) {
  user.gold = (user.gold || 0) + amount;
}

export function spendGold(user, amount) {
  if ((user.gold || 0) < amount) throw new Error("Ouro insuficiente.");
  user.gold -= amount;
  return true;
}

export function addGems(user, amount) {
  user.gems = (user.gems || 0) + amount;
}

export function spendGems(user, amount) {
  if ((user.gems || 0) < amount) throw new Error("Gemas insuficientes.");
  user.gems -= amount;
  return true;
}

export function addCoupons(user, amount) {
  user.coupons = (user.coupons || 0) + amount;
}

export function spendCoupons(user, amount) {
  if ((user.coupons || 0) < amount) throw new Error("Cupons insuficientes.");
  user.coupons -= amount;
  return true;
}

export function spendCurrency(user, type, amount) {
  switch (type.toLowerCase()) {
    case 'gold': return spendGold(user, amount);
    case 'gems':
    case 'gem': return spendGems(user, amount);
    case 'coupons':
    case 'coupon': return spendCoupons(user, amount);
    case 'energy': return spendEnergy(user, amount);
    default: throw new Error(`Moeda '${type}' inválida.`);
  }
}

export function addXP(user, amount) {
  user.level = user.level || 1;
  user.xp = user.xp || 0;
  user.xp += amount;

  let levelUpMessage = null;

  while (true) {
    const xpForNext = getXPForNextLevel(user.level);
    if (user.xp >= xpForNext) {
      user.xp -= xpForNext;
      user.level++;
      const msg = `✨ Subiu para o nível ${user.level}!`;
      levelUpMessage = levelUpMessage ? `${levelUpMessage}\n${msg}` : msg;
    } else break;
  }

  return levelUpMessage;
}

export function addEnergy(user, amount) {
  if (typeof amount !== 'number' || amount <= 0) return false;
  if (!user.energy) user.energy = { current: 0, max: 100 };
  user.energy.current = (user.energy.current || 0) + amount;
  markUserDirty(user.id);
  return true;
}

export function regenerateEnergy(user) {
  if (!user.energy) user.energy = { current: 100, max: 100, lastRegen: Date.now() };
  const now = Date.now();
  const lastRegen = user.energy.lastRegen || 0;
  const regenRateMs = 5 * 60 * 1000; // 5 minutos por ponto
  
  // quantos pontos poderiam ser regenerados desde o último tick
  const elapsed = now - lastRegen;
  const regenPoints = Math.floor(elapsed / regenRateMs);
  
  if (regenPoints > 0) {
    user.energy.current = Math.min(user.energy.max, user.energy.current + regenPoints);
    user.energy.lastRegen = now - (elapsed % regenRateMs);
    return `Sua energia foi regenerada em ${regenPoints} ponto(s)! ⚡ (${user.energy.current}/${user.energy.max})`;
  }
  
  return null; // ainda não passou tempo suficiente
}