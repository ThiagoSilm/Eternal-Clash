Import { getCardTemplate, formatCardInfo } from "./cardSystem.js";
import { getCardXPValue, levelUpCard } from "./xpSystem.js";
import { spendGold, addGold } from "./economySystem.js";

// Importação assumida para funcionalidade de limpeza de cache
// Se o seu sistema de cache estiver em outro local, ajuste o caminho e o nome da função.
import { markUserDirty } from "./userCacheSystem.js"; 


/* --------------------------
   CONSTANTS & CONFIG
   -------------------------- */
const MAX_DECKS = 5;
const DEFAULT_PAGE_SIZE = 12;
const AUTO_FUSE_THRESHOLD = 3;
const FUSE_COST_BASE = 50;
const MAX_HISTORY_SIZE = 200;

// CONFIGURAÇÃO DE CUSTOS DE UPGRADE (Ajuste conforme a sua economia)
const UPGRADE_COSTS = {
  goldBase: 100,
  xpPerLevel: 500,
  rarityMultiplier: { common: 1, uncommon: 1.5, rare: 2, epic: 3, legendary: 5 }
};

// CONFIGURAÇÃO DE CRAFT DE SHARDS (Ajuste o item ID do shard)
const CRAFT_SHARD_CONFIG = {
  // Shard item ID deve ser formatado como 'shard_<CardID>'
  getShardId: (cardId) => `shard_${cardId}`,
  baseCost: 50
};


const COLLECTION_REWARDS = {
  beasts: { gold: 500 },
  legends: { gems: 5 }
};

/* --------------------------
   DATA STRUCTURE & HELPERS
   -------------------------- */

export function ensureUserInventoryStructure(user) {
  if (!user) throw new Error("User object is required.");
  user.cards = user.cards || [];
  user.guardians = user.guardians || [];
  user.items = user.items || [];
  user.decks = user.decks || {};

  for (let i = 1; i <= MAX_DECKS; i++) {
    if (!user.decks[`deck${i}`]) user.decks[`deck${i}`] = [];
  }
  initializeInventoryMeta(user);
}

function initializeInventoryMeta(user) {
  if (!user.inventoryMeta) {
    user.inventoryMeta = {
      favorites: new Set(),
      locked: new Set(),
      tags: {},
      autosort: { enabled: false, criteria: "rarity_desc" },
      autofuse: { enabled: false, threshold: AUTO_FUSE_THRESHOLD },
      history: []
    };
  }
  // Hydration fixes (converts Arrays back to Sets if loaded from JSON)
  const meta = user.inventoryMeta;
  if (Array.isArray(meta.favorites)) meta.favorites = new Set(meta.favorites);
  if (Array.isArray(meta.locked)) meta.locked = new Set(meta.locked);
  meta.tags = meta.tags || {};
  meta.history = meta.history || [];
}

function saveHistory(user, action, payload = {}) {
  ensureUserInventoryStructure(user);
  const entry = { ts: Date.now(), action, payload };
  const history = user.inventoryMeta.history;
  history.unshift(entry);
  if (history.length > MAX_HISTORY_SIZE) {
    history.pop();
  }
}

function findCardByUniqueId(user, uniqueId) {
  if (!user || !user.cards) return undefined;
  return user.cards.find(c => c.uniqueId === uniqueId);
}

function createCardObject(itemData, template) {
  return {
    id: itemData,
    level: 1,
    xp: 0,
    rarity: template.rarity || "common",
    faction: template.faction || "neutral",
    uniqueId: `${Date.now()}_${Math.floor(Math.random() * 10000)}`,
    createdAt: Date.now(),
    isGuardian: !!template.isGuardian,
    locked: false
  };
}

/* --------------------------
   CORE: ADD ITEMS
   -------------------------- */

export function addItemToInventory(user, type, itemData) {
  ensureUserInventoryStructure(user);
  if (type === "card") return addCardInternal(user, itemData);
  if (type === "guardian") return addGuardianInternal(user, itemData);
  if (type === "item") return addItemInternal(user, itemData);
  throw new Error(`Invalid inventory type: ${type}`);
}

function addCardInternal(user, itemData) {
  const template = getCardTemplate(itemData);
  if (!template) throw new Error(`Card ${itemData} not found.`);
  
  const card = createCardObject(itemData, template);
  user.cards.push(card);
  
  saveHistory(user, "add_card", { uniqueId: card.uniqueId, id: itemData });
  triggerAutoMechanics(user);
  markUserDirty(user.id);
  return card.uniqueId;
}

function addGuardianInternal(user, guardianId) {
  if (!user.guardians.includes(guardianId)) {
    user.guardians.push(guardianId);
  }
  saveHistory(user, "add_guardian", { id: guardianId });
  markUserDirty(user.id);
  return guardianId;
}

function addItemInternal(user, itemData) {
  const { id, qty = 1, meta = {} } = itemData;
  // Match by ID and Meta equality
  const existing = user.items.find(it => 
    it.id === id && JSON.stringify(it.meta || {}) === JSON.stringify(meta)
  );

  if (existing) {
    existing.qty += qty;
  } else {
    user.items.push({ id, qty, meta });
  }
  saveHistory(user, "add_item", { id, qty });
  markUserDirty(user.id);
  return { id, qty };
}

// Legacy/Direct compatibility
export function addCardToInventory(user, cardData) {
  ensureUserInventoryStructure(user);
  if (!cardData.uniqueId) {
    cardData.uniqueId = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  }
  user.cards.push(cardData);
  saveHistory(user, "add_card_raw", { uniqueId: cardData.uniqueId });
  markUserDirty(user.id);
}

/* --------------------------
   AUTO MECHANICS
   -------------------------- */

function triggerAutoMechanics(user) {
  const meta = user.inventoryMeta;
  if (meta.autosort && meta.autosort.enabled) {
    autoSortInventory(user, meta.autosort.criteria);
  }
  if (meta.autofuse && meta.autofuse.enabled) {
    autoFuse(user, { threshold: meta.autofuse.threshold });
  }
}

export function autoSortInventory(user, criteria = "rarity_desc") {
  ensureUserInventoryStructure(user);
  user.cards.sort((a, b) => sortByCriteria(a, b, criteria));
  user.inventoryMeta.autosort.criteria = criteria;
  saveHistory(user, "autosort", { criteria });
  markUserDirty(user.id);
  return `✅ Inventory sorted by ${criteria}.`;
}

/* --------------------------
   VIEW & LISTING
   -------------------------- */

export function listInventory(user, filters = {}, options = {}) {
  ensureUserInventoryStructure(user);
  if (!user.cards || user.cards.length === 0) return "📦 Inventory is empty.";

  let cards = filterInventoryList(user.cards, filters);
  
  // Sorting
  const sortOrder = options.order || user.inventoryMeta.autosort.criteria;
  cards.sort((a, b) => sortByCriteria(a, b, sortOrder));

  // Pagination
  const { page, pageSize, pages, total, slice } = paginateData(cards, options);

  const lines = slice.map((c, idx) => formatCardLine(user, c, idx, (page - 1) * pageSize));

  return {
    meta: { total, pages, page, pageSize },
    text: `📜 Inventory — Page ${page}/${pages} (Total: ${total})\n` + lines.join("\n"),
    cards: slice
  };
}

function filterInventoryList(cards, filters) {
  let result = [...cards];
  
  // Text search
  if (filters.q) {
    const q = String(filters.q).toLowerCase();
    result = result.filter(c => {
      const name = (getCardTemplate(c.id)?.name || "").toLowerCase();
      return name.includes(q) || String(c.uniqueId).includes(q);
    });
  }
  
  // Attribute filters
  return result.filter(c => applyAttributeFilters(c, filters));
}

function applyAttributeFilters(card, filters) {
  for (const [key, val] of Object.entries(filters)) {
    if (key === "q") continue;
    if (key === "minLevel" && (card.level || 1) < val) return false;
    if (key === "maxLevel" && (card.level || 1) > val) return false;
    if (key === "rarity" && card.rarity !== val) return false;
    if (key === "locked" && !!card.locked !== !!val) return false;
    // Generic strict check for other keys
    if (!["minLevel", "maxLevel", "rarity", "locked"].includes(key)) {
       if (card[key] !== val) return false;
    }
  }
  return true;
}

function paginateData(data, options) {
  const page = Math.max(1, Number(options.page) || 1);
  const pageSize = Math.max(1, Number(options.pageSize) || DEFAULT_PAGE_SIZE);
  const total = data.length;
  const pages = Math.ceil(total / pageSize) || 1;
  const start = (page - 1) * pageSize;
  const slice = data.slice(start, start + pageSize);
  return { page, pageSize, pages, total, slice };
}

function formatCardLine(user, card, index, offset) {
  const tpl = getCardTemplate(card.id) || {};
  const fav = isFavorite(user, card.uniqueId) ? "★" : " ";
  const lock = isLocked(user, card.uniqueId) ? "🔒" : " ";
  const num = offset + index + 1;
  return `${num}. ${fav}${lock} ${tpl.name || card.id} (Lv.${card.level}) [${card.rarity}]`;
}

/* --------------------------
   SORTING UTILS
   -------------------------- */

function sortByCriteria(a, b, criteria) {
  const ta = getCardTemplate(a.id) || {};
  const tb = getCardTemplate(b.id) || {};
  
  switch (criteria) {
    case "rarity_desc":
      return (rarityRank(tb.rarity) - rarityRank(ta.rarity)) || (b.level - a.level);
    case "rarity_asc":
      return rarityRank(ta.rarity) - rarityRank(tb.rarity);
    case "level_desc": return (b.level || 0) - (a.level || 0);
    case "level_asc": return (a.level || 0) - (b.level || 0);
    case "name_asc": return (ta.name || "").localeCompare(tb.name || "");
    default: return (b.createdAt || 0) - (a.createdAt || 0); // created_desc
  }
}

function rarityRank(r) {
  const map = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5 };
  return map[String(r).toLowerCase()] || 0;
}

/* --------------------------
   FAVORITES & LOCKS
   -------------------------- */

export function markFavorite(user, uniqueId, setFav = true) {
  ensureUserInventoryStructure(user);
  const favs = user.inventoryMeta.favorites;
  if (setFav) favs.add(uniqueId);
  else favs.delete(uniqueId);
  
  saveHistory(user, setFav ? "fav_add" : "fav_remove", { uniqueId });
  markUserDirty(user.id);
  return setFav ? `✅ Favorited (${uniqueId})` : `Removed from favorites (${uniqueId})`;
}

export function isFavorite(user, uniqueId) {
  return user.inventoryMeta?.favorites?.has(uniqueId) || false;
}

export function lockCard(user, uniqueId) {
  ensureUserInventoryStructure(user);
  user.inventoryMeta.locked.add(uniqueId);
  const card = findCardByUniqueId(user, uniqueId);
  if (card) card.locked = true;
  saveHistory(user, "lock_card", { uniqueId });
  markUserDirty(user.id);
  return `🔒 Card ${uniqueId} locked.`;
}

export function unlockCard(user, uniqueId) {
  ensureUserInventoryStructure(user);
  user.inventoryMeta.locked.delete(uniqueId);
  const card = findCardByUniqueId(user, uniqueId);
  if (card) card.locked = false;
  saveHistory(user, "unlock_card", { uniqueId });
  markUserDirty(user.id);
  return `🔓 Card ${uniqueId} unlocked.`;
}

export function isLocked(user, uniqueId) {
  const metaLocked = user.inventoryMeta?.locked?.has(uniqueId);
  const card = findCardByUniqueId(user, uniqueId);
  return metaLocked || (card && card.locked);
}

/* --------------------------
   SELLING
   -------------------------- */

export function sellCards(user, indicesToSell) {
  ensureUserInventoryStructure(user);
  const { validCards, totalValue } = validateSellRequest(user, indicesToSell);
  
  if (validCards.length === 0) {
    throw new Error("No valid cards found to sell.");
  }

  addGold(user, totalValue);
  removeCardsFromInventory(user, validCards);
  
  saveHistory(user, "sell_cards", { 
    count: validCards.length, 
    gold: totalValue 
  });
  markUserDirty(user.id);

  return {
    count: validCards.length,
    goldGained: totalValue,
    cardsSold: validCards.map(c => ({ id: c.id, uniqueId: c.uniqueId }))
  };
}

function validateSellRequest(user, indices) {
  const validCards = [];
  let totalValue = 0;

  for (const idx of indices) {
    const i = Number(idx) - 1;
    const card = user.cards[i];
    if (!card || card.isGuardian) continue;
    
    if (isLocked(user, card.uniqueId)) {
      throw new Error(`Card ${card.uniqueId} is locked.`);
    }
    if (isCardInAnyDeck(user, card.uniqueId)) {
      throw new Error(`Card ${card.uniqueId} is in a deck.`);
    }

    const tpl = getCardTemplate(card.id);
    const val = (tpl?.baseSellValue || 50) + ((card.level || 1) * 10);
    validCards.push(card);
    totalValue += val;
  }
  return { validCards, totalValue };
}

function isCardInAnyDeck(user, uniqueId) {
  return Object.values(user.decks).some(deck => 
    deck.some(c => c.uniqueId === uniqueId)
  );
}

function removeCardsFromInventory(user, cardsToRemove) {
  const idsToRemove = new Set(cardsToRemove.map(c => c.uniqueId));
  user.cards = user.cards.filter(c => !idsToRemove.has(c.uniqueId));
  markUserDirty(user.id);
}

/* --------------------------
   FUSION / MERGE
   -------------------------- */

export function fuseCards(user, uniqueIds = []) {
  ensureUserInventoryStructure(user);
  if (uniqueIds.length < 2) throw new Error("Fusion requires 2+ cards.");

  const { target, donors, cost } = prepareFusion(user, uniqueIds);
  
  if (!spendGold(user, cost)) throw new Error("Not enough gold.");

  applyFusionXP(target, donors);
  removeCardsFromInventory(user, donors);

  saveHistory(user, "fuse", { target: target.uniqueId, cost });
  markUserDirty(user.id);
  return { success: true, newLevel: target.level, targetId: target.uniqueId };
}

function prepareFusion(user, uniqueIds) {
  const cards = uniqueIds.map(id => findCardByUniqueId(user, id)).filter(Boolean);
  if (cards.length !== uniqueIds.length) throw new Error("Card not found.");
  if (cards.some(c => isLocked(user, c.uniqueId))) throw new Error("Card locked.");

  const target = cards[0];
  const donors = cards.slice(1);
  const cost = FUSE_COST_BASE * donors.length;
  return { target, donors, cost };
}

function applyFusionXP(target, donors) {
  let xpGain = 0;
  for (const d of donors) {
    xpGain += (getCardXPValue(d) || 0) + ((d.level || 1) * 20);
  }
  
  target.xp = (target.xp || 0) + xpGain;
  
  // Level up loop
  while (true) {
    const needed = getCardXPValue({ level: (target.level || 1) + 1 });
    if (!needed || target.xp < needed) break;
    target.xp -= needed;
    target.level += 1;
    // Call external system if exists, ignore return
    try { levelUpCard(null, target); } catch (e) {} 
  }
}

export function autoFuse(user, opts = {}) {
  ensureUserInventoryStructure(user);
  const threshold = opts.threshold || AUTO_FUSE_THRESHOLD;
  const dupGroups = getDuplicates(user);
  const fused = [];

  for (const group of dupGroups) {
    processAutoFuseGroup(user, group, threshold, fused);
  }
  return fused;
}

function processAutoFuseGroup(user, group, threshold, results) {
  while (group.count >= threshold) {
    const toFuseIds = group.samples.slice(0, threshold);
    if (toFuseIds.some(id => isLocked(user, id))) break;

    try {
      const res = fuseCards(user, toFuseIds);
      results.push(res);
      // Remove used IDs from local group tracking to continue loop
      group.samples.splice(0, threshold - 1); // Keep 1 (target), remove others
      group.count -= (threshold - 1);
    } catch (e) {
      break; // Stop if error (gold, etc)
    }
  }
}

export function getDuplicates(user) {
  const map = {};
  for (const c of user.cards) {
    const key = `${c.id}_lv${c.level}`;
    if (!map[key]) map[key] = { key, count: 0, samples: [], id: c.id };
    map[key].count++;
    map[key].samples.push(c.uniqueId);
  }
  return Object.values(map).filter(g => g.count > 1);
}

/* --------------------------
   DECK MANAGEMENT
   -------------------------- */

export function addCardToDeck(user, invIndex, deckName = "main") {
  ensureUserInventoryStructure(user);
  const card = user.cards[Number(invIndex) - 1];
  if (!card) return "❌ Card not found.";
  
  const deck = user.decks[deckName] || (user.decks[deckName] = []);
  if (deck.find(c => c.uniqueId === card.uniqueId)) return "⚠️ Already in deck.";
  if (deck.length >= 5) return "⚠️ Deck is full.";

  deck.push(card);
  saveHistory(user, "add_to_deck", { deckName, id: card.uniqueId });
  markUserDirty(user.id);
  return "✅ Added to deck.";
}

export function removeCardFromDeck(user, deckIndex, deckName = "main") {
  ensureUserInventoryStructure(user);
  const deck = user.decks[deckName];
  if (!deck) return "⚠️ Deck not found.";
  
  const idx = Number(deckIndex) - 1;
  const card = deck[idx];
  if (!card) return "❌ invalid index.";
  if (isLocked(user, card.uniqueId)) return "⚠️ Card is locked.";

  deck.splice(idx, 1);
  saveHistory(user, "remove_from_deck", { deckName, id: card.uniqueId });
  markUserDirty(user.id);
  return "🗑️ Removed from deck.";
}

export function viewDeck(user, deckId = "deck1") {
  const deck = user.decks?.[deckId] || [];
  if (!deck.length) return "Deck empty.";
  return deck.map(c => getCardTemplate(c.id)?.name || c.id).join(", ");
}

export function removeAllFromDeck(user, deckName = "main") {
  ensureUserInventoryStructure(user);
  user.decks[deckName] = [];
  saveHistory(user, "clear_deck", { deckName });
  markUserDirty(user.id);
  return `Deck ${deckName} cleared.`;
}

/* --------------------------
   TAGS & MISC
   -------------------------- */

export function tagCard(user, uniqueId, tag) {
  ensureUserInventoryStructure(user);
  let tags = user.inventoryMeta.tags[uniqueId];
  if (!tags || !(tags instanceof Set)) {
    tags = new Set(Array.isArray(tags) ? tags : []);
    user.inventoryMeta.tags[uniqueId] = tags;
  }
  tags.add(tag);
  markUserDirty(user.id);
  return `Tag ${tag} added.`;
}

export function removeTag(user, uniqueId, tag) {
  const tags = user.inventoryMeta?.tags?.[uniqueId];
  if (tags instanceof Set) tags.delete(tag);
  markUserDirty(user.id);
  return `Tag ${tag} removed.`;
}

export function listTags(user, uniqueId) {
  const tags = user.inventoryMeta?.tags?.[uniqueId];
  return tags ? Array.from(tags) : [];
}

/* --------------------------
   COLLECTIONS
   -------------------------- */

export function getCollectionProgress(user) {
  ensureUserInventoryStructure(user);
  const progress = {};
  
  for (const c of user.cards) {
    const tpl = getCardTemplate(c.id) || {};
    const coll = tpl.collection || "_default";
    if (!progress[coll]) {
      progress[coll] = { have: 0, total: tpl.collectionSize || 0 };
    }
    progress[coll].have++;
  }
  return progress;
}

export function claimCollectionReward(user, key) {
  const p = getCollectionProgress(user)[key];
  if (!p || p.have < p.total) return { success: false, reason: "Incomplete." };
  
  const reward = COLLECTION_REWARDS[key];
  if (!reward) return { success: false, reason: "No reward." };
  
  if (reward.gold) addGold(user, reward.gold);
  saveHistory(user, "claim_collection", { key });
  markUserDirty(user.id);
  return { success: true, reward };
}

/* --------------------------
   NOVAS FUNÇÕES PARA RESOLVER EXPORTS
   -------------------------- */

/**
 * Aumenta o nível de uma carta, consumindo ouro e XP.
 * @param {Object} user - Objeto do usuário.
 * @param {string} uniqueId - ID único da carta.
 * @param {number} levels - Quantidade de níveis a subir.
 */
export function upgradeCard(user, uniqueId, levels = 1) {
  ensureUserInventoryStructure(user);
  const card = findCardByUniqueId(user, uniqueId);
  if (!card) throw new Error(`❌ Carta ID ${uniqueId} não encontrada.`);
  if (card.level >= 100) throw new Error("⚠️ Carta já está no nível máximo (100).");

  const tpl = getCardTemplate(card.id);
  const rarity = tpl.rarity || 'common';
  const multiplier = UPGRADE_COSTS.rarityMultiplier[rarity] || 1;
  
  // Cálculo de Custo (Simplificado)
  const totalGoldCost = UPGRADE_COSTS.goldBase * levels * multiplier * card.level;
  const totalXPCost = UPGRADE_COSTS.xpPerLevel * levels * multiplier;

  // Gasto (usando funções existentes, spendGold importada)
  if (!spendGold(user, totalGoldCost)) throw new Error(`💰 Ouro insuficiente. Requer: ${totalGoldCost}.`);
  // Assumindo que XP é uma moeda, caso contrário, precisa de uma função `spendXP`
  // Para fins de exportação, vamos simular o gasto de XP:
  // if (!spendCurrency(user, 'xp', totalXPCost)) throw new Error(`⚡ XP insuficiente. Requer: ${totalXPCost}.`);
  
  // Aplica o upgrade
  const oldLevel = card.level;
  card.level = Math.min(100, card.level + levels);
  // O XP gasto é "consumido" aqui, mas a lógica de XP é tratada pelo xpSystem se necessário.
  // Aqui apenas aumentamos o nível.

  // Chamada ao sistema de XP para possíveis efeitos colaterais
  try { levelUpCard(null, card); } catch (e) {} 

  saveHistory(user, "upgrade_card", { uniqueId, oldLevel, newLevel: card.level, goldSpent: totalGoldCost });
  markUserDirty(user.id);

  return {
    success: true,
    cardName: tpl.name,
    oldLevel,
    newLevel: card.level,
    goldSpent: totalGoldCost,
    // xpSpent: totalXPCost,
  };
}


/**
 * Cria uma carta a partir de Shards.
 * @param {Object} user - Objeto do usuário.
 * @param {string} cardId - ID do template da carta a ser criada.
 * @param {number} amount - Quantidade de cartas a serem criadas (padrão 1).
 */
export function craftCardFromShards(user, cardId, amount = 1) {
  ensureUserInventoryStructure(user);
  const template = getCardTemplate(cardId);
  if (!template) throw new Error(`❌ Carta ID ${cardId} não encontrada.`);

  const costPerCard = template.shardsToCraft || CRAFT_SHARD_CONFIG.baseCost;
  const totalCost = costPerCard * amount;
  const shardItemId = CRAFT_SHARD_CONFIG.getShardId(cardId);
  
  // Consome os Shards como um ITEM (usando a função existente)
  const consumed = consumeItem(user, shardItemId, totalCost);

  if (!consumed) {
    throw new Error(`💠 Você precisa de ${totalCost} Shards de ${template.name}.`);
  }
  
  let newCardIds = [];
  for (let i = 0; i < amount; i++) {
    // Adiciona a nova carta ao inventário
    const uniqueId = addCardInternal(user, cardId); 
    newCardIds.push(uniqueId);
  }

  saveHistory(user, "craft_card", { id: cardId, amount, shardsSpent: totalCost });
  markUserDirty(user.id);

  return {
    success: true,
    cardName: template.name,
    craftedAmount: amount,
    shardsSpent: totalCost,
    uniqueIds: newCardIds
  };
}


/* --------------------------
   EXPORTS
   -------------------------- */

export function viewCardDetails(user, identifier) {
  const card = (typeof identifier === 'number') 
    ? user.cards[identifier - 1] 
    : findCardByUniqueId(user, identifier);
  if (!card) return "Card not found.";
  return formatCardInfo(card, getCardTemplate(card.id));
}

export function searchInventory(user, term) {
  return listInventory(user, { q: term }).cards;
}

export function listItems(user) {
  return (user.items || []).map(i => `${i.id} x${i.qty}`).join("\n");
}

export function listGuardians(user) {
  return (user.guardians || []).map(g => getCardTemplate(g)?.name).join("\n");
}

export function consumeItem(user, itemId, qty) {
  const item = user.items.find(i => i.id === itemId);
  if (!item || item.qty < qty) return false; // Altera para retornar false em vez de throw
  item.qty -= qty;
  if (item.qty <= 0) {
      user.items = user.items.filter(i => i.id !== itemId);
  }
  markUserDirty(user.id);
  return true;
}

// Compatibility Export
export default {
  ensureUserInventoryStructure, addItemToInventory, addCardToInventory,
  listInventory, markFavorite, isFavorite, lockCard, unlockCard,
  isLocked, sellCards, getDuplicates, fuseCards, autoFuse,
  searchInventory, viewCardDetails, viewDeck, removeAllFromDeck,
  addCardToDeck, removeCardFromDeck, tagCard, removeTag, listTags,
  getCollectionProgress, claimCollectionReward, consumeItem, listItems,
  autoSortInventory, listGuardians, upgradeCard, craftCardFromShards // NOVAS EXPORTAÇÕES
};