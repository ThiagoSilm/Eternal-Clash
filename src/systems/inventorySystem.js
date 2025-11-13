// src/systems/inventorySystem.js

// 🎯 CORREÇÃO 1: Removemos a importação de saveUserData, pois o Middleware é o responsável.
import { getCardTemplate, formatCardInfo } from "./cardSystem.js";
import { getCardXPValue, levelUpCard } from "./xpSystem.js";
// Assumindo que addGold e spendGold operam no objeto 'user'
import { spendGold, addGold } from "./economySystem.js";

const MAX_DECKS = 5;
const LEVELS_TO_UNLOCK_DECK = {
    "deck1": 1,
    "deck2": 5,
    "deck3": 10,
    "deck4": 20,
    "deck5": 30
};

// -------------------------------------------------------------------
// --- FUNÇÕES AUXILIARES (Inalteradas) ---
// -------------------------------------------------------------------

function getDeckName(deckIndex) { /* ... */ }

function ensureDecksAreInitialized(user) { /* ... */ }

// -------------------------------------------------------------------
// --- NOVA FUNÇÃO DE VENDA (sellCards) ---
// -------------------------------------------------------------------

/**
 * Remove cartas do inventário e adiciona ouro ao usuário.
 * Lança erro se a carta estiver em um deck ativo.
 * @param {object} user - Objeto do usuário a ser modificado.
 * @param {number[]} indicesToSell - Array de índices (0-based) das cartas no user.cards.
 * @returns {object} { count: number, goldGained: number, cardsSold: object[] }
 */
export function sellCards(user, indicesToSell) {
    ensureDecksAreInitialized(user);
    
    const cardsToSell = [];
    let totalGoldGained = 0;
    
    // Set de uniqueIds para garantir remoção eficiente
    const cardUniqueIdsToRemove = new Set();
    
    // 1. Validação e Cálculo de Valor
    indicesToSell.forEach(index => {
        const card = user.cards[index];
        if (!card) return;
        
        // A. Checa se está em qualquer deck ativo
        const isInDeck = Object.values(user.decks).some(deck =>
            deck.some(deckCard => deckCard.uniqueId === card.uniqueId)
        );
        
        if (isInDeck) {
            // Lança um erro que o comando !sell pode capturar
            throw new Error(`A carta ${getCardTemplate(card.id).name} (Índice ${index + 1}) está em um deck ativo e não pode ser vendida.`);
        }
        
        // B. Checa por Guardião
        if (card.isGuardian) return;
        
        // C. Calcula o valor
        const template = getCardTemplate(card.id);
        const cardValue = (template.baseSellValue || 50) + (card.level * 10);
        
        totalGoldGained += cardValue;
        cardsToSell.push(card);
        cardUniqueIdsToRemove.add(card.uniqueId);
    });
    
    if (cardsToSell.length === 0) {
        throw new Error("Nenhuma carta válida ou disponível para venda foi encontrada.");
    }
    
    // 2. Executa a Mutação
    
    // A. Adiciona o Ouro
    // 🎯 CORREÇÃO 2: Usa addGold no objeto 'user'
    addGold(user, totalGoldGained);
    
    // B. Remove as Cartas: Filtra o array user.cards
    user.cards = user.cards.filter(c => !cardUniqueIdsToRemove.has(c.uniqueId));
    
    // O Middleware fará o salvamento automático (markUserDirty)
    
    return {
        count: cardsToSell.length,
        goldGained: totalGoldGained,
        cardsSold: cardsToSell.map(c => ({ id: c.id, level: c.level }))
    };
}


// -------------------------------------------------------------------
// --- NOVA FUNÇÃO DE BUSCA (searchInventory) ---
// -------------------------------------------------------------------

/**
 * Busca cartas no inventário do usuário pelo nome.
 * @param {object} user - Objeto do usuário.
 * @param {string} searchTerm - Termo de busca (nome parcial).
 * @returns {object[]} Array de cartas encontradas com seu índice 1-based.
 */
export function searchInventory(user, searchTerm) {
    if (!user.cards || user.cards.length === 0) return [];
    
    const term = searchTerm.toLowerCase();
    const results = [];
    
    user.cards.forEach((card, index) => {
        const template = getCardTemplate(card.id);
        const cardName = template?.name?.toLowerCase() || "";
        
        // A busca é feita no nome do template.
        if (cardName.includes(term)) {
            results.push({
                index: index + 1, // Retorna o índice 1-based
                name: template.name,
                level: card.level || 1,
                uniqueId: card.uniqueId,
                type: card.isGuardian ? "Guardião" : "Normal"
            });
        }
    });
    
    return results;
}

// -------------------------------------------------------------------
// --- FUNÇÕES DE GUARDIAN (Inalteradas) ---
// -------------------------------------------------------------------

export function listGuardians(user) {
    const guardians = user.guardians || [];
    
    if (!guardians.length) return "⚠️ Nenhum guardião desbloqueado.";
    
    return guardians.map((id, i) => {
        const template = getCardTemplate(id);
        return `${i + 1}. 🛡️ ${template?.name || "Desconhecido"}`;
    }).join("\n");
}