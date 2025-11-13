import { spendCurrency, addEnergy } from "./economySystem.js";
import { addItemToInventory } from "./inventorySystem.js";
import { initializeTower } from "./towerSystem.js";

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

export function getShopCatalog() {
  return SHOP_CATALOG;
}

export function processPurchase(user, itemId, quantity = 1) {
  const item = SHOP_CATALOG.find(i => i.id === itemId);
  if (!item) throw new Error(`Item com ID \`${itemId}\` não encontrado na loja.`);

  const totalCost = item.cost * quantity;
  spendCurrency(user, item.currency, totalCost);

  let logMessage = `Compra realizada: **${item.name}** (x${quantity}). ${totalCost} ${item.currency.toUpperCase()} gasto(s).\n`;

  if (item.type === 'consumable' || item.type === 'buff') {
    logMessage += deliverConsumable(user, item.effect, quantity);
  } else {
    addItemToInventory(user, itemId, quantity);
    logMessage += `Adicionado ao inventário de itens.`;
  }

  return logMessage.trim();
}

function deliverConsumable(user, effect, quantity = 1) {
  switch (effect.resource) {
    case 'energy':
      const addedEnergy = addEnergy(user, effect.amount * quantity);
      return addedEnergy ? `⚡ Energia restaurada: +${effect.amount * quantity}.` : `⚡ Energia no máximo.`;

    case 'towerAttempt':
      initializeTower(user);
      user.tower.attempts += effect.amount * quantity;
      return `🏰 Tentativa de Torre restaurada: +${effect.amount * quantity}.`;

    case 'coupon':
      addItemToInventory(user, effect.summonType + "_coupon", quantity);
      return `🎟️ Cupom de Invocação (${effect.summonType}) adicionado ao inventário.`;

    default:
      return `Item consumível ${effect.resource} entregue (${quantity}x).`;
  }
}