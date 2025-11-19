// src/systems/deckSystem.js

import { getCardTemplate } from "./cardSystem.js";
// Assumindo que markUserDirty é uma função para notificar o sistema de cache/persistência
import { markUserDirty } from "./userCacheSystem.js"; 

// ======================================================
// ⚙️ CONFIGURAÇÃO & CONSTANTES
// ======================================================

export const MAX_CARDS_IN_DECK = 5;
export const MAX_SIDE_DECK = 3;
export const MAX_SAVED_DECKS = 10;

// ======================================================
// 🔹 TIPAGEM JSDOC
// ======================================================

/**
 * @typedef {object} CardInventoryItem
 * @property {string} uniqueId - ID único da instância da carta no inventário (chave principal).
 * @property {string} cardId - ID do template da carta.
 * @property {number} level - Nível da carta.
 * // Outras propriedades do inventário, como XP, etc.
 */

/**
 * @typedef {object} DeckData
 * @property {string[]} main - Array de uniqueIds do deck principal.
 * @property {string[]} side - Array de uniqueIds do side deck.
 * @property {number} power - Poder total calculado.
 */

/**
 * @typedef {object} UserState
 * @property {Object.<string, DeckData>} [decks={}] - Map de decks salvos (chave: nome do deck).
 * @property {CardInventoryItem[]} [activeDeck=[]] - Cartas ativas no deck (objetos CardInventoryItem).
 * @property {CardInventoryItem[]} [activeSide=[]] - Cartas ativas no side deck (objetos CardInventoryItem).
 * @property {CardInventoryItem[]} [cards=[]] - Inventário completo de cartas (índices 1-based no input do usuário).
 */

// ======================================================
// 🛠️ FUNÇÕES AUXILIARES DE ESTADO
// ======================================================

/**
 * Garante que a estrutura de dados básica do deck existe no objeto do usuário.
 * @param {UserState} user - Objeto do usuário (mutável).
 */
function ensureDeckStructure(user) {
    user.decks = user.decks || {};
    user.activeDeck = user.activeDeck || [];
    user.activeSide = user.activeSide || [];
    user.cards = user.cards || [];
}

/**
 * Converte índices (1-based, como 1, 5, 12...) em Unique IDs (UIDs) de cartas.
 * @param {UserState} user - Objeto do usuário.
 * @param {number[]} indices - Array de índices (1-based) das cartas no user.cards.
 * @param {number} expectedSize - Tamanho esperado do array (para validação de tamanho).
 * @param {string} type - Tipo de deck ('principal' ou 'side').
 * @returns {string[]} Array de Unique IDs.
 * @throws {Error} Se houver cartas inválidas, duplicadas ou tamanho incorreto.
 */
function convertIndicesToUIDs(user, indices, expectedSize, type) {
    if (!indices || indices.length === 0) {
        if (expectedSize > 0) return [];
        // Se expectedSize for 0, side deck vazio é válido.
    }
    
    // 1. Validação de tamanho
    if (expectedSize > 0 && indices.length !== expectedSize) {
        throw new Error(`O deck ${type} precisa de exatamente ${expectedSize} cartas.`);
    }
    if (expectedSize === 0 && indices.length > MAX_SIDE_DECK) {
        throw new Error(`O deck ${type} pode ter no máximo ${MAX_SIDE_DECK} cartas.`);
    }

    // 2. Validação de duplicidade
    const set = new Set(indices);
    if (set.size !== indices.length) {
        throw new Error(`O deck ${type} contém índices de cartas duplicados.`);
    }

    // 3. Mapeamento e Validação de existência
    const uniqueIds = indices.map(i => {
        // user.cards é 0-based, o input do usuário é 1-based.
        const card = user.cards[i - 1]; 
        if (!card) {
            throw new Error(`Carta inválida no índice ${i} do deck ${type} (Não existe no inventário).`);
        }
        return card.uniqueId;
    });

    return uniqueIds;
}

/**
 * Calcula o poder total de um deck baseado nos Unique IDs das cartas.
 * @param {UserState} user - Objeto do usuário.
 * @param {string[]} uniqueIds - Array de UIDs das cartas do deck principal.
 * @returns {number} O poder total calculado.
 */
function computeDeckPower(user, uniqueIds) {
    let power = 0;
    
    // Mapeia cartas por UniqueId para lookup rápido
    const cardMap = new Map(user.cards.map(c => [c.uniqueId, c]));

    for (const uid of uniqueIds) {
        const card = cardMap.get(uid);
        if (!card) continue; // Pula se a carta não for encontrada (deve ser rara após validação)

        const template = getCardTemplate(card.cardId);
        // Garante um valor base e aplica o bônus de nível
        const basePower = template?.power || 50; 
        
        power += basePower + card.level * 4;
    }
    return Math.floor(power);
}

// ======================================================
// 💾 FUNÇÕES DE DECK (Export)
// ======================================================

/**
 * Salva um novo deck ou sobrescreve um existente.
 * @param {UserState} user - Objeto do usuário (mutável).
 * @param {string} name - Nome do deck (será normalizado para minúsculas).
 * @param {number[]} indices - Array de índices (1-based) do deck principal.
 * @param {number[]} [side=[]] - Array de índices (1-based) do side deck.
 * @returns {string} Mensagem de sucesso.
 * @throws {Error} Se as validações falharem (limite, duplicidade, tamanho).
 */
export function saveDeck(user, name, indices, side = []) {
    ensureDeckStructure(user);
    const deckName = name.toLowerCase().trim();
    
    if (!deckName) throw new Error("Nome do deck não pode ser vazio.");
    
    // 1. Validação de limite
    if (Object.keys(user.decks).length >= MAX_SAVED_DECKS && !user.decks[deckName]) {
        throw new Error(`Limite de ${MAX_SAVED_DECKS} decks atingido.`);
    }
    
    // 2. Validação e conversão para UIDs
    const mainUIDs = convertIndicesToUIDs(user, indices, MAX_CARDS_IN_DECK, 'principal');
    const sideUIDs = convertIndicesToUIDs(user, side, 0, 'side'); // expectedSize=0 para permitir 0 a MAX_SIDE_DECK
    
    // 3. Validação de Unicidade Geral: Nenhum UID pode estar no Main E no Side
    const mainSet = new Set(mainUIDs);
    for (const uid of sideUIDs) {
        if (mainSet.has(uid)) {
            throw new Error("A mesma carta não pode estar no deck principal e no side deck.");
        }
    }

    // 4. Cálculo de poder e salvamento
    const power = computeDeckPower(user, mainUIDs);
    
    user.decks[deckName] = { main: mainUIDs, side: sideUIDs, power };
    markUserDirty(user);
    
    return `Deck **${deckName}** salvo! Poder total: **${power}**.`;
}

/**
 * Carrega um deck salvo, definindo-o como o deck ativo.
 * @param {UserState} user - Objeto do usuário (mutável).
 * @param {string} name - Nome do deck a ser carregado.
 * @returns {string} Mensagem de sucesso.
 * @throws {Error} Se o deck não existir ou se as cartas originais estiverem faltando.
 */
export function loadDeck(user, name) {
    ensureDeckStructure(user);
    const deckName = name.toLowerCase().trim();
    
    const deck = user.decks[deckName];
    if (!deck) throw new Error(`O deck **${deckName}** não existe.`);
    
    // Mapeia cartas do inventário por UniqueId para lookup rápido
    const cardMap = new Map(user.cards.map(c => [c.uniqueId, c]));

    // Função auxiliar para resolver UIDs para objetos CardInventoryItem
    const resolveUIDs = (uids) => {
        const resolved = uids.map(uid => cardMap.get(uid));
        
        const missingCount = resolved.filter(x => !x).length;
        if (missingCount > 0) {
            throw new Error(`${missingCount} carta(s) deste deck (${deckName}) estão faltando ou foram destruídas.`);
        }
        return resolved;
    };
    
    const mainCards = resolveUIDs(deck.main);
    const sideCards = resolveUIDs(deck.side || []);
    
    // Define os decks ativos como objetos CardInventoryItem
    user.activeDeck = mainCards;
    user.activeSide = sideCards;
    markUserDirty(user);
    
    return `Deck **${deckName}** carregado! (${mainCards.length} principal + ${sideCards.length} side)`;
}

/**
 * Lista todos os decks salvos pelo usuário e o status do deck ativo.
 * @param {UserState} user - Objeto do usuário.
 * @returns {string} Mensagem formatada com a lista de decks.
 */
export function listDecks(user) {
    ensureDeckStructure(user);
    const names = Object.keys(user.decks);
    
    if (names.length === 0) return "Você não tem decks salvos. Salve um deck usando `!deck save <nome> <índices...>`";
    
    let response = "📚 **Seus Decks Salvos:**\n";
    for (const n of names) {
        const d = user.decks[n];
        response += `\n• **${n}** — Poder: **${d.power}** (${d.main.length} principal + ${d.side.length} side)`;
    }
    
    response += `\n\n---`;
    response += `\n**Deck Ativo:** ${user.activeDeck.length}/${MAX_CARDS_IN_DECK} cartas`;
    if (user.activeSide.length > 0) {
        response += ` | **Side Ativo:** ${user.activeSide.length}/${MAX_SIDE_DECK} cartas`;
    }
    
    return response;
}
