// src/systems/xpSystem.js
import { markUserDirty } from "./userCacheSystem.js";

// --- FÓRMULAS BASE DE XP ---

/**
 * Retorna o XP total necessário para subir para um determinado nível da carta.
 * Nota: Esta é a fórmula para Cartas, diferente da fórmula de XP do Jogador (economySystem).
 * @param {number} level - O nível que será atingido (ex: 2 para passar do 1 para o 2).
 * @returns {number} O XP cumulativo necessário.
 */
function getBaseCardXPRequired(level) {
    // Exemplo de fórmula: 50 * (level ^ 1.5)
    return Math.floor(50 * Math.pow(level, 1.5));
}

/**
 * Retorna o XP necessário APENAS para passar do nível atual (currentLevel) para o próximo.
 * Esta é a função que outros sistemas devem chamar.
 * @param {number} currentLevel
 * @returns {number} O XP incremental.
 */
export function getCardNextLevelXP(currentLevel) {
    if (currentLevel >= 15) return Infinity; // Nível máximo
    
    const xpForNext = getBaseCardXPRequired(currentLevel + 1);
    const xpForCurrent = getBaseCardXPRequired(currentLevel);
    
    // XP incremental necessário
    return xpForNext - xpForCurrent; 
}


// --- FUNÇÕES DE VALOR DE XP ---

/**
 * Calcula o valor de XP que uma carta sacrificada fornece.
 * @param {Object} sacrificeCard - carta sacrificada (com raridade e level)
 */
export function getCardXPValue(sacrificeCard) {
  // Fórmula revisada para ser mais impactante e usar a raridade
  // Ex: Base (100) + Raridade * 50 + Level * 20
  const baseValue = 100;
  const rarityBonus = (sacrificeCard.rarity || 1) * 50;
  const levelBonus = (sacrificeCard.level || 1) * 20;
  
  return baseValue + rarityBonus + levelBonus;
}


// --- FUNÇÃO PRINCIPAL DE LEVEL UP ---

/**
 * Faz o level up de uma carta, processando XP ganho.
 * Este módulo não se preocupa com o sacrifício/gasto de ouro, apenas com a progressão.
 * @param {Object} user - Objeto do usuário (para marcar como dirty)
 * @param {string} cardUniqueId - O ID único da carta a ser upada.
 * @param {number} gainedXP - A quantidade de XP a ser adicionada.
 */
export function levelUpCard(user, cardUniqueId, gainedXP) {
  const card = user.cards.find(c => c.uniqueId === cardUniqueId);
  if (!card) return { success: false, message: "❌ Carta não encontrada (uniqueId)." };
  
  // Limite de nível para evitar loops infinitos ou progressão indesejada
  const MAX_CARD_LEVEL = 15;
  
  card.xp = (card.xp || 0) + gainedXP;
  let leveledUp = false;
  let levelsGained = 0;
  
  while (card.level < MAX_CARD_LEVEL) {
    const xpNeeded = getCardNextLevelXP(card.level);
    
    if (card.xp >= xpNeeded) {
      card.xp -= xpNeeded;
      card.level++;
      levelsGained++;
      leveledUp = true;
      
      // NOTA: A lógica de desbloqueio de efeitos (evolved/unlockedEvolution)
      // foi REMOVIDA daqui para evitar conflito com o CardSystem/Meld.
      // O level-up é puramente para aumentar o nível e stats base (se houver lógica para isso).
      
    } else {
      break;
    }
  }
  
  markUserDirty(user.userId);
  
  if (levelsGained > 0) {
      return { 
          success: true, 
          levelsGained: levelsGained,
          message: `⭐ ${card.name} subiu ${levelsGained} nível(is) para o **Nível ${card.level}**!` 
      };
  }
  
  return { success: true, message: "✅ XP adicionada à carta, mas nível não foi atingido." };
}
