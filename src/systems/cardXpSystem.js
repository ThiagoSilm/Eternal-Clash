// src/systems/cardXpSystem.js

import { saveUser } from "./userSystem.js";
import { getCardTemplate, removeCardFromUser } from "./cardSystem.js";

// =========================================================
// ⚙️ CONFIGURAÇÃO E CONSTANTES
// =========================================================

const CONFIG = {
  maxLevel: 20,
  
  // Curva de XP
  xpPower: 2.1,
  xpBaseMultiplier: 60,
  rarityXpBonus: 0.12, // +12% por tier de raridade
  
  // Valores de queima (dusting)
  dustBaseValue: 80,
  dustRarityMultiplier: 1.35,
  dustRarityBonus: 50,
  dustLevelBonus: 25,
  
  // Sistema de Maestria
  masteryEnabled: true,
  masteryPointsPerXp: 0.1, // 1 ponto de maestria a cada 10 XP
  masteryRewardsEnabled: true,
};

const RARITY_NAMES = {
  1: "Comum",
  2: "Incomum", 
  3: "Raro",
  4: "Épico",
  5: "Lendário",
};

// =========================================================
// 📊 SISTEMA DE CURVA DE XP
// =========================================================

class CardXPCurve {
  /**
   * Calcula XP total acumulada necessária para atingir um nível
   */
  static getBaseXPRequired(level, rarity = 1) {
    if (level <= 1) return 0;
    if (level > CONFIG.maxLevel) {
      return this.getBaseXPRequired(CONFIG.maxLevel, rarity);
    }

    // Fórmula exponencial: (Level - 1)^Power * Base_XP
    const base = Math.pow(level - 1, CONFIG.xpPower) * CONFIG.xpBaseMultiplier;
    
    // Raridade aumenta custo exponencialmente
    const rarityMultiplier = 1 + (rarity - 1) * CONFIG.rarityXpBonus;
    
    return Math.floor(base * rarityMultiplier);
  }

  /**
   * Calcula XP necessária para o próximo nível
   */
  static getNextLevelXP(card) {
    if (!card || card.level >= CONFIG.maxLevel) {
      return Infinity;
    }

    const currentLevelXP = this.getBaseXPRequired(card.level, card.rarity);
    const nextLevelXP = this.getBaseXPRequired(card.level + 1, card.rarity);
    
    return nextLevelXP - currentLevelXP;
  }

  /**
   * Calcula porcentagem de progresso para o próximo nível
   */
  static getProgressPercent(card) {
    if (!card) return 0;
    if (card.level >= CONFIG.maxLevel) return 100;

    const needed = this.getNextLevelXP(card);
    if (needed === Infinity || needed === 0) return 100;

    return Math.min(100, Math.floor((card.xp / needed) * 100));
  }

  /**
   * Retorna tabela de XP completa para uma raridade
   */
  static getXPTable(rarity = 1) {
    const table = [];
    
    for (let level = 1; level <= CONFIG.maxLevel; level++) {
      const totalXP = this.getBaseXPRequired(level, rarity);
      const nextLevelXP = level < CONFIG.maxLevel 
        ? this.getBaseXPRequired(level + 1, rarity) - totalXP
        : 0;

      table.push({
        level,
        totalXP,
        nextLevelXP,
      });
    }

    return table;
  }
}

// =========================================================
// 🔥 SISTEMA DE QUEIMA (DUSTING)
// =========================================================

class CardDustingSystem {
  /**
   * Calcula XP obtida ao queimar uma carta
   */
  static calculateDustValue(card) {
    if (!card) return 0;

    const level = card.level || 1;
    const rarity = card.rarity || 1;

    // Base Value
    const baseValue = CONFIG.dustBaseValue;

    // Bônus de Raridade (exponencial)
    const rarityBonus = Math.pow(CONFIG.dustRarityMultiplier, rarity) * CONFIG.dustRarityBonus;

    // Bônus de Nível (linear)
    const levelBonus = level * CONFIG.dustLevelBonus;

    // Bônus de Maestria (se existir)
    const masteryBonus = card.masteryXp ? Math.floor(card.masteryXp * 0.5) : 0;

    const totalValue = Math.floor(baseValue + rarityBonus + levelBonus + masteryBonus);

    return {
      total: totalValue,
      breakdown: {
        base: baseValue,
        rarity: Math.floor(rarityBonus),
        level: levelBonus,
        mastery: masteryBonus,
      },
    };
  }

  /**
   * Queima uma carta e retorna sua XP
   */
  static async burnCard(user, cardUniqueId) {
    // Encontra a carta antes de remover
    const card = user.cards.find(c => c.uniqueId === cardUniqueId);
    
    if (!card) {
      return {
        success: false,
        gainedXP: 0,
        message: "❌ Carta não encontrada no inventário.",
      };
    }

    // Previne queima de cartas equipadas em decks
    if (this._isCardEquipped(user, cardUniqueId)) {
      return {
        success: false,
        gainedXP: 0,
        message: "❌ Não é possível queimar uma carta equipada em um deck.",
      };
    }

    // Calcula valor
    const dustValue = this.calculateDustValue(card);
    
    // Remove carta
    const removalResult = removeCardFromUser(user, cardUniqueId);
    
    if (!removalResult || !removalResult.success) {
      return {
        success: false,
        gainedXP: 0,
        message: "❌ Falha ao remover carta do inventário.",
      };
    }

    // Obtém template para nome
    const template = getCardTemplate(card.id);
    const cardName = template?.name || card.id;
    const rarityName = RARITY_NAMES[card.rarity] || "Desconhecida";

    // Salva mudanças
    await saveUser(user);

    return {
      success: true,
      gainedXP: dustValue.total,
      burnedCard: card,
      breakdown: dustValue.breakdown,
      message: `🔥 **${cardName}** (${rarityName} Lv.${card.level}) foi sacrificada!\n` +
               `💎 Ganhou **${dustValue.total} XP** de poeira mágica.`,
    };
  }

  /**
   * Queima múltiplas cartas de uma vez
   */
  static async burnMultipleCards(user, cardUniqueIds) {
    const results = {
      success: true,
      totalXP: 0,
      burnedCards: [],
      failed: [],
    };

    for (const uniqueId of cardUniqueIds) {
      const result = await this.burnCard(user, uniqueId);
      
      if (result.success) {
        results.totalXP += result.gainedXP;
        results.burnedCards.push(result.burnedCard);
      } else {
        results.failed.push({ uniqueId, reason: result.message });
      }
    }

    return results;
  }

  /**
   * Verifica se carta está equipada em algum deck
   */
  static _isCardEquipped(user, cardUniqueId) {
    if (!user.decks || typeof user.decks !== "object") return false;

    for (const deck of Object.values(user.decks)) {
      if (Array.isArray(deck) && deck.includes(cardUniqueId)) {
        return true;
      }
    }

    return false;
  }
}

// =========================================================
// ⬆️ SISTEMA DE LEVEL UP
// =========================================================

class CardLevelUpSystem {
  /**
   * Aplica XP a uma carta e processa nivelamento
   */
  static async applyXP(user, cardUniqueId, baseXP, options = {}) {
    // Validações
    if (!user || !user.cards) {
      return this._errorResponse("Usuário inválido");
    }

    if (baseXP <= 0) {
      return this._errorResponse("XP deve ser maior que zero");
    }

    // Encontra carta
    const card = user.cards.find(c => c.uniqueId === cardUniqueId);
    if (!card) {
      return this._errorResponse("Carta não encontrada");
    }

    // Inicializa campos
    card.xp = card.xp || 0;
    card.level = Math.max(1, card.level || 1);
    card.rarity = card.rarity || 1;
    card.masteryXp = card.masteryXp || 0;

    // Aplica boost de XP
    const xpBoost = user.xpBoost || 1;
    const bonusBoost = options.bonusBoost || 1;
    const finalXP = Math.floor(baseXP * xpBoost * bonusBoost);

    // Template da carta
    const template = getCardTemplate(card.id);
    const cardName = template?.name || card.id;

    // Processa nivelamento
    const result = this._processLevelUp(card, finalXP);
    
    // Salva alterações
    await saveUser(user);

    // Constrói resposta
    return this._buildResponse(card, cardName, result, finalXP, options);
  }

  /**
   * Processa o nivelamento da carta
   */
  static _processLevelUp(card, xp) {
    let levelsGained = 0;
    let remainingXP = xp;
    let masteryXPGained = 0;

    card.xp += remainingXP;

    // Loop de nivelamento
    while (card.level < CONFIG.maxLevel) {
      const needed = CardXPCurve.getNextLevelXP(card);

      if (card.xp >= needed) {
        card.xp -= needed;
        card.level++;
        levelsGained++;
      } else {
        break;
      }
    }

    // Sistema de Maestria
    if (card.level >= CONFIG.maxLevel && CONFIG.masteryEnabled) {
      masteryXPGained = card.xp;
      
      if (masteryXPGained > 0) {
        const masteryPoints = Math.floor(masteryXPGained * CONFIG.masteryPointsPerXp);
        card.masteryXp += masteryPoints;
        card.xp = 0;
      }
    }

    return {
      levelsGained,
      masteryXPGained,
      currentLevel: card.level,
      currentXP: card.xp,
      masteryXP: card.masteryXp,
    };
  }

  /**
   * Constrói resposta formatada
   */
  static _buildResponse(card, cardName, result, appliedXP, options) {
    const { levelsGained, masteryXPGained, currentLevel } = result;

    // Carta chegou ao nível máximo
    if (currentLevel >= CONFIG.maxLevel && masteryXPGained > 0) {
      const masteryPoints = Math.floor(masteryXPGained * CONFIG.masteryPointsPerXp);
      
      return {
        success: true,
        levelsGained,
        maxLevel: true,
        message: `🔱 **${cardName}** já está no NÍVEL MÁXIMO!\n` +
                 `💫 Ganhou **${masteryPoints}** pontos de Maestria (Total: ${card.masteryXp})`,
        card: {
          uniqueId: card.uniqueId,
          level: card.level,
          xp: card.xp,
          masteryXp: card.masteryXp,
        },
      };
    }

    // Subiu de nível
    if (levelsGained > 0) {
      const nextLevelXP = CardXPCurve.getNextLevelXP(card);
      const progress = CardXPCurve.getProgressPercent(card);

      return {
        success: true,
        levelsGained,
        maxLevel: false,
        message: `⭐ **${cardName}** subiu **${levelsGained} nível(is)**!\n` +
                 `📊 Nível ${currentLevel} • ${card.xp}/${nextLevelXP} XP (${progress}%)`,
        card: {
          uniqueId: card.uniqueId,
          level: card.level,
          xp: card.xp,
          nextLevelXP,
          progress,
        },
      };
    }

    // Apenas ganhou XP
    const nextLevelXP = CardXPCurve.getNextLevelXP(card);
    const remaining = nextLevelXP - card.xp;
    const progress = CardXPCurve.getProgressPercent(card);

    return {
      success: true,
      levelsGained: 0,
      maxLevel: false,
      message: `✨ **${cardName}** ganhou **${appliedXP} XP**!\n` +
               `📊 Nível ${currentLevel} • Faltam ${remaining} XP para Nv.${currentLevel + 1} (${progress}%)`,
      card: {
        uniqueId: card.uniqueId,
        level: card.level,
        xp: card.xp,
        nextLevelXP,
        progress,
      },
    };
  }

  /**
   * Resposta de erro padronizada
   */
  static _errorResponse(message) {
    return {
      success: false,
      levelsGained: 0,
      message: `❌ ${message}`,
    };
  }
}

// =========================================================
// 💎 SISTEMA DE MAESTRIA (MASTERY)
// =========================================================

class CardMasterySystem {
  /**
   * Obtém rank de maestria baseado em pontos
   */
  static getMasteryRank(masteryXP) {
    if (masteryXP < 100) return { rank: "Novato", tier: 1, color: "⚪" };
    if (masteryXP < 500) return { rank: "Adepto", tier: 2, color: "🟢" };
    if (masteryXP < 1500) return { rank: "Veterano", tier: 3, color: "🔵" };
    if (masteryXP < 3000) return { rank: "Mestre", tier: 4, color: "🟣" };
    if (masteryXP < 5000) return { rank: "Grão-Mestre", tier: 5, color: "🟠" };
    return { rank: "Lendário", tier: 6, color: "🔴" };
  }

  /**
   * Calcula bônus de stats baseado em maestria
   */
  static getMasteryBonus(masteryXP) {
    const rank = this.getMasteryRank(masteryXP);
    
    return {
      attackBonus: rank.tier * 2, // +2 ATK por tier
      defenseBonus: rank.tier * 2, // +2 DEF por tier
      hpBonus: rank.tier * 5, // +5 HP por tier
      specialBonus: Math.floor(rank.tier * 1.5), // +1.5 especial por tier
    };
  }

  /**
   * Formata informações de maestria
   */
  static formatMasteryInfo(card) {
    if (!card || !card.masteryXp) {
      return "Sem maestria desbloqueada";
    }

    const rank = this.getMasteryRank(card.masteryXp);
    const bonus = this.getMasteryBonus(card.masteryXp);

    return {
      rank: rank.rank,
      tier: rank.tier,
      color: rank.color,
      points: card.masteryXp,
      bonus: bonus,
      display: `${rank.color} ${rank.rank} (${card.masteryXp} pts)`,
    };
  }
}

// =========================================================
// 📤 API PÚBLICA
// =========================================================

// Curva de XP
export const getNextLevelXP = (card) => CardXPCurve.getNextLevelXP(card);
export const getProgressPercent = (card) => CardXPCurve.getProgressPercent(card);
export const getXPTable = (rarity) => CardXPCurve.getXPTable(rarity);

// Sistema de Queima
export const getCardXPValue = (card) => CardDustingSystem.calculateDustValue(card);
export const burnCardForXp = (user, cardUniqueId) => CardDustingSystem.burnCard(user, cardUniqueId);
export const burnMultipleCards = (user, cardIds) => CardDustingSystem.burnMultipleCards(user, cardIds);

// Sistema de Level Up
export const levelUpCard = (user, cardUniqueId, xp, options) => CardLevelUpSystem.applyXP(user, cardUniqueId, xp, options);
export const applyXPToCard = levelUpCard; // Alias

// Sistema de Maestria
export const getMasteryRank = (masteryXP) => CardMasterySystem.getMasteryRank(masteryXP);
export const getMasteryBonus = (masteryXP) => CardMasterySystem.getMasteryBonus(masteryXP);
export const getMasteryInfo = (card) => CardMasterySystem.formatMasteryInfo(card);

// Utilitários
export const getCardLevel = (card) => card?.level || 1;
export const isMaxLevel = (card) => card?.level >= CONFIG.maxLevel;
export const canLevelUp = (card) => card?.level < CONFIG.maxLevel;

// Configuração
export const getConfig = () => ({ ...CONFIG });
export const updateConfig = (newConfig) => Object.assign(CONFIG, newConfig);

// =========================================================
// 📊 EXPORTAÇÃO PADRÃO
// =========================================================

export default {
  // Curva de XP
  getNextLevelXP,
  getProgressPercent,
  getXPTable,
  
  // Queima
  getCardXPValue,
  burnCardForXp,
  burnMultipleCards,
  
  // Level Up
  levelUpCard,
  applyXPToCard,
  
  // Maestria
  getMasteryRank,
  getMasteryBonus,
  getMasteryInfo,
  
  // Utilitários
  getCardLevel,
  isMaxLevel,
  canLevelUp,
  getConfig,
  updateConfig,
};