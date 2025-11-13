const MAX_CARDS_IN_DECK = 3;
const MAX_SAVED_DECKS = 5;

function ensureDeckStructure(user) {
    user.decks = user.decks || {};
    user.activeDeck = user.activeDeck || [];
    user.cards = user.cards || [];
}

export function saveDeck(user, name, indices) {
    ensureDeckStructure(user);
    name = name.toLowerCase();
    
    if (indices.length !== MAX_CARDS_IN_DECK) {
        throw new Error(`O deck deve ter exatamente ${MAX_CARDS_IN_DECK} cartas. Você forneceu ${indices.length}.`);
    }
    
    const uniqueIndices = new Set(indices);
    if (uniqueIndices.size !== indices.length) {
        throw new Error("Índices de cartas duplicados não são permitidos.");
    }
    
    const validUniqueCardIds = [];
    for (const index of indices) {
        const card = user.cards[index - 1];
        if (!card) {
            throw new Error(`Índice de carta inválido ou carta ausente: ${index}.`);
        }
        validUniqueCardIds.push(card.uniqueId);
    }
    
    if (Object.keys(user.decks).length >= MAX_SAVED_DECKS && !user.decks.hasOwnProperty(name)) {
        throw new Error(`Você atingiu o limite de ${MAX_SAVED_DECKS} decks salvos. Exclua um antes de salvar um novo.`);
    }
    
    user.decks[name] = validUniqueCardIds;
    return `Deck **${name}** salvo com sucesso! (Contém ${validUniqueCardIds.length} cartas).`;
}

export function loadDeck(user, name) {
    ensureDeckStructure(user);
    name = name.toLowerCase();
    
    const savedDeck = user.decks[name];
    if (!savedDeck) throw new Error(`O deck **${name}** não foi encontrado. Use \`!deck list\`.`);
    
    const newActiveDeck = savedDeck.map(uid => user.cards.find(c => c.uniqueId === uid));
    const missingCount = newActiveDeck.filter(c => !c).length;
    
    if (missingCount > 0) {
        const missingIndexes = savedDeck.filter((uid, i) => !newActiveDeck[i]);
        throw new Error(`⚠️ O deck **${name}** está incompleto. Cartas faltando: ${missingIndexes.join(", ")}.`);
    }
    
    user.activeDeck = newActiveDeck;
    return `Deck **${name}** carregado com sucesso! **${newActiveDeck.length}** cartas ativas, pronto para a batalha.`;
}

export function listDecks(user) {
    ensureDeckStructure(user);
    const deckNames = Object.keys(user.decks);
    
    if (deckNames.length === 0) {
        return "Você não tem nenhum deck salvo. Salve um com `!deck save <nome> <idx1>...`";
    }
    
    let response = "📝 **Seus Decks Salvos:**\n---";
    deckNames.forEach(name => {
        response += `\n• **${name}** (${user.decks[name].length}/${MAX_CARDS_IN_DECK} cartas salvas)`;
    });
    
    const activeDeckCount = user.activeDeck.length;
    const activeDeckStatus = activeDeckCount === MAX_CARDS_IN_DECK ?
        `✅ Ativo (${activeDeckCount})` :
        `⚠️ Incompleto/Não configurado (${activeDeckCount}/${MAX_CARDS_IN_DECK})`;
    
    response += `\n\n**Deck de Batalha Ativo:** ${activeDeckStatus}`;
    return response;
}