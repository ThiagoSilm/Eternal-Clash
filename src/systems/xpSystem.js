// ----------------------------------------------
// 🔥 CARD XP SYSTEM — EXPANSÃO 2.0
// ----------------------------------------------

import { markUserDirty } from "./userCacheSystem.js";
import { getCardTemplate, removeCardFromUser } from "./cardSystem.js";

const MAX_CARD_LEVEL = 20;

// ----------------------------------------------
// 📌 Funções básicas
// ----------------------------------------------

function getBaseCardXPRequired(level, rarity = 1) {
    if (level <= 1) return 0;
    
    // Curva nova: mais suave no começo, pesada no fim
    const base = Math.pow(level - 1, 2.1) * 60;
    
    // Raridade aumenta custo em +10% por tier
    const rarityMult = 1 + (rarity - 1) * 0.12;
    
    return Math.floor(base * rarityMult);
}

export function getCardNextLevelXP(card) {
    if (card.level >= MAX_CARD_LEVEL) return Infinity;
    return (
        getBaseCardXPRequired(card.level + 1, card.rarity) -
        getBaseCardXPRequired(card.level, card.rarity)
    );
}

// ----------------------------------------------
// 💠 XP por queimar carta (mais fiel à raridade)
// ----------------------------------------------

export function getCardXPValue(card) {
    const base = 80;
    const rarityBonus = Math.pow(1.35, (card.rarity || 1)) * 50;
    const levelBonus = (card.level || 1) * 25;
    
    return Math.floor(base + rarityBonus + levelBonus);
}

// ----------------------------------------------
// 🔥 Burn Card → XP
// ----------------------------------------------

export function burnCardForXp(user, cardUniqueId) {
    const removal = removeCardFromUser(user, cardUniqueId);
    if (!removal.success)
        return { success: false, gainedXP: 0, message: "❌ Carta não encontrada." };
    
    const card = removal.removedCard;
    const gainedXP = getCardXPValue(card);
    
    markUserDirty(user.id);
    
    const temp = getCardTemplate(card.id);
    const name = temp?.name || card.id;
    
    return {
        success: true,
        gainedXP,
        burnedCard: card,
        message: `🔥 ${name} (Lv.${card.level}) foi sacrificada: +${gainedXP} XP`
    };
}

// ----------------------------------------------
// ⭐ Aplicar XP e subir de nível
// ----------------------------------------------

export function levelUpCard(user, cardId, gainedXP) {
    const card = user.cards.find(c => c.uniqueId === cardId);
    if (!card) return { success: false, message: "❌ Carta não encontrada." };
    
    // Boost global de XP (altar, premium, evento, etc)
    const xpBoost = user.xpBoost || 1;
    
    card.xp = (card.xp || 0) + gainedXP * xpBoost;
    
    let levelsGained = 0;
    
    while (card.level < MAX_CARD_LEVEL) {
        const needed = getCardNextLevelXP(card);
        if (card.xp >= needed) {
            card.xp -= needed;
            card.level++;
            levelsGained++;
        } else break;
    }
    
    // Se chegou no level máximo → XP vira "Mastery XP"
    if (card.level >= MAX_CARD_LEVEL) {
        card.masteryXp = (card.masteryXp || 0) + card.xp;
        card.xp = 0;
        markUserDirty(user.id);
        
        return {
            success: true,
            levelsGained,
            message: `🔱 ${card.id} atingiu o **NÍVEL MÁXIMO** e começou a juntar **Mastery XP**!`
        };
    }
    
    markUserDirty(user.id);
    
    if (levelsGained > 0) {
        return {
            success: true,
            levelsGained,
            message: `⭐ ${card.id} subiu **${levelsGained} nível(is)** → Nv. ${card.level}`
        };
    }
    
    return {
        success: true,
        levelsGained: 0,
        message: `✨ XP aplicada. Faltam ${getCardNextLevelXP(card) - card.xp} XP para o próximo nível.`
    };
}