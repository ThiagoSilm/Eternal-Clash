// src/systems/xpSystem.js

import { markUserDirty } from "./userCacheSystem.js";
// ⚠️ ASSUMINDO que estas funções existem e são exportadas de cardSystem.js
import { getCardTemplate, removeCardFromUser } from "./cardSystem.js"; 

// --- CONSTANTES ---
const MAX_CARD_LEVEL = 15;

// --- FÓRMULAS BASE DE XP ---

/**
 * Retorna o XP total NECESSÁRIO para alcançar um determinado nível da carta.
 * @param {number} level - O nível que será atingido.
 * @returns {number} O XP cumulativo necessário.
 */
function getBaseCardXPRequired(level) {
    if (level <= 1) return 0;
    // Exemplo de fórmula: 50 * (level ^ 1.5)
    return Math.floor(50 * Math.pow(level - 1, 1.5));
}

/**
 * Retorna o XP necessário APENAS para passar do nível atual (currentLevel) para o próximo.
 * @param {number} currentLevel
 * @returns {number} O XP incremental.
 */
export function getCardNextLevelXP(currentLevel) {
    if (currentLevel >= MAX_CARD_LEVEL) return Infinity; 
    
    const xpForNext = getBaseCardXPRequired(currentLevel + 1);
    const xpForCurrent = getBaseCardXPRequired(currentLevel);
    
    // Calcula o XP que precisa ser adicionado ao XP atual da carta
    return xpForNext - xpForCurrent; 
}


// --- FUNÇÕES DE VALOR DE XP ---

/**
 * Calcula o valor de XP que uma carta sacrificada fornece.
 * @param {Object} sacrificeCard - carta sacrificada (com raridade e level)
 */
export function getCardXPValue(sacrificeCard) {
  // Fórmula base que você forneceu: Base (100) + Raridade * 50 + Level * 20
  const baseValue = 100;
  // Assumindo que raridade e level são pelo menos 1
  const rarityBonus = (sacrificeCard.rarity || 1) * 50;
  const levelBonus = (sacrificeCard.level || 1) * 20;
  
  return baseValue + rarityBonus + levelBonus;
}


// --- FUNÇÃO DE SACRIFÍCIO (QUEIMAR CARTA) ---

/**
 * Remove uma carta do inventário do usuário e calcula o XP que ela fornece.
 * @param {Object} user - Objeto do usuário (contendo o array de cartas).
 * @param {string} cardUniqueId - O ID único da carta a ser queimada/sacrificada.
 * @returns {Object} Um objeto com { success: boolean, gainedXP: number, burnedCard: Object|null, message: string }.
 */
export function burnCardForXp(user, cardUniqueId) {
    const cardIndex = user.cards.findIndex(c => c.uniqueId === cardUniqueId);

    if (cardIndex === -1) {
        return { 
            success: false, 
            gainedXP: 0, 
            burnedCard: null, 
            message: "❌ Carta de sacrifício não encontrada (uniqueId)." 
        };
    }

    // 1. Obtém a carta para cálculo
    const sacrificeCard = user.cards[cardIndex];
    
    // 2. Calcula o XP que a carta fornece
    const gainedXP = getCardXPValue(sacrificeCard);

    // 3. Remove a carta do inventário do usuário
    // ⚠️ Idealmente, usaríamos removeCardFromUser(user, cardUniqueId);
    // Mas, como pode não existir, usamos a remoção direta:
    user.cards.splice(cardIndex, 1);
    
    // 4. Marca o usuário como "sujo" (dirty) para salvar
    markUserDirty(user.id); // 🟢 CORREÇÃO: Usando 'user.id'

    // 5. Prepara a mensagem de retorno
    const cardTemplate = getCardTemplate(sacrificeCard.id);
    const cardDisplayName = cardTemplate?.name || sacrificeCard.id;

    return { 
        success: true, 
        gainedXP: gainedXP, 
        burnedCard: sacrificeCard, 
        message: `🔥 Carta **${cardDisplayName}** (Nv. ${sacrificeCard.level || 1}) sacrificada por **${gainedXP} XP**!` 
    };
}


// --- FUNÇÃO PRINCIPAL DE LEVEL UP ---

/**
 * Faz o level up de uma carta, processando XP ganho.
 * @param {Object} user - Objeto do usuário (para marcar como dirty)
 * @param {string} cardUniqueId - O ID único da carta a ser upada.
 * @param {number} gainedXP - A quantidade de XP a ser adicionada.
 * @returns {Object} O resultado da operação.
 */
export function levelUpCard(user, cardUniqueId, gainedXP) {
  const card = user.cards.find(c => c.uniqueId === cardUniqueId);
  if (!card) return { success: false, message: "❌ Carta não encontrada (uniqueId)." };
  
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
  
  // Marca o usuário como "sujo" (dirty) para salvar
  markUserDirty(user.id); // 🟢 CORREÇÃO: Usando 'user.id'
  
  const cardTemplate = getCardTemplate(card.id);
  const cardDisplayName = cardTemplate?.name || card.id;

  if (levelsGained > 0) {
      return { 
          success: true, 
          levelsGained: levelsGained,
          message: `⭐ ${cardDisplayName} subiu ${levelsGained} nível(is) para o **Nível ${card.level}**!` 
      };
  }
  
  // Se a carta já estiver no nível máximo
  if (card.level >= MAX_CARD_LEVEL) {
     return { success: true, message: `✅ ${cardDisplayName} está no nível máximo (**Nv. ${MAX_CARD_LEVEL}**). XP excedente adicionado.` };
  }

  // Se o XP foi adicionado, mas o nível não foi atingido
  return { success: true, message: "✅ XP adicionada à carta, mas nível não foi atingido." };
}
