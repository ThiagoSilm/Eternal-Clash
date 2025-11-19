// src/systems/cardXpSystem.js

import { markUserDirty } from "./userCacheSystem.js";
// Assumindo que estas são as funções necessárias do cardSystem
import { getCardTemplate, removeCardFromUser } from "./cardSystem.js"; 

// =========================================================
// ⚙️ CONFIGURAÇÃO E TIPAGEM
// =========================================================

/**
 * @typedef {object} CardState
 * @property {string} id - ID do template da carta.
 * @property {string} uniqueId - ID único da instância.
 * @property {number} level - Nível atual da carta.
 * @property {number} xp - XP acumulada no nível atual.
 * @property {number} rarity - Raridade da carta (1-5).
 * @property {number} [masteryXp=0] - XP acumulada após atingir o nível máximo.
 */

/**
 * @typedef {object} UserState
 * @property {string} id
 * @property {number} [xpBoost=1] - Multiplicador de XP ativo.
 * @property {CardState[]} cards - Array de cartas do usuário.
 */

const MAX_CARD_LEVEL = 20;

// =========================================================
// 📈 CÁLCULO DE XP NECESSÁRIA (CURVA DE NÍVEL)
// =========================================================

/**
 * Calcula a XP total acumulada necessária para atingir um nível.
 * @param {number} level - Nível alvo.
 * @param {number} rarity - Raridade da carta.
 * @returns {number} XP total requerida (acumulada desde o Nv. 1).
 */
function getBaseCardXPRequired(level, rarity = 1) {
    if (level <= 1) return 0;
    if (level > MAX_CARD_LEVEL) return getBaseCardXPRequired(MAX_CARD_LEVEL, rarity);

    // Curva: exponencial (suave no começo, pesado no fim)
    // Formula: (Level - 1)^Power * Base_XP
    const POWER = 2.1;
    const BASE_XP_MULTIPLIER = 60; 
    
    const base = Math.pow(level - 1, POWER) * BASE_XP_MULTIPLIER;
    
    // Raridade aumenta custo em +12% por tier
    const rarityMult = 1 + (rarity - 1) * 0.12;
    
    return Math.floor(base * rarityMult);
}

/**
 * Retorna a quantidade de XP necessária para avançar do nível atual para o próximo.
 * @param {CardState} card
 * @returns {number} XP restante para o próximo nível. Retorna Infinity se for Nível Máximo.
 */
export function getCardNextLevelXP(card) {
    if (card.level >= MAX_CARD_LEVEL) return Infinity;
    
    // XP do próximo nível - XP do nível atual = XP necessária para o incremento
    return (
        getBaseCardXPRequired(card.level + 1, card.rarity) -
        getBaseCardXPRequired(card.level, card.rarity)
    );
}

// =========================================================
// ♻️ XP POR QUEIMAR CARTA (DUSTING)
// =========================================================

/**
 * Calcula a quantidade de XP obtida ao sacrificar/queimar uma carta.
 * @param {CardState} card - A carta a ser queimada.
 * @returns {number} A quantidade de XP que a carta fornece.
 */
export function getCardXPValue(card) {
    // Base + Bônus de Raridade (exponencial) + Bônus de Nível (linear)
    const BASE_VALUE = 80;
    const RARITY_BONUS = Math.pow(1.35, (card.rarity || 1)) * 50;
    const LEVEL_BONUS = (card.level || 1) * 25;
    
    return Math.floor(BASE_VALUE + RARITY_BONUS + LEVEL_BONUS);
}

/**
 * Remove uma carta do inventário do usuário e aplica a XP resultante a um recurso
 * ou a outra carta (dependendo da sua implementação de `levelUpCard`).
 *
 * NOTA: O código original aplica XP diretamente em `levelUpCard`. 
 * Mantenho a XP como retorno aqui e a aplicação deve ser feita chamando `levelUpCard`.
 *
 * @param {UserState} user - Objeto do usuário (mutável).
 * @param {string} cardUniqueId - ID único da carta a ser queimada.
 * @returns {{success: boolean, gainedXP: number, message: string, burnedCard?: CardState}} Resultado.
 */
export function burnCardForXp(user, cardUniqueId) {
    // Assumimos que removeCardFromUser retorna o objeto da carta removida.
    const removalResult = removeCardFromUser(user, cardUniqueId); 
    
    if (!removalResult || !removalResult.success || !removalResult.removedCard) {
        return { success: false, gainedXP: 0, message: "❌ Carta não encontrada ou falha na remoção." };
    }
    
    const card = removalResult.removedCard;
    const gainedXP = getCardXPValue(card);
    
    // Não precisamos marcar como dirty aqui, pois `removeCardFromUser` deve fazê-lo.
    
    const template = getCardTemplate(card.id);
    const name = template?.name || card.id;
    
    return {
        success: true,
        gainedXP,
        burnedCard: card,
        message: `🔥 **${name}** (Lv.${card.level}) foi sacrificada: **+${gainedXP} XP**`
    };
}

// =========================================================
// ⬆️ APLICAR XP E SUBIR DE NÍVEL
// =========================================================

/**
 * Aplica XP a uma carta específica e processa o nivelamento.
 *
 * @param {UserState} user - Objeto do usuário.
 * @param {string} cardUniqueId - ID único da carta que receberá a XP.
 * @param {number} baseGainedXP - A quantidade base de XP a ser adicionada.
 * @returns {{success: boolean, levelsGained: number, message: string, cardLevel?: number, nextLevelXP?: number}} Resultado.
 */
export function levelUpCard(user, cardUniqueId, baseGainedXP) {
    /** @type {CardState} */
    const card = user.cards.find(c => c.uniqueId === cardUniqueId);
    if (!card) return { success: false, levelsGained: 0, message: "❌ Carta não encontrada." };
    
    // 1. Aplica Boost Global de XP
    const xpBoost = user.xpBoost || 1;
    const totalGainedXP = Math.floor(baseGainedXP * xpBoost);

    if (totalGainedXP <= 0) {
        return { success: false, levelsGained: 0, message: "⚠️ Nenhuma XP ganha (baseGainedXP é zero ou negativa)." };
    }
    
    // Inicializa campos, se necessário
    if (typeof card.xp !== 'number' || card.xp < 0) card.xp = 0;
    if (typeof card.level !== 'number' || card.level < 1) card.level = 1;
    
    let levelsGained = 0;
    card.xp += totalGainedXP;
    
    // 2. Loop de Nivelamento
    while (card.level < MAX_CARD_LEVEL) {
        const needed = getCardNextLevelXP(card);
        
        if (card.xp >= needed) {
            card.xp -= needed;
            card.level++;
            levelsGained++;
        } else {
            break;
        }
    }
    
    // 3. Processamento de XP no Nível Máximo (Mastery XP)
    if (card.level >= MAX_CARD_LEVEL) {
        // Garante que o nível não ultrapasse o máximo
        card.level = MAX_CARD_LEVEL; 
        
        // Transfere o XP excedente para Mastery XP
        if (card.xp > 0) {
            card.masteryXp = (card.masteryXp || 0) + card.xp;
            card.xp = 0;
            markUserDirty(user.id);
            
            // Retorna a mensagem de Mastery
            return {
                success: true,
                levelsGained,
                message: `🔱 Carta atingiu o **NÍVEL MÁXIMO**! Acumulou ${levelsGained} nível(is) e **+${totalGainedXP} XP** em Maestria.`
            };
        }
    }
    
    // 4. Finalização
    markUserDirty(user.id);
    
    if (levelsGained > 0) {
        return {
            success: true,
            levelsGained,
            cardLevel: card.level,
            message: `⭐ ${card.id} subiu **${levelsGained} nível(is)**! Novo Nível: ${card.level}`
        };
    }
    
    const nextLevelXP = getCardNextLevelXP(card);
    const remainingXP = nextLevelXP - card.xp;
    
    return {
        success: true,
        levelsGained: 0,
        cardLevel: card.level,
        nextLevelXP: nextLevelXP,
        message: `✨ XP aplicada (+${totalGainedXP} XP). Faltam **${remainingXP} XP** para o Nv. ${card.level + 1}.`
    };
}
