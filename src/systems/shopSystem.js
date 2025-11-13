// src/systems/shopSystem.js

import { spendCurrency, addEnergy } from "./economySystem.js";
import { addItemToInventory } from "./inventorySystem.js"; // Assume-se que existe um sistema para itens

// ----------------------------------------------------
// 🔹 CATÁLOGO DA LOJA
// ----------------------------------------------------

// O catálogo deve ser um array de objetos, fácil de expandir
const SHOP_CATALOG = [
  {
    id: "xp_booster_small",
    name: "Booster de XP (Pequeno)",
    description: "Ganha 2x XP por 3 batalhas.",
    currency: "gold",
    cost: 5000,
    type: "buff",
    effect: { duration: 3, multiplier: 2.0 },
  },
  {
    id: "energy_potion",
    name: "Poção de Energia",
    description: "Restaura 30 de energia instantaneamente.",
    currency: "gem",
    cost: 50,
    type: "consumable",
    effect: { amount: 30, resource: "energy" },
  },
  {
    id: "summon_coupon_gold",
    name: "Cupom de Invocação",
    description: "Um giro grátis no Altar (Tipo Ouro).",
    currency: "gem",
    cost: 100,
    type: "consumable",
    effect: { type: "coupon", summonType: "gold" },
  },
  {
    id: "tower_attempt",
    name: "Tentativa de Torre",
    description: "Restaura 1 tentativa de Torre.",
    currency: "gold",
    cost: 2500,
    type: "consumable",
    effect: { resource: "towerAttempt", amount: 1 },
  },
];

// ----------------------------------------------------
// 🔹 FUNÇÕES DO SISTEMA
// ----------------------------------------------------

/**
 * Retorna o catálogo completo da loja.
 * @returns {Array} Lista de itens.
 */
export function getShopCatalog() {
  return SHOP_CATALOG;
}

/**
 * Processa a compra de um item da loja.
 * Modifica o objeto 'user' diretamente.
 *
 * @param {object} user O objeto usuário em cache.
 * @param {string} itemId O ID do item a ser comprado.
 * @param {number} quantity A quantidade a ser comprada.
 * @returns {string} Mensagem de sucesso ou erro.
 */
export function processPurchase(user, itemId, quantity = 1) {
  const item = SHOP_CATALOG.find(i => i.id === itemId);

  if (!item) {
    return `❌ Item com ID \`${itemId}\` não encontrado na loja.`;
  }

  const totalCost = item.cost * quantity;

  // 1. Verificar Recursos
  const hasEnough = (item.currency === 'gold' && user.gold >= totalCost) ||
                    (item.currency === 'gem' && user.gems >= totalCost);

  if (!hasEnough) {
    return `💰 Recursos insuficientes. Você precisa de ${totalCost} ${item.currency.toUpperCase()}.`;
  }

  // 2. Subtrair Recursos
  // A função spendCurrency (do economySystem) deve modificar user.gold ou user.gems
  const spent = spendCurrency(user, item.currency, totalCost);
  
  if (!spent) {
      // Isso só deve acontecer se a verificação anterior falhar, mas é um bom fail-safe
      return "⚠️ Falha crítica ao subtrair recursos. Tente novamente.";
  }

  let logMessage = `✅ Compra realizada: **${item.name}** (x${quantity}). ${totalCost} ${item.currency.toUpperCase()} gasto(s).\n`;

  // 3. Entregar o Item
  if (item.type === 'consumable') {
    // Lida com consumíveis (e.g., Poções de Energia, Tentativas de Torre)
    for (let i = 0; i < quantity; i++) {
        logMessage += deliverConsumable(user, item.effect) + "\n";
    }
  } else {
    // Lida com itens que vão para o inventário (e.g., Boosters, Cupons, Itens)
    // Assume-se que addItemToInventory é genérico
    const added = addItemToInventory(user, itemId, quantity); 
    logMessage += `Adicionado ao seu inventário de itens.`;
  }
  
  // O objeto 'user' foi modificado (gasto e item adicionado/recurso entregue).
  return logMessage.trim();
}

/**
 * Lógica específica para entregar um consumível.
 * Modifica o objeto 'user'.
 * @param {object} user O objeto usuário.
 * @param {object} effect Os detalhes do efeito do item.
 * @returns {string} Mensagem de entrega.
 */
function deliverConsumable(user, effect) {
    switch (effect.resource) {
        case 'energy':
            // addEnergy(user, amount) deve ser a função do economySystem
            const added = addEnergy(user, effect.amount);
            return added 
                ? `⚡ Energia restaurada: +${effect.amount}.` 
                : `⚡ Energia no máximo. A poção não teve efeito.`;
        
        case 'towerAttempt':
            // Garante que a estrutura exista
            if (!user.tower) user.tower = { attempts: 0 };
            user.tower.attempts += effect.amount;
            return `🏰 Tentativa de Torre restaurada: +${effect.amount}.`;
            
        // Se houver outros recursos consumíveis (e.g., tickets de arena)
        default:
            return `⚠️ Item consumível ${effect.resource} entregue (Lógica a ser implementada).`;
    }
}
