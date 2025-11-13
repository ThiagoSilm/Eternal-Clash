import { markUserDirty } from "./userCacheSystem.js";
import { getCardTemplate, removeCardFromUser } from "./cardSystem.js";

const MAX_CARD_LEVEL = 15;

function getBaseCardXPRequired(level) {
    if (level <= 1) return 0;
    return Math.floor(50 * Math.pow(level - 1, 1.5));
}

export function getCardNextLevelXP(currentLevel) {
    if (currentLevel >= MAX_CARD_LEVEL) return Infinity;
    return getBaseCardXPRequired(currentLevel + 1) - getBaseCardXPRequired(currentLevel);
}

export function getCardXPValue(card) {
    const base = 100;
    const rarityBonus = (card.rarity || 1) * 50;
    const levelBonus = (card.level || 1) * 20;
    return base + rarityBonus + levelBonus;
}

export function burnCardForXp(user, cardUniqueId) {
    const removalResult = removeCardFromUser(user, cardUniqueId);
    if (!removalResult.success) {
        return { success: false, gainedXP: 0, burnedCard: null, message: "❌ Carta de sacrifício não encontrada." };
    }
    const burnedCard = removalResult.removedCard;
    const gainedXP = getCardXPValue(burnedCard);
    markUserDirty(user.id);
    const cardTemplate = getCardTemplate(burnedCard.id);
    const cardDisplayName = cardTemplate?.name || burnedCard.id;
    return { success: true, gainedXP, burnedCard, message: `🔥 Carta ${cardDisplayName} (Nv. ${burnedCard.level || 1}) sacrificada por ${gainedXP} XP!` };
}

export function levelUpCard(user, cardUniqueId, gainedXP) {
    const card = user.cards.find(c => c.uniqueId === cardUniqueId);
    if (!card) return { success: false, message: "❌ Carta não encontrada." };
    
    card.xp = (card.xp || 0) + gainedXP;
    let levelsGained = 0;
    
    while (card.level < MAX_CARD_LEVEL) {
        const xpNeeded = getCardNextLevelXP(card.level);
        if (card.xp >= xpNeeded) {
            card.xp -= xpNeeded;
            card.level++;
            levelsGained++;
        } else break;
    }
    
    markUserDirty(user.id);
    const cardTemplate = getCardTemplate(card.id);
    const cardDisplayName = cardTemplate?.name || card.id;
    
    if (card.level >= MAX_CARD_LEVEL) {
        card.xp = 0;
        return { success: true, levelsGained, message: `✅ ${cardDisplayName} atingiu o nível máximo (${MAX_CARD_LEVEL}).` };
    }
    
    if (levelsGained > 0) {
        return { success: true, levelsGained, message: `⭐ ${cardDisplayName} subiu ${levelsGained} nível(is) para o Nível ${card.level}!` };
    }
    
    return { success: true, levelsGained: 0, message: `✅ XP adicionada à carta, mas nível não foi atingido.` };
}