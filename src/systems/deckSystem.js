// -------------------------------------------------------
// 📚 DECK SYSTEM — EXPANSÃO
// -------------------------------------------------------

import { getCardTemplate } from "./cardSystem.js";
import { markUserDirty } from "./userCacheSystem.js";

export const MAX_CARDS_IN_DECK = 5;
export const MAX_SIDE_DECK = 3;
export const MAX_SAVED_DECKS = 10;

// -------------------------------------------------------
function ensureDeckStructure(user) {
    user.decks = user.decks || {};
    user.activeDeck = user.activeDeck || [];
    user.activeSide = user.activeSide || [];
    user.cards = user.cards || [];
}
// -------------------------------------------------------
function validateDeckIndices(user, indices) {
    if (indices.length !== MAX_CARDS_IN_DECK)
        throw new Error(`O deck precisa de ${MAX_CARDS_IN_DECK} cartas.`);
    
    const set = new Set(indices);
    if (set.size !== indices.length)
        throw new Error("Você colocou cartas duplicadas.");
    
    const result = [];
    for (const i of indices) {
        const card = user.cards[i - 1];
        if (!card) throw new Error(`Carta inválida no índice ${i}.`);
        result.push(card.uniqueId);
    }
    return result;
}
// -------------------------------------------------------
function validateSideIndices(user, side) {
    if (!side || side.length === 0) return [];
    if (side.length > MAX_SIDE_DECK)
        throw new Error(`Side deck pode ter no máximo ${MAX_SIDE_DECK} cartas.`);
    
    const set = new Set(side);
    if (set.size !== side.length)
        throw new Error("Side deck contém cartas duplicadas.");
    
    return side.map(i => {
        const c = user.cards[i - 1];
        if (!c) throw new Error(`Side inválido: carta ${i} não existe.`);
        return c.uniqueId;
    });
}
// -------------------------------------------------------
function computeDeckPower(user, uids) {
    let power = 0;
    for (const uid of uids) {
        const c = user.cards.find(x => x.uniqueId === uid);
        if (!c) continue;
        const t = getCardTemplate(c.cardId);
        power += (t.power || 50) + c.level * 4;
    }
    return power;
}
// -------------------------------------------------------
export function saveDeck(user, name, indices, side = []) {
    ensureDeckStructure(user);
    name = name.toLowerCase();
    
    if (Object.keys(user.decks).length >= MAX_SAVED_DECKS && !user.decks[name])
        throw new Error(`Limite de ${MAX_SAVED_DECKS} decks atingido.`);
    
    const main = validateDeckIndices(user, indices);
    const sideUIDs = validateSideIndices(user, side);
    const power = computeDeckPower(user, main);
    
    user.decks[name] = { main, side: sideUIDs, power };
    markUserDirty(user);
    
    return `Deck **${name}** salvo! Poder total: **${power}**.`;
}
// -------------------------------------------------------
export function loadDeck(user, name) {
    ensureDeckStructure(user);
    name = name.toLowerCase();
    
    const deck = user.decks[name];
    if (!deck) throw new Error(`O deck **${name}** não existe.`);
    
    const resolve = arr =>
        arr.map(uid => user.cards.find(c => c.uniqueId === uid));
    
    const main = resolve(deck.main);
    const missingMain = main.filter(x => !x).length;
    if (missingMain)
        throw new Error(`Cartas do deck principal estão faltando.`);
    
    const side = resolve(deck.side || []);
    const missingSide = side.filter(x => !x).length;
    if (missingSide)
        throw new Error(`Cartas do side deck estão faltando.`);
    
    user.activeDeck = main;
    user.activeSide = side;
    markUserDirty(user);
    
    return `Deck **${name}** carregado! (${main.length} + ${side.length} side)`;
}
// -------------------------------------------------------
export function listDecks(user) {
    ensureDeckStructure(user);
    const names = Object.keys(user.decks);
    if (names.length === 0) return "Você não tem decks salvos.";
    
    let r = "📚 **Seus Decks:**\n";
    for (const n of names) {
        const d = user.decks[n];
        r += `\n• **${n}** — Poder: **${d.power}** (${d.main.length} + ${d.side.length} side)`;
    }
    
    r += `\n\n**Deck ativo:** ${user.activeDeck.length}/${MAX_CARDS_IN_DECK}`;
    if (user.activeSide.length > 0)
        r += ` | Side: ${user.activeSide.length}/${MAX_SIDE_DECK}`;
    
    return r;
}