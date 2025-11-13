// src/systems/shopSystem.js

import { spendCurrency, addEnergy } from "./economySystem.js";
import { addItemToInventory } from "./inventorySystem.js"; 
// Importação de sistemas de terceiros (Tower) se necessário para lógica complexa
import { advanceFloor } from "./towerSystem.js"; 


// ----------------------------------------------------
// 🔹 CATÁLOGO DA LOJA
// ----------------------------------------------------

const SHOP_CATALOG = [
  // ... (Itens inalterados) ...
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
    currency: "gem", // Mantido como 'gem'
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

export function getShopCatalog() {
  return SHOP_CATALOG;
}

/**
 * Processa a compra de um item da loja.
 *
 * @param {object} user O objeto usuário em cache.
 * @param {string} itemId O ID do item a ser comprado.
 * @param {number} quantity A quantidade a ser comprada.
 * @returns {string} Mensagem de sucesso.
 * @throws {Error} Se o item não for encontrado ou os recursos forem insuficientes.
 */
export function processPurchase(user, itemId, quantity = 1) {
  const item = SHOP_CATALOG.find(i => i.id === itemId);

  if (!item) {
    throw new Error(`❌ Item com ID \`${itemId}\` não encontrado na loja.`);
  }

  const totalCost = item.cost * quantity;

  // 1. Subtrair Recursos
  // 🎯 CORREÇÃO: Removemos a checagem manual e confiamos no spendCurrency.
  // Se o saldo for insuficiente, spendCurrency LANÇARÁ um Error.
  spendCurrency(user, item.currency, totalCost); 
  // Se chegarmos aqui, o custo foi debitado com sucesso.

  let logMessage = `✅ Compra realizada: **${item.name}** (x${quantity}). ${totalCost} ${item.currency.toUpperCase()} gasto(s).\n`;

  // 2. Entregar o Item
  if (item.type === 'consumable' || item.type === 'buff') { 
    // Buffs e Consumíveis são entregues pelo deliverConsumable/efeito imediato
    for (let i = 0; i < quantity; i++) {
        // Concatenamos a mensagem de entrega
        logMessage += deliverConsumable(user, item.effect) + "\n";
    }
  } else {
    // Itens que vão para o inventário (ex: materiais, cupons)
    // Se o efeito for um cupom, ele deve ser adicionado ao inventário de itens/cupons
    const added = addItemToInventory(user, itemId, quantity); 
    logMessage += `Adicionado ao seu inventário de itens.`;
  }
  
  // Confiança: O Middleware fará o markUserDirty() após a execução do comando.
  return logMessage.trim();
}

/**
 * Lógica específica para entregar um consumível ou aplicar um efeito imediato.
 * @param {object} user O objeto usuário.
 * @param {object} effect Os detalhes do efeito do item.
 * @returns {string} Mensagem de entrega.
 */
function deliverConsumable(user, effect) {
    switch (effect.resource) {
        case 'energy':
            // addEnergy é a função do economySystem
            const added = addEnergy(user, effect.amount);
            return added 
                ? `⚡ Energia restaurada: +${effect.amount}.` 
                : `⚡ Energia no máximo. A poção não teve efeito.`;
        
        case 'towerAttempt':
            // 🎯 CORREÇÃO: Removemos a checagem perigosa 'if (!user.tower)'.
            // Confiamos no userSystem para inicializar user.tower.
            user.tower.attempts += effect.amount;
            return `🏰 Tentativa de Torre restaurada: +${effect.amount}.`;
            
        case 'coupon':
             // Adiciona cupons ao inventário/recursos, se não for um efeito imediato
             addItemToInventory(user, effect.summonType + "_coupon", 1);
             return `🎟️ Cupom de Invocação (${effect.summonType}) adicionado ao inventário.`;
             
        // Se houver outros recursos consumíveis ou buffs (ex: ativa o buff)
        default:
            return `⚠️ Item consumível ${effect.resource} entregue (Lógica a ser implementada).`;
    }
}
