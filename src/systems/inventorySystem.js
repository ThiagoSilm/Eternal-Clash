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
    
    for (const index of indicesToSell) {
        const card = user.cards[index];
        if (!card) continue;
        const template = getCardTemplate(card.id);
        if (!template) continue;
        
        const isInDeck = Object.values(user.decks).some(deck =>
            deck.some(deckCard => deckCard.uniqueId === card.uniqueId)
        );
        if (isInDeck)
            throw new Error(`A carta ${template.name} (índice ${index + 1}) está em um deck ativo.`);
        
        if (card.isGuardian) continue;
        
        const cardValue = (template.baseSellValue || 50) + (card.level * 10);
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