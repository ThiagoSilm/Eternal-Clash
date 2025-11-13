// src/systems/inventorySystem.js

import { getCardTemplate, formatCardInfo } from "./cardSystem.js";
import { getCardXPValue, levelUpCard } from "./xpSystem.js";
import { spendGold, addGold } from "./economySystem.js";

const MAX_DECKS = 5;
const LEVELS_TO_UNLOCK_DECK = {
    deck1: 1,
    deck2: 5,
    deck3: 10,
    deck4: 20,
    deck5: 30
};

function getDeckName(deckIndex) {
    return `deck${deckIndex}`;
}

function ensureDecksAreInitialized(user) {
    if (!user.decks) user.decks = {};
    for (let i = 1; i <= MAX_DECKS; i++) {
        const deckName = getDeckName(i);
        if (!user.decks[deckName]) user.decks[deckName] = [];
    }
    if (!user.cards) user.cards = [];
    if (!user.guardians) user.guardians = [];
}

export function sellCards(user, indicesToSell) {
    ensureDecksAreInitialized(user);
    if (!Array.isArray(indicesToSell) || indicesToSell.length === 0)
        throw new Error("Nenhuma carta especificada para venda.");
    
    const cardsToSell = [];
    let totalGoldGained = 0;
    const cardUniqueIdsToRemove = new Set();
    
    for (const rawIndex of indicesToSell) {
        const index = Number(rawIndex);
        if (!Number.isFinite(index)) continue;
        const i = index - 1; // converte 1-based -> 0-based
        const card = user.cards[i];
        if (!card) continue;
        const template = getCardTemplate(card.id);
        if (!template) continue;
        
        const isInDeck = Object.values(user.decks).some(deck =>
            deck.some(deckCard => deckCard.uniqueId === card.uniqueId)
        );
        if (isInDeck)
            throw new Error(`A carta ${template.name} (índice ${index}) está em um deck ativo.`);
        
        if (card.isGuardian) continue;
        
        const cardValue = (template.baseSellValue || 50) + ((card.level || 1) * 10);
        totalGoldGained += cardValue;
        cardsToSell.push(card);
        cardUniqueIdsToRemove.add(card.uniqueId);
    }
    
    if (cardsToSell.length === 0)
        throw new Error("Nenhuma carta válida encontrada para venda.");
    
    addGold(user, totalGoldGained);
    user.cards = user.cards.filter(c => !cardUniqueIdsToRemove.has(c.uniqueId));
    
    return {
        count: cardsToSell.length,
        goldGained: totalGoldGained,
        cardsSold: cardsToSell.map(c => ({ id: c.id, level: c.level }))
    };
}

export function searchInventory(user, searchTerm) {
    ensureDecksAreInitialized(user);
    if (!searchTerm || typeof searchTerm !== "string") return [];
    
    const term = searchTerm.toLowerCase();
    const results = [];
    
    for (let i = 0; i < user.cards.length; i++) {
        const card = user.cards[i];
        const template = getCardTemplate(card.id);
        if (!template) continue;
        
        const cardName = template.name.toLowerCase();
        if (cardName.includes(term)) {
            results.push({
                index: i + 1,
                name: template.name,
                level: card.level || 1,
                uniqueId: card.uniqueId,
                type: card.isGuardian ? "Guardião" : "Normal"
            });
        }
    }
    return results;
}

export function listGuardians(user) {
    ensureDecksAreInitialized(user);
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

function ensureInventory(user) {
    if (!user.cards) user.cards = [];
    if (!user.guardians) user.guardians = [];
    if (!user.items) user.items = []; // se você tiver itens gerais
}

export function addItemToInventory(user, type, itemData) {
    ensureInventory(user);
    
    switch (type) {
        case "card": {
            const template = getCardTemplate(itemData);
            if (!template) throw new Error(`Carta ${itemData} não existe`);
            const uniqueId = Date.now() + Math.floor(Math.random() * 1000); // ID único
            user.cards.push({ id: itemData, level: 1, uniqueId });
            return uniqueId;
        }
        case "guardian": {
            if (!user.guardians.includes(itemData)) user.guardians.push(itemData);
            return itemData;
        }
        case "item": {
            user.items.push(itemData);
            return itemData;
        }
        default:
            throw new Error(`Tipo inválido para inventário: ${type}`);
    }
}

export function viewCardDetails(user, identifier) {
    ensureInventory(user);
    
    let card;
    if (typeof identifier === "number") {
        // índice baseado em 1
        card = user.cards[identifier - 1];
    } else if (typeof identifier === "string") {
        // uniqueId
        card = user.cards.find(c => c.uniqueId === identifier);
    }
    
    if (!card) return "⚠️ Carta não encontrada.";
    
    const template = getCardTemplate(card.id);
    if (!template) return "⚠️ Template da carta não encontrado.";
    
    // ⚠️ Usamos formatCardInfo se existir para padronizar a saída
    const info = formatCardInfo(card, template);
    return info;
}


// Retorna uma string formatada do deck (para o comando !inventory deck)
export function viewDeck(user, deckName = "main") {
    ensureDecksAreInitialized(user);
    const deck = user.decks[deckName];
    if (!deck || deck.length === 0) return `⚠️ O deck "${deckName}" está vazio.`;
    
    const lines = deck.map((card, i) => {
        const template = getCardTemplate(card.id);
        const name = template?.name || card.id;
        const rarity = template?.rarity ? `${template.rarity}★` : "";
        return `${i + 1}. ${name} ${rarity} — Lv.${card.level || 1} (uid:${card.uniqueId})`;
    });
    
    return `🃏 Deck "${deckName}" — ${deck.length} cartas:\n` + lines.join("\n");
}

// Remove todas as cartas de um deck (mantém as cartas no inventário)
export function removeAllFromDeck(user, deckName = "main") {
    ensureDecksAreInitialized(user);
    if (!user.decks[deckName] || user.decks[deckName].length === 0) return `⚠️ O deck "${deckName}" já está vazio.`;
    user.decks[deckName] = [];
    return `🗑️ Todas as cartas foram removidas do deck "${deckName}".`;
}

// Reforçada: recebe inventoryIndex 1-based; verifica duplicata, tamanho máximo e se carta existe
export function addCardToDeck(user, inventoryIndex, deckName = "main") {
    ensureDecksAreInitialized(user);
    
    const idx = Number(inventoryIndex);
    if (!Number.isFinite(idx) || idx < 1) return "❌ Índice inválido.";
    
    const card = user.cards[idx - 1]; // 1-based -> 0-based
    if (!card) return "❌ Carta não encontrada no inventário.";
    
    if (!user.decks[deckName]) user.decks[deckName] = [];
    const deck = user.decks[deckName];
    
    // Impede colocar a mesma carta mais de uma vez no mesmo deck
    if (deck.find(c => c.uniqueId === card.uniqueId)) return "⚠️ Essa carta já está no deck.";
    
    // Limite padrão (ajuste se necessário)
    const MAX_DECK_SIZE = 5;
    if (deck.length >= MAX_DECK_SIZE) return `⚠️ O deck já está cheio (máx. ${MAX_DECK_SIZE} cartas).`;
    
    deck.push(card);
    const template = getCardTemplate(card.id);
    return `✅ ${template?.name || "Carta"} adicionada ao deck "${deckName}".`;
}

// Remove carta do deck por índice 1-based no deck
export function removeCardFromDeck(user, deckIndex, deckName = "main") {
    ensureDecksAreInitialized(user);
    
    const deck = user.decks[deckName];
    if (!deck || deck.length === 0) return `⚠️ O deck "${deckName}" está vazio.`;
    
    const idx = Number(deckIndex);
    if (!Number.isFinite(idx) || idx < 1) return "❌ Índice inválido.";
    
    const card = deck[idx - 1];
    if (!card) return "❌ Carta não encontrada no deck.";
    
    const removed = deck.splice(idx - 1, 1)[0];
    const template = getCardTemplate(removed.id);
    return `🗑️ ${template?.name || "Carta"} removida do deck "${deckName}".`;
}