// src/systems/shopSystem.js

import { spendCurrency, addEnergy } from "./economySystem.js";
import { addItemToInventory } from "./inventorySystem.js";
import { getTowerStatus } from "./towerSystem.js"; // substitui initializeTower inexistente

// --------------------------------------------------------
// 🛒 CATÁLOGO DA LOJA
// --------------------------------------------------------

const SHOP_CATALOG = [
  {
    id: "xp_booster_small",
    name: "Booster de XP (Pequeno)",
    description: "Ganha 2x XP por 3 batalhas.",
    currency: "gem",
    price: 675, // 🔥 alterado conforme pedido
    type: "buff",
    effect: { duration: 3, multiplier: 2.0 },
  },
  {
    id: "energy_potion",
    name: "Poção de Energia",
    description: "Restaura 30 de energia instantaneamente.",
    currency: "gem",
    price: 50,
    type: "consumable",
    effect: { amount: 30, resource: "energy" },
  },
  {
    id: "summon_coupon_gold",
    name: "Cupom de Invocação",
    description: "Um giro grátis no Altar (Tipo Ouro).",
    currency: "gem",
    price: 100,
    type: "consumable",
    effect: { type: "coupon", summonType: "gold" },
  },
  {
    id: "tower_attempt",
    name: "Tentativa de Torre",
    description: "Restaura 1 tentativa de Torre.",
    currency: "gold",
    price: 2500,
    type: "consumable",
    effect: { resource: "towerAttempt", amount: 1 },
  },
];

// --------------------------------------------------------
// 🔎 RETORNA A LOJA
// --------------------------------------------------------
export function getShopCatalog() {
  return SHOP_CATALOG;
}

// --------------------------------------------------------
// 🛍️ PROCESSAR COMPRA
// --------------------------------------------------------
export function processPurchase(user, itemId, quantity = 1) {
  const item = SHOP_CATALOG.find(i => i.id === itemId);
  if (!item) throw new Error(`Item com ID \`${itemId}\` não encontrado na loja.`);

  const totalCost = item.price * quantity; // 🔥 FIXADO
  spendCurrency(user, item.currency, totalCost);

  let logMessage =
    `Compra realizada: **${item.name}** (x${quantity}).\n` +
    `💸 Gasto: ${totalCost} ${item.currency.toUpperCase()}\n`;

  if (item.type === "consumable" || item.type === "buff") {
    logMessage += deliverConsumable(user, item.effect, quantity);
  } else {
    addItemToInventory(user, itemId, quantity);
    logMessage += `📦 Item adicionado ao inventário.`;
  }

  return logMessage.trim();
}

// --------------------------------------------------------
// 🎁 ENTREGA DO ITEM
// --------------------------------------------------------
function deliverConsumable(user, effect, quantity = 1) {
  // Energia
  if (effect.resource === "energy") {
    const amount = effect.amount * quantity;
    const added = addEnergy(user, amount);
    return added
      ? `⚡ Energia restaurada: +${amount}.`
      : `⚡ Sua energia já está no máximo.`;
  }

  // Tentativa de Torre
  if (effect.resource === "towerAttempt") {
    if (!user.tower) user.tower = { floor: 1, attempts: 3, lastAccess: 0 };
    user.tower.attempts += effect.amount * quantity;
    return `🏰 Tentativa de Torre restaurada: +${effect.amount * quantity}.`;
  }

  // Cupom
  if (effect.type === "coupon") {
    addItemToInventory(user, `${effect.summonType}_coupon`, quantity);
    return `🎟️ Cupom de Invocação (${effect.summonType}) adicionado ao inventário.`;
  }

  return `Item consumível entregue (${quantity}x).`;
}