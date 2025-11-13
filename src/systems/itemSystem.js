// src/systems/itemSystem.js

import { getShopCatalog } from "./shopSystem.js";
import { addEnergy, addGold, addXP } from "./economySystem.js";

// ----------------------------------------------------
// 🔹 BUFF SYSTEM INTERNO
// ----------------------------------------------------

/**
 * Adiciona um buff ao usuário.
 * @param {object} user 
 * @param {string} type Tipo do buff: 'xp', 'attack', 'defense'
 * @param {number} multiplier Valor do multiplicador
 * @param {number} duration Duração em batalhas
 */
function addBuff(user, type, multiplier, duration) {
    if (!user.buffs) user.buffs = {};
    if (!user.buffs[type]) user.buffs[type] = [];
    user.buffs[type].push({ multiplier, duration });
}

/**
 * Atualiza buffs após uma batalha, diminuindo duração e removendo expirados.
 * @param {object} user 
 */
export function updateBuffsAfterBattle(user) {
    if (!user.buffs) return;
    for (const type in user.buffs) {
        user.buffs[type] = user.buffs[type].filter(buff => {
            buff.duration -= 1;
            return buff.duration > 0;
        });
    }
}

/**
 * Retorna multiplicador ativo de determinado tipo.
 * @param {object} user 
 * @param {string} type 
 * @returns {number}
 */
export function getActiveMultiplier(user, type) {
    if (!user.buffs || !user.buffs[type]) return 1;
    return user.buffs[type].reduce((acc, b) => acc * b.multiplier, 1);
}

// ----------------------------------------------------
// 🔹 INVENTÁRIO E ITENS
// ----------------------------------------------------

export function listUserItems(user) {
    const userItems = user.items || {};
    if (Object.keys(userItems).length === 0) return "Seu inventário de itens está vazio. Compre algo na `!shop`!";
    
    const allItems = getShopCatalog();
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

export function consumeItem(user, itemIdentifier, quantity = 1) {
    if (quantity <= 0) throw new Error("Quantidade inválida.");
    
    const allItems = getShopCatalog();
    const itemMetadata = allItems.find(i =>
        i.id === itemIdentifier || i.name.toLowerCase().includes(itemIdentifier.toLowerCase())
    );
    if (!itemMetadata) throw new Error(`Item "${itemIdentifier}" não encontrado no catálogo.`);
    
    if (!user.items) user.items = {};
    const totalOwned = user.items[itemMetadata.id] || 0;
    if (totalOwned < quantity) throw new Error(`Você só tem ${totalOwned} de "${itemMetadata.name}".`);
    if (!['consumable', 'buff'].includes(itemMetadata.type))
        throw new Error(`O item "${itemMetadata.name}" não é consumível (Tipo: ${itemMetadata.type}).`);
    
    if (!user.tower) user.tower = { attempts: 0, floor: 1, lastAttemptReset: 0 };
    if (!user.buffs) user.buffs = {};
    
    let successMessage = `Usou ${quantity}x **${itemMetadata.name}**.\nEfeito(s) Aplicado(s):\n`;
    for (let i = 0; i < quantity; i++) {
        successMessage += applyEffect(user, itemMetadata.effect) + '\n';
    }
    
    user.items[itemMetadata.id] -= quantity;
    if (user.items[itemMetadata.id] <= 0) delete user.items[itemMetadata.id];
    
    return successMessage.trim();
}

function applyEffect(user, effect) {
    if (!effect) return "Nenhum efeito encontrado para este item.";
    
    switch (effect.resource) {
        case 'energy': {
            const added = addEnergy(user, effect.amount);
            return added ? `⚡ Energia restaurada: +${effect.amount}.` : "⚡ Energia já estava no máximo.";
        }
        case 'towerAttempt': {
            user.tower.attempts += effect.amount;
            return `🏰 Tentativa de Torre adicionada: +${effect.amount}.`;
        }
        case 'xp_multiplier': {
            addBuff(user, 'xp', effect.multiplier, effect.duration);
            return `🔥 Booster de XP (x${effect.multiplier}) ativado por ${effect.duration} batalhas.`;
        }
        case 'attack_multiplier': {
            addBuff(user, 'attack', effect.multiplier, effect.duration);
            return `⚔️ Buff de Ataque (x${effect.multiplier}) ativado por ${effect.duration} batalhas.`;
        }
        case 'defense_multiplier': {
            addBuff(user, 'defense', effect.multiplier, effect.duration);
            return `🛡️ Buff de Defesa (x${effect.multiplier}) ativado por ${effect.duration} batalhas.`;
        }
        case 'gold': {
            addGold(user, effect.amount);
            return `💰 Recebeu ${effect.amount} de ouro.`;
        }
        case 'xp': {
            addXP(user, effect.amount);
            return `✨ Recebeu ${effect.amount} de XP.`;
        }
        default:
            return `Efeito desconhecido (${effect.resource}) aplicado.`;
    }
}