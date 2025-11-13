// src/systems/userSystem.js
import { loadUserCached, markUserDirty, saveUser } from "./userCacheSystem.js";
import { getNextLevelXP } from "./xpSystem.js";

export function createUser(userId) {
  const user = loadUserCached(userId);
  markUserDirty(userId);
  return user;
}

export function addResource(user, type, amount) {
  if (!["gold", "gems", "coupons", "energy", "xp"].includes(type)) return false;
  user[type] = (user[type] || 0) + amount;
  markUserDirty(user.userId);
  return true;
}

export function spendResource(user, type, amount) {
  if (!["gold", "gems", "coupons", "energy"].includes(type)) return false;
  if ((user[type] || 0) < amount) return false;
  user[type] -= amount;
  markUserDirty(user.userId);
  return true;
}

export function addXp(user, amount) {
  user.xp += amount;
  let leveledUp = false;
  while (user.xp >= getNextLevelXP(user.level)) {
    user.xp -= getNextLevelXP(user.level);
    user.level++;
    user.energy += 10;
    leveledUp = true;
  }
  markUserDirty(user.userId);
  return leveledUp ? `✨ Subiu para o nível ${user.level}!` : null;
}

// Deck management
export function getUnlockedDecks(user) {
  const maxDeck = Math.min(5, Math.ceil(user.level / 8)); // 5 decks liberados até level 40
  return Object.keys(user.decks).slice(0, maxDeck);
}

export function addCardToDeck(user, card, deckName) {
  const unlocked = getUnlockedDecks(user);
  if (!unlocked.includes(deckName)) return "⚠️ Deck não desbloqueado ainda.";
  if (!user.decks[deckName]) user.decks[deckName] = [];
  if (user.decks[deckName].length >= 10) return "⚠️ Deck cheio.";
  user.decks[deckName].push(card);
  markUserDirty(user.userId);
  return `✅ ${card.id} adicionada ao ${deckName}`;
}

export function removeCardFromDeck(user, deckName, index) {
  const deck = user.decks[deckName];
  if (!deck || deck.length === 0) return "⚠️ Deck vazio.";
  const removed = deck.splice(index, 1)[0];
  markUserDirty(user.userId);
  return `🗑️ ${removed.id} removida do ${deckName}`;
}

export function removeAllCardsFromDeck(user, deckName, keepCardId = null) {
  const deck = user.decks[deckName];
  if (!deck) return;
  user.decks[deckName] = deck.filter((c) => c.id === keepCardId);
  markUserDirty(user.userId);
}

export function listCards(user, filter = {}) {
  // filter: { rarity, minLevel, maxLevel, type: 'guardian'|'card' }
  return user.cards.filter((c) => {
    if (filter.rarity && c.rarity !== filter.rarity) return false;
    if (filter.type === "guardian" && !c.id.startsWith("G")) return false;
    if (filter.type === "card" && c.id.startsWith("G")) return false;
    if (filter.minLevel && c.level < filter.minLevel) return false;
    if (filter.maxLevel && c.level > filter.maxLevel) return false;
    return true;
  });
}

// Save user at end
export function saveUserData(user) {
  saveUser(user);
}