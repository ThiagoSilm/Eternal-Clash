// src/systems/inventorySystem.js
// INVENTORY MAX — versão completa (substituição total)
// Features: favoritos, lock, autosort, autofuse, collections, tags, pagination,
// itens empilháveis, histórico, filtros avançados, ordenação, duplicatas, merge/fuse.
// Mantém compatibilidade com funções antigas exportadas.

import { getCardTemplate, formatCardInfo } from "./cardSystem.js";
import { getCardXPValue, levelUpCard } from "./xpSystem.js";
import { spendGold, addGold } from "./economySystem.js";

/* --------------------------
   CONFIG / CONSTANTS
   -------------------------- */
const MAX_DECKS = 5;
const LEVELS_TO_UNLOCK_DECK = {
  deck1: 1, deck2: 5, deck3: 10, deck4: 20, deck5: 30
};
const DEFAULT_MAX_DECK_SIZE = 5;
const DEFAULT_PAGE_SIZE = 12;
const AUTO_FUSE_THRESHOLD = 3; // fusão automática se tiver 3+ duplicatas (configurável por usuário)
const FUSE_COST_BASE = 50; // custo base para fusão (pode ser alterado)
const COLLECTION_REWARDS = {
  // exemplo: coleção 'beasts' -> reward object (id of item/gold/etc)
  // deverá ser preenchido com dados reais do jogo conforme necessário
  beasts: { gold: 500 },
  legends: { gems: 5 }
};

/* --------------------------
   HELPERS (curtas, <60 linhas)
   -------------------------- */
function ensureUserInventoryStructure(user) {
  if (!user.cards) user.cards = [];
  if (!user.guardians) user.guardians = [];
  if (!user.items) user.items = []; // items empilháveis {id, qty, meta}
  if (!user.decks) user.decks = {};
  for (let i = 1; i <= MAX_DECKS; i++) {
    const name = `deck${i}`;
    if (!user.decks[name]) user.decks[name] = [];
  }
  if (!user.inventoryMeta) {
    user.inventoryMeta = {
      favorites: new Set ? [] : [], // we'll convert to Set at runtime
      locked: new Set ? [] : [],
      tags: {}, // uniqueId -> [tags]
      autosort: { enabled: false, criteria: "rarity_desc" },
      autofuse: { enabled: false, threshold: AUTO_FUSE_THRESHOLD },
      history: [] // actions
    };
  }
  // normalize sets (persisted as arrays)
  if (Array.isArray(user.inventoryMeta.favorites)) {
    user.inventoryMeta.favorites = new Set(user.inventoryMeta.favorites);
  }
  if (Array.isArray(user.inventoryMeta.locked)) {
    user.inventoryMeta.locked = new Set(user.inventoryMeta.locked);
  }
  // ensure tags map
  user.inventoryMeta.tags = user.inventoryMeta.tags || {};
  user.inventoryMeta.history = user.inventoryMeta.history || [];
}

function saveHistory(user, action, payload = {}) {
  ensureUserInventoryStructure(user);
  const entry = {
    ts: Date.now(),
    action,
    payload
  };
  user.inventoryMeta.history.unshift(entry);
  // cap history to 200 entries
  if (user.inventoryMeta.history.length > 200) user.inventoryMeta.history.pop();
}

function findCardByUniqueId(user, uniqueId) {
  ensureUserInventoryStructure(user);
  return user.cards.find(c => c.uniqueId === uniqueId);
}

function indexOfCardInInventory(user, uniqueId) {
  ensureUserInventoryStructure(user);
  return user.cards.findIndex(c => c.uniqueId === uniqueId);
}

/* --------------------------
   BASICS / COMPATIBILITY
   -------------------------- */

// Adiciona um item (card / guardian / item)
export function addItemToInventory(user, type, itemData) {
  ensureUserInventoryStructure(user);
  switch (type) {
    case "card": {
      const template = getCardTemplate(itemData);
      if (!template) throw new Error(`Carta ${itemData} não existe`);
      const uniqueId = `${Date.now()}_${Math.floor(Math.random()*10000)}`;
      const card = {
        id: itemData,
        level: 1,
        xp: 0,
        rarity: template.rarity || "common",
        faction: template.faction || "neutral",
        uniqueId,
        createdAt: Date.now(),
        isGuardian: !!template.isGuardian,
        locked: false
      };
      user.cards.push(card);
      saveHistory(user, "add_card", { uniqueId, id: itemData });
      // autosort/autofuse hooks
      if (user.inventoryMeta.autosort && user.inventoryMeta.autosort.enabled) {
        autoSortInventory(user, user.inventoryMeta.autosort.criteria);
      }
      if (user.inventoryMeta.autofuse && user.inventoryMeta.autofuse.enabled) {
        autoFuse(user, { threshold: user.inventoryMeta.autofuse.threshold });
      }
      return uniqueId;
    }
    case "guardian": {
      if (!user.guardians.includes(itemData)) user.guardians.push(itemData);
      saveHistory(user, "add_guardian", { id: itemData });
      return itemData;
    }
    case "item": {
      // itemData = { id, qty = 1, meta = {} }
      const { id, qty = 1, meta = {} } = itemData;
      const existing = user.items.find(it => it.id === id && JSON.stringify(it.meta||{}) === JSON.stringify(meta||{}));
      if (existing) existing.qty += qty;
      else user.items.push({ id, qty, meta });
      saveHistory(user, "add_item", { id, qty });
      return { id, qty };
    }
    default:
      throw new Error(`Tipo inválido para inventário: ${type}`);
  }
}

// Backward-compatible: addCardToInventory (recebe cardData direto)
export function addCardToInventory(user, cardData) {
  ensureUserInventoryStructure(user);
  // assume cardData already contains uniqueId etc
  if (!cardData.uniqueId) cardData.uniqueId = `${Date.now()}_${Math.floor(Math.random()*10000)}`;
  user.cards.push(cardData);
  saveHistory(user, "add_card_raw", { uniqueId: cardData.uniqueId, id: cardData.id });
}

/* --------------------------
   VIEW / LIST / PAGINATION
   -------------------------- */

export function listInventory(user, filters = {}, options = {}) {
  ensureUserInventoryStructure(user);
  if (!user.cards || user.cards.length === 0) return "📦 Seu inventário está vazio.";

  let cards = [...user.cards];

  // Apply filter helpers (short)
  if (filters.q) {
    const q = String(filters.q).toLowerCase();
    cards = cards.filter(c => {
      const tpl = getCardTemplate(c.id);
      const name = tpl?.name?.toLowerCase() || "";
      return name.includes(q) || (c.uniqueId && String(c.uniqueId).includes(q));
    });
  }
  for (const [k, v] of Object.entries(filters)) {
    if (k === "q") continue;
    cards = cards.filter(c => {
      if (k === "minLevel") return (c.level || 1) >= v;
      if (k === "maxLevel") return (c.level || 1) <= v;
      if (k === "rarity") return String(c.rarity).toLowerCase() === String(v).toLowerCase();
      if (k === "type") return (c.isGuardian ? "guardian" : "card") === v;
      if (k === "locked") return !!c.locked === !!v;
      return c[k] === v;
    });
  }

  // Sorting
  const order = options.order || user.inventoryMeta.autosort.criteria || "rarity_desc";
  cards.sort((a, b) => sortByCriteria(a, b, order));

  // Pagination
  const page = Number(options.page) > 0 ? Number(options.page) : 1;
  const pageSize = Number(options.pageSize) > 0 ? Number(options.pageSize) : DEFAULT_PAGE_SIZE;
  const total = cards.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  const slice = cards.slice(start, start + pageSize);

  const lines = slice.map((c, idx) => {
    const tpl = getCardTemplate(c.id) || {};
    const fav = user.inventoryMeta.favorites.has(c.uniqueId) ? "★" : " ";
    const lock = (c.locked || user.inventoryMeta.locked.has(c.uniqueId)) ? "🔒" : " ";
    return `${start + idx + 1}. ${fav}${lock} ${tpl.name || c.id} (Lv.${c.level||1}) [${c.rarity}] - id:${c.uniqueId}`;
  });

  return {
    meta: { total, pages, page, pageSize },
    text: `📜 Inventário — Página ${page}/${pages} (Total: ${total})\n` + lines.join("\n"),
    cards: slice
  };
}

function sortByCriteria(a, b, criteria) {
  // criteria examples: rarity_desc, level_asc, name_asc, created_desc
  const ta = getCardTemplate(a.id) || {};
  const tb = getCardTemplate(b.id) || {};
  switch (criteria) {
    case "rarity_desc":
      return rarityRank(tb.rarity) - rarityRank(ta.rarity) || (b.level || 0) - (a.level || 0);
    case "rarity_asc":
      return rarityRank(ta.rarity) - rarityRank(tb.rarity);
    case "level_desc":
      return (b.level || 0) - (a.level || 0);
    case "level_asc":
      return (a.level || 0) - (b.level || 0);
    case "name_asc":
      return (ta.name || "").localeCompare(tb.name || "");
    case "created_asc":
      return (a.createdAt || 0) - (b.createdAt || 0);
    default:
      return (b.createdAt || 0) - (a.createdAt || 0);
  }
}

function rarityRank(r) {
  if (!r) return 0;
  const map = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5 };
  return map[String(r).toLowerCase()] || 0;
}

/* --------------------------
   FAVORITES / LOCK
   -------------------------- */

export function markFavorite(user, uniqueId, setFav = true) {
  ensureUserInventoryStructure(user);
  if (!user.inventoryMeta.favorites) user.inventoryMeta.favorites = new Set();
  if (setFav) user.inventoryMeta.favorites.add(uniqueId);
  else user.inventoryMeta.favorites.delete(uniqueId);
  saveHistory(user, setFav ? "fav_add" : "fav_remove", { uniqueId });
  return `✅ ${setFav ? "Favoritado" : "Removido dos favoritos"} (${uniqueId})`;
}

export function isFavorite(user, uniqueId) {
  ensureUserInventoryStructure(user);
  return user.inventoryMeta.favorites && user.inventoryMeta.favorites.has(uniqueId);
}

export function lockCard(user, uniqueId) {
  ensureUserInventoryStructure(user);
  if (!user.inventoryMeta.locked) user.inventoryMeta.locked = new Set();
  user.inventoryMeta.locked.add(uniqueId);
  // also set flag on card
  const c = findCardByUniqueId(user, uniqueId);
  if (c) c.locked = true;
  saveHistory(user, "lock_card", { uniqueId });
  return `🔒 Carta ${uniqueId} bloqueada.`;
}

export function unlockCard(user, uniqueId) {
  ensureUserInventoryStructure(user);
  user.inventoryMeta.locked.delete(uniqueId);
  const c = findCardByUniqueId(user, uniqueId);
  if (c) c.locked = false;
  saveHistory(user, "unlock_card", { uniqueId });
  return `🔓 Carta ${uniqueId} desbloqueada.`;
}

export function isLocked(user, uniqueId) {
  ensureUserInventoryStructure(user);
  const c = findCardByUniqueId(user, uniqueId);
  return !!(c && c.locked) || (user.inventoryMeta.locked && user.inventoryMeta.locked.has(uniqueId));
}

/* --------------------------
   SELL / AUTOSELL / DUPLICATES
   -------------------------- */

export function sellCards(user, indicesToSell) {
  ensureUserInventoryStructure(user);
  if (!Array.isArray(indicesToSell) || indicesToSell.length === 0)
    throw new Error("Nenhuma carta especificada para venda.");

  const cardsToSell = [];
  let totalGoldGained = 0;
  const cardUniqueIdsToRemove = new Set();

  for (const rawIndex of indicesToSell) {
    const index = Number(rawIndex);
    if (!Number.isFinite(index)) continue;
    const i = index - 1; // 1-based -> 0-based
    const card = user.cards[i];
    if (!card) continue;
    if (isLocked(user, card.uniqueId)) throw new Error(`A carta ${card.uniqueId} está bloqueada.`);
    const template = getCardTemplate(card.id);
    if (!template) continue;

    const isInDeck = Object.values(user.decks).some(deck =>
      deck.some(deckCard => deckCard.uniqueId === card.uniqueId)
    );
    if (isInDeck) throw new Error(`A carta ${template.name} (índice ${index}) está em um deck ativo.`);

    if (card.isGuardian) continue;

    const cardValue = (template.baseSellValue || 50) + ((card.level || 1) * 10);
    totalGoldGained += cardValue;
    cardsToSell.push(card);
    cardUniqueIdsToRemove.add(card.uniqueId);
  }

  if (cardsToSell.length === 0) throw new Error("Nenhuma carta válida encontrada para venda.");

  addGold(user, totalGoldGained);
  user.cards = user.cards.filter(c => !cardUniqueIdsToRemove.has(c.uniqueId));
  saveHistory(user, "sell_cards", { count: cardsToSell.length, gold: totalGoldGained, ids: [...cardUniqueIdsToRemove] });

  return {
    count: cardsToSell.length,
    goldGained: totalGoldGained,
    cardsSold: cardsToSell.map(c => ({ id: c.id, level: c.level, uniqueId: c.uniqueId }))
  };
}

export function getDuplicates(user) {
  ensureUserInventoryStructure(user);
  const map = {};
  for (const c of user.cards) {
    const key = `${c.id}_lv${c.level||1}`;
    map[key] = map[key] || [];
    map[key].push(c);
  }
  const dupGroups = Object.entries(map).filter(([, arr]) => arr.length > 1)
    .map(([k, arr]) => ({ key: k, count: arr.length, samples: arr.map(x => x.uniqueId), id: arr[0].id }));
  return dupGroups;
}

/* --------------------------
   FUSION / MERGE
   -------------------------- */

export function fuseCards(user, uniqueIds = [], options = {}) {
  ensureUserInventoryStructure(user);
  if (!Array.isArray(uniqueIds) || uniqueIds.length < 2) {
    throw new Error("Fusão requer pelo menos 2 cartas.");
  }
  // Verify ownership & locks
  const cards = uniqueIds.map(id => findCardByUniqueId(user, id)).filter(Boolean);
  if (cards.length !== uniqueIds.length) throw new Error("Algumas cartas não foram encontradas.");
  if (cards.some(c => isLocked(user, c.uniqueId))) throw new Error("Algumas cartas estão bloqueadas.");

  // Simple fusion rule: combine XP and increment level of target (first)
  const target = cards[0];
  const donors = cards.slice(1);
  const cost = FUSE_COST_BASE * donors.length;
  // try spend gold (if fails, throw)
  if (!spendGold(user, cost)) throw new Error("Saldo insuficiente para fusão.");

  let totalXP = donors.reduce((s, d) => s + (getCardXPValue(d) || 0), 0);
  // also convert donors' level into XP (simple)
  totalXP += donors.reduce((s, d) => s + ((d.level || 1) * 20), 0);

  // apply XP to target and levelUp as needed
  target.xp = (target.xp || 0) + totalXP;
  // attempt to level up while possible
  while (true) {
    const needed = getCardXPValue({ level: (target.level || 1) + 1 }) || Infinity;
    if (target.xp >= needed) {
      target.xp -= needed;
      target.level = (target.level || 1) + 1;
      try { levelUpCard(user, target); } catch (e) { /* ignore if function not implemented */ }
    } else break;
  }

  // remove donors
  const donorIds = donors.map(d => d.uniqueId);
  user.cards = user.cards.filter(c => !donorIds.includes(c.uniqueId));

  saveHistory(user, "fuse", { target: target.uniqueId, donors: donorIds, cost });
  return { success: true, newLevel: target.level, targetId: target.uniqueId };
}

// Autofuse - check duplicates and fuse automatically if meets threshold
export function autoFuse(user, opts = {}) {
  ensureUserInventoryStructure(user);
  const threshold = opts.threshold || (user.inventoryMeta.autofuse && user.inventoryMeta.autofuse.threshold) || AUTO_FUSE_THRESHOLD;
  const dupGroups = getDuplicates(user);
  const fused = [];
  for (const g of dupGroups) {
    while (g.count >= threshold) {
      // take `threshold` cards to fuse -> keep one, consume others
      const toFuse = g.samples.splice(0, threshold);
      // ensure not locked
      const blocked = toFuse.some(id => isLocked(user, id));
      if (blocked) break;
      try {
        const result = fuseCards(user, toFuse);
        fused.push(result);
        g.count -= (threshold - 1); // because one remains
      } catch (e) {
        break;
      }
    }
  }
  return fused;
}

/* --------------------------
   SEARCH / DETAILS
   -------------------------- */

export function searchInventory(user, searchTerm) {
  ensureUserInventoryStructure(user);
  if (!searchTerm || typeof searchTerm !== "string") return [];

  const term = searchTerm.toLowerCase();
  const results = [];

  for (let i = 0; i < user.cards.length; i++) {
    const card = user.cards[i];
    const template = getCardTemplate(card.id);
    if (!template) continue;

    const cardName = template.name.toLowerCase();
    if (cardName.includes(term) || (card.uniqueId && String(card.uniqueId).includes(term))) {
      results.push({
        index: i + 1,
        name: template.name,
        level: card.level || 1,
        uniqueId: card.uniqueId,
        rarity: card.rarity,
        type: card.isGuardian ? "Guardião" : "Normal"
      });
    }
  }
  return results;
}

export function viewCardDetails(user, identifier) {
  ensureUserInventoryStructure(user);

  let card;
  if (typeof identifier === "number") {
    card = user.cards[identifier - 1];
  } else if (typeof identifier === "string") {
    card = user.cards.find(c => c.uniqueId === identifier);
  }

  if (!card) return "⚠️ Carta não encontrada.";
  const template = getCardTemplate(card.id);
  if (!template) return "⚠️ Template da carta não encontrado.";

  const info = formatCardInfo ? formatCardInfo(card, template) : `${template.name} (Lv.${card.level||1}) [${card.rarity}]`;
  return info;
}

/* --------------------------
   DECK RELATED (compatibility)
   -------------------------- */

export function viewDeck(user, deckId = "deck1") {
  ensureUserInventoryStructure(user);
  const deck = user.decks[deckId] || [];
  if (deck.length === 0) return "Vazio. Adicione cartas com `!gacha`!";
  const cardNames = deck.map(c => {
    const t = getCardTemplate(c.id) || {};
    return t.name || `Carta #${c.id || "???"}`;
  });
  const preview = cardNames.slice(0, 5).join(", ");
  if (deck.length > 5) return `${preview}, ... e mais ${deck.length - 5} cartas. (Total: ${deck.length})`;
  return `${preview}. (Total: ${deck.length})`;
}

export function removeAllFromDeck(user, deckName = "main") {
  ensureUserInventoryStructure(user);
  if (!user.decks[deckName] || user.decks[deckName].length === 0) return `⚠️ O deck "${deckName}" já está vazio.`;
  user.decks[deckName] = [];
  saveHistory(user, "clear_deck", { deckName });
  return `🗑️ Todas as cartas foram removidas do deck "${deckName}".`;
}

export function addCardToDeck(user, inventoryIndex, deckName = "main") {
  ensureUserInventoryStructure(user);
  const idx = Number(inventoryIndex);
  if (!Number.isFinite(idx) || idx < 1) return "❌ Índice inválido.";
  const card = user.cards[idx - 1];
  if (!card) return "❌ Carta não encontrada no inventário.";
  if (!user.decks[deckName]) user.decks[deckName] = [];
  const deck = user.decks[deckName];
  if (deck.find(c => c.uniqueId === card.uniqueId)) return "⚠️ Essa carta já está no deck.";
  const MAX_DECK_SIZE = DEFAULT_MAX_DECK_SIZE;
  if (deck.length >= MAX_DECK_SIZE) return `⚠️ O deck já está cheio (máx. ${MAX_DECK_SIZE} cartas).`;
  deck.push(card);
  saveHistory(user, "add_to_deck", { deckName, uniqueId: card.uniqueId });
  return `✅ ${getCardTemplate(card.id)?.name || "Carta"} adicionada ao deck "${deckName}".`;
}

export function removeCardFromDeck(user, deckIndex, deckName = "main") {
  ensureUserInventoryStructure(user);
  const deck = user.decks[deckName];
  if (!deck || deck.length === 0) return `⚠️ O deck "${deckName}" está vazio.`;
  const idx = Number(deckIndex);
  if (!Number.isFinite(idx) || idx < 1) return "❌ Índice inválido.";
  const card = deck[idx - 1];
  if (!card) return "❌ Carta não encontrada no deck.";
  if (isLocked(user, card.uniqueId)) return "⚠️ Carta bloqueada e não pode ser removida.";
  const removed = deck.splice(idx - 1, 1)[0];
  saveHistory(user, "remove_from_deck", { deckName, uniqueId: removed.uniqueId });
  return `🗑️ ${getCardTemplate(removed.id)?.name || "Carta"} removida do deck "${deckName}".`;
}

/* --------------------------
   TAGS / CUSTOM LABELS
   -------------------------- */

export function tagCard(user, uniqueId, tag) {
  ensureUserInventoryStructure(user);
  user.inventoryMeta.tags[uniqueId] = user.inventoryMeta.tags[uniqueId] || new Set();
  if (!(user.inventoryMeta.tags[uniqueId] instanceof Set)) {
    user.inventoryMeta.tags[uniqueId] = new Set(user.inventoryMeta.tags[uniqueId]);
  }
  user.inventoryMeta.tags[uniqueId].add(tag);
  saveHistory(user, "tag_add", { uniqueId, tag });
  return `🏷️ Tag "${tag}" adicionada à carta ${uniqueId}.`;
}

export function removeTag(user, uniqueId, tag) {
  ensureUserInventoryStructure(user);
  if (!user.inventoryMeta.tags[uniqueId]) return `Tag não encontrada.`;
  if (user.inventoryMeta.tags[uniqueId] instanceof Set) user.inventoryMeta.tags[uniqueId].delete(tag);
  else user.inventoryMeta.tags[uniqueId] = (user.inventoryMeta.tags[uniqueId] || []).filter(t => t !== tag);
  saveHistory(user, "tag_remove", { uniqueId, tag });
  return `🗑️ Tag "${tag}" removida de ${uniqueId}.`;
}

export function listTags(user, uniqueId) {
  ensureUserInventoryStructure(user);
  const tags = user.inventoryMeta.tags[uniqueId];
  if (!tags) return [];
  return [...(tags instanceof Set ? tags : new Set(tags))];
}

/* --------------------------
   COLLECTIONS / REWARDS
   -------------------------- */

export function getCollectionProgress(user) {
  ensureUserInventoryStructure(user);
  // Example approach: collections keyed by template.collection property
  const progress = {};
  for (const c of user.cards) {
    const tpl = getCardTemplate(c.id) || {};
    const coll = tpl.collection || "_default";
    progress[coll] = progress[coll] || { have: 0, total: tpl.collectionSize || 0, samples: [] };
    progress[coll].have += 1;
    if (progress[coll].samples.length < 5) progress[coll].samples.push(getCardTemplate(c.id)?.name || c.id);
  }
  // fill totals from COLLECTION_REWARDS keys if missing
  for (const k of Object.keys(COLLECTION_REWARDS)) {
    progress[k] = progress[k] || { have: 0, total: 0, samples: [] };
  }
  return progress;
}

export function claimCollectionReward(user, collectionKey) {
  ensureUserInventoryStructure(user);
  const progress = getCollectionProgress(user)[collectionKey];
  if (!progress) throw new Error("Coleção inválida.");
  // simple rule: if have >= total then can claim
  if (progress.total > 0 && progress.have >= progress.total) {
    const reward = COLLECTION_REWARDS[collectionKey];
    if (!reward) throw new Error("Recompensa não definida para essa coleção.");
    if (reward.gold) addGold(user, reward.gold);
    // other reward types ignored if systems not available (gems etc)
    saveHistory(user, "claim_collection", { collectionKey, reward });
    return { success: true, reward };
  } else {
    return { success: false, reason: "Não completou a coleção." };
  }
}

/* --------------------------
   ITEM STACKS (consumíveis)
   -------------------------- */

export function addItemStack(user, itemId, qty = 1, meta = {}) {
  ensureUserInventoryStructure(user);
  const match = user.items.find(it => it.id === itemId && JSON.stringify(it.meta||{}) === JSON.stringify(meta||{}));
  if (match) match.qty += qty;
  else user.items.push({ id: itemId, qty, meta });
  saveHistory(user, "add_item_stack", { itemId, qty });
  return { id: itemId, qty };
}

export function consumeItem(user, itemId, qty = 1) {
  ensureUserInventoryStructure(user);
  const i = user.items.find(it => it.id === itemId);
  if (!i || i.qty < qty) throw new Error("Item insuficiente.");
  i.qty -= qty;
  if (i.qty <= 0) {
    user.items = user.items.filter(it => it.id !== itemId || it.qty > 0);
  }
  saveHistory(user, "consume_item", { itemId, qty });
  return { success: true, remaining: i.qty || 0 };
}

export function listItems(user) {
  ensureUserInventoryStructure(user);
  if (!user.items || user.items.length === 0) return "📦 Sem itens.";
  return user.items.map(it => `${it.id} x${it.qty} ${it.meta ? JSON.stringify(it.meta) : ""}`).join("\n");
}

/* --------------------------
   AUTOSORT
   -------------------------- */

export function autoSortInventory(user, criteria = null) {
  ensureUserInventoryStructure(user);
  const c = criteria || (user.inventoryMeta.autosort && user.inventoryMeta.autosort.criteria) || "rarity_desc";
  user.cards.sort((a, b) => sortByCriteria(a, b, c));
  user.inventoryMeta.autosort.criteria = c;
  saveHistory(user, "autosort", { criteria: c });
  return `✅ Inventário ordenado por ${c}.`;
}

/* --------------------------
   HISTORY / UNDO
   -------------------------- */

export function getHistory(user, limit = 30) {
  ensureUserInventoryStructure(user);
  return (user.inventoryMeta.history || []).slice(0, limit);
}

export function undoLastAction(user) {
  ensureUserInventoryStructure(user);
  const h = user.inventoryMeta.history.shift();
  if (!h) return { success: false, reason: "Nenhuma ação para desfazer." };
  // Only support undo for simple actions (add_card, sell_cards not supported)
  switch (h.action) {
    case "add_card":
      // remove card by id
      user.cards = user.cards.filter(c => c.uniqueId !== h.payload.uniqueId);
      return { success: true, undone: h.action };
    case "add_item":
    case "add_item_stack":
      // try to remove qty
      const itm = user.items.find(it => it.id === h.payload.id);
      if (itm) itm.qty = Math.max(0, itm.qty - (h.payload.qty || 1));
      return { success: true, undone: h.action };
    default:
      return { success: false, reason: "Desfazer não suportado para essa ação." };
  }
}

/* --------------------------
   UTIL / SMALL FUNCTIONS
   -------------------------- */

export function filterCards(cards, filters = {}) {
  if (!Array.isArray(cards)) return [];
  return cards.filter(card => {
    if (filters.type && card.type !== filters.type) return false;
    if (filters.rarity && card.rarity !== filters.rarity) return false;
    if (filters.faction && card.faction !== filters.faction) return false;
    if (filters.id && card.id !== filters.id) return false;
    return true;
  });
}

export function listGuardians(user) {
  ensureUserInventoryStructure(user);
  const guardians = user.guardians || [];
  const result = [];
  for (let i = 0; i < guardians.length; i++) {
    const template = getCardTemplate(guardians[i]);
    result.push(`${i + 1}. 🛡️ ${template?.name || "Desconhecido"}`);
  }
  const guardianCards = user.cards.filter(c => c.isGuardian);
  for (const g of guardianCards) {
    const template = getCardTemplate(g.id);
    if (!guardians.includes(g.id))
      result.push(`🛡️ ${template?.name || g.id} (não registrado em guardians[])`);
  }
  return result.length ? result.join("\n") : "⚠️ Nenhum guardião desbloqueado.";
}

/* --------------------------
   EXPORT COMPATIBLE NAMES
   -------------------------- */

// functions already exported above; export default summary for convenience
export default {
  ensureUserInventoryStructure,
  addItemToInventory,
  addCardToInventory,
  listInventory,
  markFavorite,
  isFavorite,
  lockCard,
  unlockCard,
  isLocked,
  sellCards,
  getDuplicates,
  fuseCards,
  autoFuse,
  searchInventory,
  viewCardDetails,
  viewDeck,
  removeAllFromDeck,
  addCardToDeck,
  removeCardFromDeck,
  tagCard,
  removeTag,
  listTags,
  getCollectionProgress,
  claimCollectionReward,
  addItemStack,
  consumeItem,
  listItems,
  autoSortInventory,
  getHistory,
  undoLastAction,
  filterCards,
  listGuardians
};