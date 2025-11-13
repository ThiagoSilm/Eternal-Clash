// src/systems/deckSystem.js

// ----------------------------------------------------
// 🔹 CONFIGURAÇÃO
// ----------------------------------------------------

const MAX_CARDS_IN_DECK = 3; // Limite de cartas no deck de batalha
const MAX_SAVED_DECKS = 5;   // Limite de configurações salvas por usuário

// ----------------------------------------------------
// 🔹 FUNÇÕES DO SISTEMA
// ----------------------------------------------------

/**
 * Salva a configuração atual de cartas como um deck nomeado.
 * Modifica o objeto 'user'.
 *
 * @param {object} user O objeto usuário.
 * @param {string} name O nome do deck a ser salvo.
 * @param {Array<number>} indices Os índices (1-based) das cartas no inventário.
 * @returns {string} Mensagem de sucesso ou erro.
 */
export function saveDeck(user, name, indices) {
    name = name.toLowerCase();

    // 1. Validação da Quantidade
    if (indices.length !== MAX_CARDS_IN_DECK) {
        return `O deck deve ter exatamente ${MAX_CARDS_IN_DECK} cartas. Você forneceu ${indices.length}.`;
    }

    // 2. Validação dos Índices
    const uniqueIndices = new Set(indices);
    if (uniqueIndices.size !== indices.length) {
        return "Índices de cartas duplicados não são permitidos.";
    }

    const validUniqueCardIds = [];
    for (const index of indices) {
        const cardIndex = index - 1; // Converter para 0-based
        const card = user.cards[cardIndex];
        
        if (!card) {
            return `Índice de carta inválido: ${index}.`;
        }
        validUniqueCardIds.push(card.uniqueId);
    }
    
    // 3. Validação do Limite
    if (Object.keys(user.decks).length >= MAX_SAVED_DECKS && !user.decks[name]) {
        return `Você atingiu o limite de ${MAX_SAVED_DECKS} decks salvos. Exclua um antes de salvar um novo.`;
    }

    // 4. Salvamento
    user.decks[name] = validUniqueCardIds; 
    
    return `Deck **${name}** salvo com sucesso! (Contém ${validUniqueCardIds.length} cartas).`;
}

/**
 * Carrega um deck salvo para o array de deck ativo do usuário.
 * Modifica o objeto 'user'.
 *
 * @param {object} user O objeto usuário.
 * @param {string} name O nome do deck a ser carregado.
 * @returns {string} Mensagem de sucesso ou erro.
 */
export function loadDeck(user, name) {
    name = name.toLowerCase();
    
    const savedDeck = user.decks[name];

    if (!savedDeck) {
        return `O deck **${name}** não foi encontrado. Use \`!setdeck list\`.`;
    }
    
    // 1. Mapear UniqueIDs de volta para instâncias de carta
    const newActiveDeck = savedDeck.map(uniqueId => 
        user.cards.find(c => c.uniqueId === uniqueId)
    ).filter(c => c !== undefined); // Remove cartas que possam ter sido vendidas ou queimadas
    
    if (newActiveDeck.length !== MAX_CARDS_IN_DECK) {
        return `⚠️ O deck **${name}** está incompleto (${newActiveDeck.length}/${MAX_CARDS_IN_DECK}). Recarregue as cartas com \`!setdeck save\`.`;
    }

    // 2. Aplicar ao deck ativo do usuário (Assumimos que user.activeDeck é o array usado para batalha)
    user.activeDeck = newActiveDeck;
    
    return `Deck **${name}** carregado com sucesso! Pronto para a batalha.`;
}

/**
 * Lista todos os decks salvos pelo usuário.
 * @param {object} user O objeto usuário.
 * @returns {string} Lista formatada.
 */
export function listDecks(user) {
    const deckNames = Object.keys(user.decks);
    
    if (deckNames.length === 0) {
        return "Você não tem nenhum deck salvo. Salve um com `!setdeck save <nome> <idx1>...`";
    }
    
    let response = "📝 **Seus Decks Salvos:**\n---";
    deckNames.forEach(name => {
        response += `\n• **${name}** (${user.decks[name].length}/${MAX_CARDS_IN_DECK} cartas salvas)`;
    });
    
    // Assumimos que o deck ativo é o user.activeDeck
    const activeDeckStatus = user.activeDeck?.length === MAX_CARDS_IN_DECK 
        ? "✅ Ativo" 
        : "⚠️ Não configurado";
        
    response += `\n\n**Deck Ativo:** ${activeDeckStatus}`;
    
    return response;
}
