import { getCardTemplate, formatCardInfo } from "./cardSystem.js";
import { getCardXPValue, levelUpCard } from "./xpSystem.js";
import { spendGold, addGold } from "./economySystem.js";
import { markUserDirty } from "./userCacheSystem.js"; 

/* --------------------------
   CONSTANTES E CONFIGURAÇÃO
   -------------------------- */
const CONFIG = Object.freeze({
  MAX_DECKS: 5,
  DEFAULT_PAGE_SIZE: 12,
  AUTO_FUSE_THRESHOLD: 3,
  FUSE_COST_BASE: 50,
  MAX_HISTORY_SIZE: 200,

  // CONFIGURAÇÃO DE CUSTOS DE UPGRADE
  UPGRADE_COSTS: {
    GOLD_BASE: 100,
    XP_PER_LEVEL: 500,
    RARITY_MULTIPLIER: { common: 1, uncommon: 1.5, rare: 2, epic: 3, legendary: 5 }
  },

  // CONFIGURAÇÃO DE CRAFT DE SHARDS
  CRAFT_SHARD_CONFIG: {
    getShardId: (cardId) => `shard_${cardId}`,
    BASE_COST: 50
  },
  
  // RECOMPENSAS DE COLEÇÃO
  COLLECTION_REWARDS: {
    beasts: { gold: 500 },
    legends: { gems: 5 }
  },
  
  // Mapeamento para ranqueamento de raridade (para sorting)
  RARITY_RANKS: { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5 }
});

/* --------------------------
   DATA STRUCTURE & HELPERS
   -------------------------- */

/** Garante a estrutura básica do inventário do usuário. */
export function ensureUserInventoryStructure(user) {
  if (!user || typeof user !== 'object') throw new Error("Objeto de usuário é inválido.");
  
  user.cards = user.cards || [];
  user.guardians = user.guardians || [];
  user.items = user.items || [];
  user.decks = user.decks || {};

  // Inicializa decks padrão se necessário
  for (let i = 1; i <= CONFIG.MAX_DECKS; i++) {
    const deckKey = `deck${i}`;
    if (!user.decks[deckKey]) user.decks[deckKey] = [];
  }
  
  initializeInventoryMeta(user);
}

/** Inicializa e hidrata o metadado do inventário (Sets e defaults). */
function initializeInventoryMeta(user) {
  user.inventoryMeta = user.inventoryMeta || {};
  const meta = user.inventoryMeta;

  // Hydration: Converte Arrays/null para Set ou inicializa Set
  const hydrateSet = (key) => {
    if (Array.isArray(meta[key])) {
      meta[key] = new Set(meta[key]);
    } else if (!(meta[key] instanceof Set)) {
      meta[key] = new Set();
    }
  };

  hydrateSet('favorites');
  hydrateSet('locked');
  
  meta.tags = meta.tags || {}; // Tags são objetos de Mapas/Sets por uniqueId

  meta.autosort = meta.autosort || { enabled: false, criteria: "rarity_desc" };
  meta.autofuse = meta.autofuse || { enabled: false, threshold: CONFIG.AUTO_FUSE_THRESHOLD };
  
  // Garante que o histórico é um array e limita o tamanho
  meta.history = meta.history || [];
  while (meta.history.length > CONFIG.MAX_HISTORY_SIZE) {
    meta.history.pop();
  }
}

/** Salva uma entrada no histórico de ações. */
function saveHistory(user, action, payload = {}) {
  ensureUserInventoryStructure(user);
  const entry = { ts: Date.now(), action, payload };
  const history = user.inventoryMeta.history;
  history.unshift(entry);
  if (history.length > CONFIG.MAX_HISTORY_SIZE) {
    history.pop();
  }
}

/** Encontra uma carta pelo seu ID único. */
function findCardByUniqueId(user, uniqueId) {
  return user.cards?.find(c => c.uniqueId === uniqueId);
}

/** Cria um novo objeto de carta com IDs únicos e padrões. */
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
    locked: false // Usado para cache rápido, mas a verdade é no `inventoryMeta.locked`
  };
}

/* --------------------------
   AÇÕES NÚCLEO: ADIÇÃO E REMOÇÃO
   -------------------------- */

export function addItemToInventory(user, type, itemData) {
  ensureUserInventoryStructure(user);
  let result;
  
  if (type === "card") result = addCardInternal(user, itemData);
  else if (type === "guardian") result = addGuardianInternal(user, itemData);
  else if (type === "item") result = addItemInternal(user, itemData);
  else throw new Error(`❌ Tipo de inventário inválido: ${type}`);
  
  markUserDirty(user.id);
  return result;
}

function addCardInternal(user, itemData) {
  const template = getCardTemplate(itemData);
  if (!template) throw new Error(`❌ Template de carta ${itemData} não encontrado.`);
  
  const card = createCardObject(itemData, template);
  user.cards.push(card);
  
  saveHistory(user, "add_card", { uniqueId: card.uniqueId, id: itemData });
  triggerAutoMechanics(user); // Tenta autofuse/autosort
  return card.uniqueId;
}

function addGuardianInternal(user, guardianId) {
  if (!user.guardians.includes(guardianId)) {
    user.guardians.push(guardianId);
  }
  saveHistory(user, "add_guardian", { id: guardianId });
  return guardianId;
}

function addItemInternal(user, itemData) {
  const { id, qty = 1, meta = {} } = itemData;
  const metaString = JSON.stringify(meta || {});
  
  // Encontra item existente com o mesmo ID e meta
  const existing = user.items.find(it => 
    it.id === id && JSON.stringify(it.meta || {}) === metaString
  );

  if (existing) {
    existing.qty += qty;
  } else {
    user.items.push({ id, qty, meta });
  }
  saveHistory(user, "add_item", { id, qty });
  return { id, qty };
}

/** Remove cartas do array de inventário do usuário. */
function removeCardsFromInventory(user, cardsToRemove) {
  const idsToRemove = new Set(cardsToRemove.map(c => c.uniqueId));
  user.cards = user.cards.filter(c => !idsToRemove.has(c.uniqueId));
  // Limpeza de metadados obsoletos (opcional, mas recomendado)
  idsToRemove.forEach(id => {
      user.inventoryMeta.favorites.delete(id);
      user.inventoryMeta.locked.delete(id);
      delete user.inventoryMeta.tags[id];
  });
  markUserDirty(user.id);
}

/** Consome um item específico (para Crafting, etc). */
export function consumeItem(user, itemId, qty) {
  ensureUserInventoryStructure(user);
  const item = user.items.find(i => i.id === itemId);
  if (!item || item.qty < qty) return false;
  
  item.qty -= qty;
  if (item.qty <= 0) {
      user.items = user.items.filter(i => i.id !== itemId);
  }
  markUserDirty(user.id);
  saveHistory(user, "consume_item", { itemId, qty });
  return true;
}

/* --------------------------
   FAVORITES, LOCKS & VIEW
   -------------------------- */

export function isLocked(user, uniqueId) {
  // Prioriza o meta, mas verifica o campo de cache na carta
  const metaLocked = user.inventoryMeta?.locked?.has(uniqueId);
  const card = findCardByUniqueId(user, uniqueId);
  return metaLocked || (card && card.locked);
}

export function lockCard(user, uniqueId) {
  ensureUserInventoryStructure(user);
  user.inventoryMeta.locked.add(uniqueId);
  const card = findCardByUniqueId(user, uniqueId);
  if (card) card.locked = true; // Atualiza cache
  saveHistory(user, "lock_card", { uniqueId });
  markUserDirty(user.id);
  return `🔒 Carta ${uniqueId} bloqueada.`;
}

// ... Outras funções de lock/favorite/tag (Mantidas iguais) ...
export function isFavorite(user, uniqueId) {
  return user.inventoryMeta?.favorites?.has(uniqueId) || false;
}

export function markFavorite(user, uniqueId, setFav = true) {
  ensureUserInventoryStructure(user);
  const favs = user.inventoryMeta.favorites;
  if (setFav) favs.add(uniqueId);
  else favs.delete(uniqueId);
  
  saveHistory(user, setFav ? "fav_add" : "fav_remove", { uniqueId });
  markUserDirty(user.id);
  return setFav ? `✅ Favoritada (${uniqueId})` : `Removida dos favoritos (${uniqueId})`;
}

export function unlockCard(user, uniqueId) {
  ensureUserInventoryStructure(user);
  user.inventoryMeta.locked.delete(uniqueId);
  const card = findCardByUniqueId(user, uniqueId);
  if (card) card.locked = false;
  saveHistory(user, "unlock_card", { uniqueId });
  markUserDirty(user.id);
  return `🔓 Carta ${uniqueId} desbloqueada.`;
}

export function tagCard(user, uniqueId, tag) {
  ensureUserInventoryStructure(user);
  user.inventoryMeta.tags[uniqueId] = user.inventoryMeta.tags[uniqueId] || new Set();
  user.inventoryMeta.tags[uniqueId].add(tag);
  markUserDirty(user.id);
  return `Tag ${tag} adicionada.`;
}

export function removeTag(user, uniqueId, tag) {
  const tags = user.inventoryMeta?.tags?.[uniqueId];
  if (tags instanceof Set) tags.delete(tag);
  markUserDirty(user.id);
  return `Tag ${tag} removida.`;
}

export function listTags(user, uniqueId) {
  const tags = user.inventoryMeta?.tags?.[uniqueId];
  return tags ? Array.from(tags) : [];
}

/* --------------------------
   DECK MANAGEMENT
   -------------------------- */

function isCardInAnyDeck(user, uniqueId) {
  return Object.values(user.decks).some(deck => 
    deck.some(c => c.uniqueId === uniqueId)
  );
}

export function addCardToDeck(user, invIndex, deckName = "deck1") {
  ensureUserInventoryStructure(user);
  const card = user.cards[Number(invIndex) - 1];
  if (!card) throw new Error("❌ Carta não encontrada no inventário.");
  
  const deck = user.decks[deckName];
  if (!deck) throw new Error(`❌ Deck ${deckName} não existe.`);
  if (deck.find(c => c.uniqueId === card.uniqueId)) throw new Error("⚠️ Carta já está no deck.");
  if (deck.length >= 5) throw new Error("⚠️ Deck está cheio (Máx: 5).");

  deck.push(card);
  saveHistory(user, "add_to_deck", { deckName, id: card.uniqueId });
  markUserDirty(user.id);
  return `✅ Adicionada ao deck ${deckName}.`;
}

export function removeCardFromDeck(user, deckIndex, deckName = "deck1") {
  ensureUserInventoryStructure(user);
  const deck = user.decks[deckName];
  if (!deck) throw new Error(`⚠️ Deck ${deckName} não encontrado.`);
  
  const idx = Number(deckIndex) - 1;
  const card = deck[idx];
  if (!card) throw new Error("❌ Índice inválido.");
  // Não precisa verificar isLocked aqui, pois `sellCards` já verifica e a remoção de deck
  // não é uma ação destrutiva, apenas move a carta.

  deck.splice(idx, 1);
  saveHistory(user, "remove_from_deck", { deckName, id: card.uniqueId });
  markUserDirty(user.id);
  return "🗑️ Removida do deck.";
}

export function viewDeck(user, deckId = "deck1") {
  const deck = user.decks?.[deckId] || [];
  if (!deck.length) return "Deck vazio.";
  const lines = deck.map((c, idx) => {
    const tpl = getCardTemplate(c.id);
    return `${idx + 1}. ${tpl?.name || c.id} (Lv.${c.level}) [${c.rarity}]`;
  });
  return lines.join("\n");
}

export function removeAllFromDeck(user, deckName = "deck1") {
  ensureUserInventoryStructure(user);
  user.decks[deckName] = [];
  saveHistory(user, "clear_deck", { deckName });
  markUserDirty(user.id);
  return `Deck ${deckName} limpo.`;
}


/* --------------------------
   VENDAS (SELLING)
   -------------------------- */

function validateSellRequest(user, indices) {
  const validCards = [];
  let totalValue = 0;

  for (const idx of indices) {
    const i = Number(idx) - 1;
    const card = user.cards[i];
    if (!card || card.isGuardian) continue;
    
    if (isLocked(user, card.uniqueId)) {
      throw new Error(`❌ Carta ${card.uniqueId} está bloqueada.`);
    }
    if (isCardInAnyDeck(user, card.uniqueId)) {
      throw new Error(`❌ Carta ${card.uniqueId} está em um deck.`);
    }

    const tpl = getCardTemplate(card.id);
    // Valor de venda: Base + (Nível * 10)
    const val = (tpl?.baseSellValue || 50) + ((card.level || 1) * 10);
    validCards.push(card);
    totalValue += val;
  }
  return { validCards, totalValue };
}

export function sellCards(user, indicesToSell) {
  ensureUserInventoryStructure(user);
  const { validCards, totalValue } = validateSellRequest(user, indicesToSell);
  
  if (validCards.length === 0) {
    throw new Error("❌ Nenhuma carta válida encontrada para vender.");
  }

  addGold(user, totalValue);
  removeCardsFromInventory(user, validCards); // Remove e limpa metadados

  saveHistory(user, "sell_cards", { 
    count: validCards.length, 
    gold: totalValue 
  });
  // markUserDirty é chamado dentro de removeCardsFromInventory
  
  return {
    count: validCards.length,
    goldGained: totalValue,
    cardsSold: validCards.map(c => ({ id: c.id, uniqueId: c.uniqueId }))
  };
}

/* --------------------------
   FUSÃO (FUSION)
   -------------------------- */

function prepareFusion(user, uniqueIds) {
  const cards = uniqueIds.map(id => findCardByUniqueId(user, id)).filter(Boolean);
  if (cards.length !== uniqueIds.length) throw new Error("❌ Carta(s) não encontrada(s).");
  if (cards.some(c => isLocked(user, c.uniqueId))) throw new Error("❌ Pelo menos uma carta está bloqueada.");

  // A primeira carta na lista é o alvo que receberá o XP
  const target = cards[0];
  const donors = cards.slice(1);
  const cost = CONFIG.FUSE_COST_BASE * donors.length;
  
  return { target, donors, cost };
}

function applyFusionXP(target, donors) {
  let xpGain = 0;
  for (const d of donors) {
    // Valor de XP de uma carta doadora: XPValue base + (Nível * 20)
    xpGain += (getCardXPValue(d) || 0) + ((d.level || 1) * 20);
  }
  
  target.xp = (target.xp || 0) + xpGain;
  
  // Loop de Level Up
  while (true) {
    const needed = getCardXPValue({ level: (target.level || 1) + 1 });
    if (!needed || target.xp < needed) break;
    
    target.xp -= needed;
    target.level += 1;
    // Notificação externa de level up (do xpSystem)
    try { levelUpCard(null, target); } catch (e) {} 
  }
}

export function fuseCards(user, uniqueIds = []) {
  ensureUserInventoryStructure(user);
  if (uniqueIds.length < 2) throw new Error("❌ A fusão requer 2 ou mais cartas.");

  const { target, donors, cost } = prepareFusion(user, uniqueIds);
  
  if (!spendGold(user, cost)) throw new Error(`💰 Ouro insuficiente. Requer: ${cost}.`);

  applyFusionXP(target, donors);
  removeCardsFromInventory(user, donors); // Remove doadores e chama markUserDirty

  saveHistory(user, "fuse", { target: target.uniqueId, cost, donorsCount: donors.length });
  // markUserDirty já foi chamado
  
  return { 
    success: true, 
    cardName: getCardTemplate(target.id)?.name,
    newLevel: target.level, 
    targetUniqueId: target.uniqueId 
  };
}

export function getDuplicates(user) {
  const map = {};
  for (const c of user.cards) {
    // Agrupa por ID de carta e NÍVEL
    const key = `${c.id}_lv${c.level}`;
    if (!map[key]) map[key] = { key, count: 0, samples: [], id: c.id };
    map[key].count++;
    map[key].samples.push(c.uniqueId);
  }
  return Object.values(map).filter(g => g.count > 1);
}

function processAutoFuseGroup(user, group, threshold, results) {
  while (group.count >= threshold) {
    // Pega as cartas para fusão (target + (threshold-1) doadores)
    const toFuseIds = group.samples.slice(0, threshold);
    if (toFuseIds.some(id => isLocked(user, id))) break;

    try {
      const res = fuseCards(user, toFuseIds);
      results.push(res);
      
      // Atualiza o grupo localmente: remove os doadores usados (threshold - 1)
      group.samples.splice(1, threshold - 1); 
      group.count -= (threshold - 1);
    } catch (e) {
      // Para se falhar (ex: falta ouro)
      break; 
    }
  }
}

export function autoFuse(user, opts = {}) {
  ensureUserInventoryStructure(user);
  const threshold = opts.threshold || CONFIG.AUTO_FUSE_THRESHOLD;
  if (!user.inventoryMeta.autofuse?.enabled) return [];
  
  const dupGroups = getDuplicates(user);
  const fused = [];

  for (const group of dupGroups) {
    processAutoFuseGroup(user, group, threshold, fused);
  }
  
  // markUserDirty é chamado dentro de fuseCards, mas chamamos novamente para segurança
  if (fused.length > 0) markUserDirty(user.id);
  
  return fused;
}

function triggerAutoMechanics(user) {
  const meta = user.inventoryMeta;
  if (meta.autosort && meta.autosort.enabled) {
    autoSortInventory(user, meta.autosort.criteria);
  }
  if (meta.autofuse && meta.autofuse.enabled) {
    autoFuse(user, { threshold: meta.autofuse.threshold });
  }
}

/* --------------------------
   UPGRADE & CRAFTING
   -------------------------- */

/** Aumenta o nível de uma carta, consumindo ouro. */
export function upgradeCard(user, uniqueId, levels = 1) {
  ensureUserInventoryStructure(user);
  const card = findCardByUniqueId(user, uniqueId);
  if (!card) throw new Error(`❌ Carta ID ${uniqueId} não encontrada.`);
  if (isLocked(user, uniqueId)) throw new Error(`❌ Carta ${uniqueId} está bloqueada.`);
  if (card.level >= 100) throw new Error("⚠️ Carta já está no nível máximo (100).");

  const tpl = getCardTemplate(card.id);
  const rarity = tpl.rarity || 'common';
  const multiplier = CONFIG.UPGRADE_COSTS.RARITY_MULTIPLIER[rarity] || 1;
  
  // Custo base é baseado no nível atual
  const totalGoldCost = Math.round(CONFIG.UPGRADE_COSTS.GOLD_BASE * levels * multiplier * card.level);
  
  if (!spendGold(user, totalGoldCost)) {
    throw new Error(`💰 Ouro insuficiente. Requer: ${totalGoldCost}.`);
  }
  
  // Aplica o upgrade
  const oldLevel = card.level;
  card.level = Math.min(100, card.level + levels);

  try { levelUpCard(null, card); } catch (e) {} 

  saveHistory(user, "upgrade_card", { uniqueId, oldLevel, newLevel: card.level, goldSpent: totalGoldCost });
  markUserDirty(user.id);

  return {
    success: true,
    cardName: tpl.name,
    oldLevel,
    newLevel: card.level,
    goldSpent: totalGoldCost,
  };
}


/** Cria uma carta a partir de Shards. */
export function craftCardFromShards(user, cardId, amount = 1) {
  ensureUserInventoryStructure(user);
  const template = getCardTemplate(cardId);
  if (!template) throw new Error(`❌ Carta ID ${cardId} não encontrada.`);

  const costPerCard = template.shardsToCraft || CONFIG.CRAFT_SHARD_CONFIG.BASE_COST;
  const totalCost = costPerCard * amount;
  const shardItemId = CONFIG.CRAFT_SHARD_CONFIG.getShardId(cardId);
  
  // Tenta consumir os Shards como um ITEM
  const consumed = consumeItem(user, shardItemId, totalCost);

  if (!consumed) {
    throw new Error(`💠 Você precisa de ${totalCost} Shards de ${template.name} (${shardItemId}).`);
  }
  
  let newCardIds = [];
  for (let i = 0; i < amount; i++) {
    const uniqueId = addCardInternal(user, cardId); // Adiciona a nova carta
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
   SORTING & VIEW UTILS
   -------------------------- */

function rarityRank(r) {
  return CONFIG.RARITY_RANKS[String(r).toLowerCase()] || 0;
}

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

function paginateData(data, options) {
  const page = Math.max(1, Number(options.page) || 1);
  const pageSize = Math.max(1, Number(options.pageSize) || CONFIG.DEFAULT_PAGE_SIZE);
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

export function autoSortInventory(user, criteria = "rarity_desc") {
  ensureUserInventoryStructure(user);
  user.cards.sort((a, b) => sortByCriteria(a, b, criteria));
  user.inventoryMeta.autosort.criteria = criteria;
  saveHistory(user, "autosort", { criteria });
  markUserDirty(user.id);
  return `✅ Inventário ordenado por ${criteria}.`;
}

export function listInventory(user, filters = {}, options = {}) {
  ensureUserInventoryStructure(user);
  if (!user.cards || user.cards.length === 0) return "📦 Inventário vazio.";

  let cards = user.cards.filter(c => {
    // Filtro de texto
    if (filters.q) {
      const q = String(filters.q).toLowerCase();
      const name = (getCardTemplate(c.id)?.name || "").toLowerCase();
      if (!name.includes(q) && !String(c.uniqueId).includes(q)) return false;
    }
    // Filtro de atributos
    if (filters.minLevel && (c.level || 1) < filters.minLevel) return false;
    if (filters.maxLevel && (c.level || 1) > filters.maxLevel) return false;
    if (filters.rarity && c.rarity !== filters.rarity) return false;
    if (filters.locked !== undefined && isLocked(user, c.uniqueId) !== !!filters.locked) return false;
    
    return true;
  });
  
  // Ordenação
  const sortOrder = options.order || user.inventoryMeta.autosort.criteria;
  cards.sort((a, b) => sortByCriteria(a, b, sortOrder));

  // Paginação
  const { page, pageSize, pages, total, slice } = paginateData(cards, options);

  const lines = slice.map((c, idx) => formatCardLine(user, c, idx, (page - 1) * pageSize));

  return {
    meta: { total, pages, page, pageSize },
    text: `📜 Inventário — Página ${page}/${pages} (Total: ${total})\n` + lines.join("\n"),
    cards: slice
  };
}

export function viewCardDetails(user, identifier) {
  const card = (typeof identifier === 'number' && identifier > 0) 
    ? user.cards[identifier - 1] 
    : findCardByUniqueId(user, identifier);
  if (!card) return "❌ Carta não encontrada.";
  return formatCardInfo(card, getCardTemplate(card.id));
}

export function searchInventory(user, term) {
  return listInventory(user, { q: term }).cards;
}

export function listItems(user) {
  ensureUserInventoryStructure(user);
  return (user.items || []).map(i => `${i.id} x${i.qty}`).join("\n");
}

export function listGuardians(user) {
  ensureUserInventoryStructure(user);
  return (user.guardians || []).map(g => getCardTemplate(g)?.name || g).join(", ");
}

/* --------------------------
   COLEÇÕES
   -------------------------- */

export function getCollectionProgress(user) {
  ensureUserInventoryStructure(user);
  const progress = {};
  
  // Para este exemplo, assumimos que getCardTemplate sabe o collection e collectionSize
  for (const c of user.cards) {
    const tpl = getCardTemplate(c.id) || {};
    const coll = tpl.collection || "_default";
    
    if (!progress[coll]) {
      // Nota: collectionSize deve ser o total de cartas únicas naquela coleção
      progress[coll] = { have: new Set(), total: tpl.collectionSize || 0 }; 
    }
    // Usamos um Set para contar apenas cartas ÚNICAS (pelo seu ID de template)
    progress[coll].have.add(c.id);
    progress[coll].haveCount = progress[coll].have.size;
  }
  
  // Converte o Set de volta para a contagem final
  const finalProgress = {};
  for (const [key, p] of Object.entries(progress)) {
      finalProgress[key] = {
          have: p.haveCount,
          total: p.total
      };
  }
  return finalProgress;
}

export function claimCollectionReward(user, key) {
  const p = getCollectionProgress(user)[key];
  if (!p || p.have < p.total) {
    throw new Error("❌ Coleção incompleta ou inválida.");
  }
  
  const reward = CONFIG.COLLECTION_REWARDS[key];
  if (!reward) {
    throw new Error("❌ Nenhuma recompensa definida para esta coleção.");
  }
  
  if (reward.gold) addGold(user, reward.gold);
  // Adicionar lógica de gemas ou outros
  
  saveHistory(user, "claim_collection", { key });
  markUserDirty(user.id);
  return { success: true, reward };
}


// Compatibilidade com Export Padrão
export default {
  ensureUserInventoryStructure, addItemToInventory, 
  listInventory, markFavorite, isFavorite, lockCard, unlockCard,
  isLocked, sellCards, getDuplicates, fuseCards, autoFuse,
  searchInventory, viewCardDetails, viewDeck, removeAllFromDeck,
  addCardToDeck, removeCardFromDeck, tagCard, removeTag, listTags,
  getCollectionProgress, claimCollectionReward, consumeItem, listItems,
  autoSortInventory, listGuardians, upgradeCard, craftCardFromShards 
};