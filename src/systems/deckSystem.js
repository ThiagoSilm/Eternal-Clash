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
 * [HELPER] Garante que a estrutura de decks (salvos e ativos) exista.
 */
function ensureDeckStructure(user) {
    if (!user.decks) {
        // user.decks armazena os decks salvos (ex: { 'main': [id1, id2, id3] })
        user.decks = {};
    }
    if (!user.activeDeck) {
        // user.activeDeck armazena as INSTÂNCIAS de cartas para a batalha
        user.activeDeck = [];
    }
}


/**
 * Salva a configuração atual de cartas como um deck nomeado.
 * Modifica o objeto 'user'.
 *
 * @param {object} user O objeto usuário.
 * @param {string} name O nome do deck a ser salvo.
 * @param {Array<number>} indices Os índices (1-based) das cartas no inventário.
 * @returns {string} Mensagem de sucesso ou erro.
 * @throws {Error} Para erros de validação.
 */
export function saveDeck(user, name, indices) {
    ensureDeckStructure(user);
    name = name.toLowerCase();

    // 1. Validação da Quantidade
    if (indices.length !== MAX_CARDS_IN_DECK) {
        throw new Error(`O deck deve ter exatamente ${MAX_CARDS_IN_DECK} cartas. Você forneceu ${indices.length}.`);
    }

    // 2. Validação dos Índices (Índices únicos e válidos)
    const uniqueIndices = new Set(indices);
    if (uniqueIndices.size !== indices.length) {
        throw new Error("Índices de cartas duplicados não são permitidos.");
    }

    const validUniqueCardIds = [];
    for (const index of indices) {
        const cardIndex = index - 1; // Converter para 0-based
        const card = user.cards[cardIndex];
        
        if (!card) {
            throw new Error(`Índice de carta inválido: ${index}.`);
        }
        // Garante que é uma INSTÂNCIA de carta válida e viva (não vendida/queimada)
        validUniqueCardIds.push(card.uniqueId); 
    }
    
    // 3. Validação do Limite (apenas se for um NOVO nome)
    if (Object.keys(user.decks).length >= MAX_SAVED_DECKS && !user.decks.hasOwnProperty(name)) {
        throw new Error(`Você atingiu o limite de ${MAX_SAVED_DECKS} decks salvos. Exclua um antes de salvar um novo.`);
    }

    // 4. Salvamento: O deck salvo guarda apenas os IDs únicos.
    user.decks[name] = validUniqueCardIds; 
    
    // 5. Opcional: Definir como deck ativo após salvar
    // user.activeDeck = validUniqueCardIds.map(uid => user.cards.find(c => c.uniqueId === uid));
    
    return `Deck **${name}** salvo com sucesso! (Contém ${validUniqueCardIds.length} cartas).`;
}

/**
 * Carrega um deck salvo para o array de deck ativo do usuário.
 * Modifica o objeto 'user'.
 *
 * @param {object} user O objeto usuário.
 * @param {string} name O nome do deck a ser carregado.
 * @returns {string} Mensagem de sucesso ou erro.
 * @throws {Error} Para decks não encontrados ou incompletos.
 */
export function loadDeck(user, name) {
    ensureDeckStructure(user);
    name = name.toLowerCase();
    
    const savedDeck = user.decks[name];

    if (!savedDeck) {
        throw new Error(`O deck **${name}** não foi encontrado. Use \`!deck list\`.`);
    }
    
    // 1. Mapear UniqueIDs de volta para instâncias de carta
    const newActiveDeck = savedDeck.map(uniqueId => 
        // Busca a carta em todo o inventário do usuário
        user.cards.find(c => c.uniqueId === uniqueId)
    ).filter(c => c !== undefined); 
    
    if (newActiveDeck.length !== MAX_CARDS_IN_DECK) {
        throw new Error(`⚠️ O deck **${name}** está incompleto (${newActiveDeck.length}/${MAX_CARDS_IN_DECK} cartas ativas). Algumas cartas foram vendidas/queimadas. Salve novamente com \`!deck save ${name} <idx1>...\`.`);
    }

    // 2. Aplicar ao deck ativo do usuário (Contém as INSTÂNCIAS para a batalha)
    user.activeDeck = newActiveDeck;
    
    return `Deck **${name}** carregado com sucesso! **${newActiveDeck.length}** cartas ativas, pronto para a batalha.`;
}

/**
 * Lista todos os decks salvos pelo usuário.
 * @param {object} user O objeto usuário.
 * @returns {string} Lista formatada.
 */
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
    
    // Status do deck ativo
    const activeDeckCount = user.activeDeck?.length || 0;
    const activeDeckStatus = activeDeckCount === MAX_CARDS_IN_DECK 
        ? `✅ Ativo (${activeDeckCount})` 
        : `⚠️ Incompleto/Não configurado (${activeDeckCount}/${MAX_CARDS_IN_DECK})`;
        
    response += `\n\n**Deck de Batalha Ativo:** ${activeDeckStatus}`;
    
    return response;
}
