// src/systems/xpSystem.js
import { loadUserCached, markUserDirty } from "./userCacheSystem.js";
import { getNextLevelXP } from "./inventorySystem.js"; // usar do núcleo de cartas

/**
 * Retorna XP necessário para próximo nível da carta
 */
export function getCardNextLevelXP(card) {
  const nextLevel = card.level + 1;
  return getNextLevelXP(nextLevel);
}

/**
 * Queima cartas para gerar XP para upgrade
 * @param {Object} sacrificeCard - carta sacrificada
 */
export function getCardXPValue(sacrificeCard) {
  // XP base: raridade * 100 + level * 10
  return (sacrificeCard.rarity * 100) + (sacrificeCard.level * 10);
}

/**
 * Faz o level up de uma carta, desbloqueando efeitos
 */
export function levelUpCard(user, cardId, gainedXP) {
  const card = user.cards.find(c => c.uniqueId === cardId);
  if (!card) return { success: false, message: "❌ Carta não encontrada." };
  
  card.xp = (card.xp || 0) + gainedXP;
  let leveledUp = false;
  
  while (card.level < 15 && card.xp >= getCardNextLevelXP(card)) {
    card.xp -= getCardNextLevelXP(card);
    card.level++;
    leveledUp = true;
    
    // desbloqueia efeitos
    if ((card.level === 5 || card.level === 10 || card.level === 15) && !card.evolved) {
      card.evolved = true;
    }
  }
  
  markUserDirty(user.userId);
  return { success: true, message: leveledUp ? `⭐ ${card.name} subiu para o nível ${card.level}!` : "✅ XP adicionada à carta." };
}