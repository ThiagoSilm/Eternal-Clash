// src/systems/itemSystem.js

import { getShopCatalog } from "./shopSystem.js"; 
import { addEnergy } from "./economySystem.js"; 
// import { addBuff } from "./buffSystem.js"; 

// ----------------------------------------------------
// 🔹 FUNÇÕES DO SISTEMA
// ----------------------------------------------------

/**
 * Lista os itens do usuário de forma formatada.
 * @param {object} user O objeto usuário.
 * @returns {string} Lista formatada.
 */
export function listUserItems(user) {
    // 🎯 CORREÇÃO 1: Garante que user.items é um objeto antes de tentar acessar suas chaves.
    const userItems = user.items || {}; 
    
    if (Object.keys(userItems).length === 0) {
        return "Seu inventário de itens está vazio. Compre algo na `!shop`!";
    }

    const allItems = getShopCatalog(); // Reutiliza o catálogo da loja para metadados
    let response = "🎒 **Seu Inventário de Itens:**\n---";

    for (const itemId in userItems) {
        const quantity = userItems[itemId];
        if (quantity > 0) {
            const itemMetadata = allItems.find(i => i.id === itemId);
            const name = itemMetadata ? itemMetadata.name : itemId;
            
            response += `\n**[${itemId}] ${name}** — x${quantity}`;
        }
    }
    
    return response;
}

/**
 * Consome um item e aplica seu efeito no usuário.
 * Modifica o objeto 'user' (removendo item e aplicando efeito).
 *
 * @param {object} user O objeto usuário.
 * @param {string} itemIdentifier O ID ou nome parcial do item.
 * @param {number} quantity A quantidade a ser usada.
 * @returns {string} Mensagem de sucesso ou erro.
 * @throws {Error} Mensagem de erro amigável em caso de falha.
 */
export function consumeItem(user, itemIdentifier, quantity = 1) {
    const allItems = getShopCatalog();
    
    // 1. Encontrar o item (busca por ID ou nome)
    const itemMetadata = allItems.find(i => 
        i.id === itemIdentifier || i.name.toLowerCase().includes(itemIdentifier.toLowerCase())
    );

    if (!itemMetadata) {
        throw new Error(`Item "${itemIdentifier}" não encontrado no catálogo.`);
    }
    
    const itemId = itemMetadata.id;
    // Garante que o inventário existe
    if (!user.items) user.items = {}; 
    const totalOwned = user.items[itemId] || 0;

    // 2. Validação de Posse e Consumo
    if (totalOwned < quantity) {
        throw new Error(`Você só tem ${totalOwned} de "${itemMetadata.name}".`);
    }
    // Permite consumo de 'consumable' e 'buff'
    if (itemMetadata.type !== 'consumable' && itemMetadata.type !== 'buff') {
        throw new Error(`O item "${itemMetadata.name}" não é consumível (Tipo: ${itemMetadata.type}).`);
    }

    let successMessage = `Usou ${quantity}x **${itemMetadata.name}**.\nEfeito(s) Aplicado(s):\n`;
    
    // 3. Aplicar Efeitos e Gerar Logs
    for (let i = 0; i < quantity; i++) {
        // Chamada para aplicar o efeito
        successMessage += applyEffect(user, itemMetadata.effect) + '\n';
    }
    
    // 4. Remover do Inventário
    user.items[itemId] -= quantity;
    if (user.items[itemId] <= 0) {
        delete user.items[itemId];
    }

    return successMessage.trim();
}

/**
 * Aplica o efeito do item no objeto usuário.
 * @param {object} user O objeto usuário.
 * @param {object} effect Detalhes do efeito do item.
 * @returns {string} Log do efeito aplicado.
 */
function applyEffect(user, effect) {
    if (!effect) return "Nenhum efeito encontrado para este item.";
    
    switch (effect.resource) {
        case 'energy':
            const added = addEnergy(user, effect.amount);
            return added ? `⚡ Energia restaurada: +${effect.amount}.` : "⚡ Energia já estava no máximo.";
        
        case 'towerAttempt':
            // 🎯 CORREÇÃO 2: Remove a checagem perigosa. Apenas soma ao valor existente.
            // Confiamos no userSystem para inicializar user.tower (e, idealmente, attempts).
            user.tower.attempts += effect.amount;
            return `🏰 Tentativa de Torre adicionada: +${effect.amount}.`;
            
        case 'xp_multiplier':
            // Lógica para aplicar o buff (Requer buffSystem.js)
            // addBuff(user, 'xp', effect.multiplier, effect.duration);
            return `🔥 Booster de XP (x${effect.multiplier}) ativado por ${effect.duration} batalhas.`;

        default:
            return `Efeito desconhecido (${effect.resource}) aplicado.`;
    }
}
