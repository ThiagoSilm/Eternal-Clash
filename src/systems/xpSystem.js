// src/systems/xpSystem.js

import { markUserDirty } from "./userCacheSystem.js";
// Importação do cardSystem (assumindo que existe) para buscar o nome se necessário
import { getCardTemplate } from "./cardSystem.js"; 

// --- FÓRMULAS BASE DE XP ---

/**
 * Retorna o XP total necessário para subir para um determinado nível da carta.
 * @param {number} level - O nível que será atingido.
 * @returns {number} O XP cumulativo necessário.
 */
function getBaseCardXPRequired(level) {
    // Exemplo de fórmula: 50 * (level ^ 1.5)
    return Math.floor(50 * Math.pow(level, 1.5));
}

/**
 * Retorna o XP necessário APENAS para passar do nível atual (currentLevel) para o próximo.
 * @param {number} currentLevel
 * @returns {number} O XP incremental.
 */
export function getCardNextLevelXP(currentLevel) {
    const MAX_LEVEL = 15;
    if (currentLevel >= MAX_LEVEL) return Infinity; 
    
    const xpForNext = getBaseCardXPRequired(currentLevel + 1);
    const xpForCurrent = getBaseCardXPRequired(currentLevel);
    
    return xpForNext - xpForCurrent; 
}


// --- FUNÇÕES DE VALOR DE XP ---

/**
 * Calcula o valor de XP que uma carta sacrificada fornece.
 * @param {Object} sacrificeCard - carta sacrificada (com raridade e level)
 */
export function getCardXPValue(sacrificeCard) {
  // Fórmula: Base (100) + Raridade * 50 + Level * 20
  const baseValue = 100;
  const rarityBonus = (sacrificeCard.rarity || 1) * 50;
  const levelBonus = (sacrificeCard.level || 1) * 20;
  
  return baseValue + rarityBonus + levelBonus;
}


// --- FUNÇÃO PRINCIPAL DE LEVEL UP ---

/**
 * Faz o level up de uma carta, processando XP ganho.
 * @param {Object} user - Objeto do usuário (para marcar como dirty)
 * @param {string} cardUniqueId - O ID único da carta a ser upada.
 * @param {number} gainedXP - A quantidade de XP a ser adicionada.
 */
export function levelUpCard(user, cardUniqueId, gainedXP) {
  const card = user.cards.find(c => c.uniqueId === cardUniqueId);
  if (!card) return { success: false, message: "❌ Carta não encontrada (uniqueId)." };
  
  const MAX_CARD_LEVEL = 15;
  
  card.xp = (card.xp || 0) + gainedXP;
  let levelsGained = 0;
  
  while (card.level < MAX_CARD_LEVEL) {
    const xpNeeded = getCardNextLevelXP(card.level);
    
    if (card.xp >= xpNeeded) {
      card.xp -= xpNeeded;
      card.level++;
      levelsGained++;
    } else {
      break;
    }
  }
  
  // 🚨 CORREÇÃO: Usando 'user.id' no lugar de 'user.userId'
  markUserDirty(user.id);
  
  if (levelsGained > 0) {
      // Tenta obter o nome da carta do template para uma mensagem mais informativa
      const cardTemplate = getCardTemplate(card.id);
      const cardDisplayName = cardTemplate?.name || card.id;
      
      return { 
          success: true, 
          levelsGained: levelsGained,
          message: `⭐ ${cardDisplayName} subiu ${levelsGained} nível(is) para o **Nível ${card.level}**!` 
      };
  }
  
  return { success: true, message: "✅ XP adicionada à carta, mas nível não foi atingido." };
}
