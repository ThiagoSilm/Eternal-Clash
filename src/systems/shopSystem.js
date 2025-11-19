// src/systems/shopSystem.js

import { spendCurrency, addEnergy, addGold, addXP, addGems } from "./economySystem.js";
import { addItemToInventory } from "./inventorySystem.js";
import { markUserDirty } from "./userCacheSystem.js";
import { getTowerStatus } from "./towerSystem.js";

// --------------------------------------------------------
// 🛒 TABELA BASE DE ITENS PERMANENTES
// --------------------------------------------------------

const SHOP_CATALOG = [

  // =====================
  // ⭐ ITENS PREMIUM BASE
  // =====================
  {
    id: "xp_booster_small",
    name: "Booster de XP (Pequeno)",
    description: "Ganha 2x XP por 3 batalhas.",
    currency: "gem",
    price: 675,
    type: "buff",
    effect: { duration: 3, multiplier: 2.0 },
  },
  {
    id: "energy_potion",
    name: "Poção de Energia",
    description: "Restaura 30 de energia.",
    currency: "gem",
    price: 50,
    type: "consumable",
    effect: { resource: "energy", amount: 30 },
  },
  {
    id: "summon_coupon_gold",
    name: "Cupom de Invocação Ouro",
    description: "1 giro grátis no altar Ouro.",
    currency: "gem",
    price: 95,
    type: "consumable",
    effect: { type: "coupon", summonType: "gold" },
  },

  // =====================
  // 🏰 TORRE
  // =====================
  {
    id: "tower_attempt",
    name: "Tentativa de Torre",
    description: "Restaura 1 tentativa.",
    currency: "gold",
    price: 2500,
    type: "consumable",
    effect: { resource: "towerAttempt", amount: 1 },
  },

  // =====================
  // 💎 ITENS PARA LUCRAR
  // =====================

  {
    id: "gem_pack_small",
    name: "Pacote de Gemas (Pequeno)",
    description: "+120 Gemas",
    currency: "gold",
    price: 50000,
    type: "instant",
    effect: { give: "gem", amount: 120 },
  },
  {
    id: "gem_pack_large",
    name: "Pacote de Gemas (Grande)",
    description: "+300 Gemas",
    currency: "gold",
    price: 120000,
    type: "instant",
    effect: { give: "gem", amount: 300 },
  },
  {
    id: "mega_energy_bundle",
    name: "Pacote Mega Energia",
    description: "+150 energia",
    currency: "gem",
    price: 220,
    type: "consumable",
    effect: { resource: "energy", amount: 150 },
  },

  // =====================
  // 🎁 PACOTES VIP
  // =====================

  {
    id: "vip_starter_pack",
    name: "Pacote VIP (Iniciante)",
    description: "Gemas + Ouro + Cupom + XP Booster",
    currency: "gem",
    price: 650,
    type: "bundle",
    effect: {
      items: [
        { give: "gem", amount: 150 },
        { give: "gold", amount: 20000 },
        { giveCoupon: "gold", amount: 1 },
        { buff: "xp_small", duration: 3 }
      ]
    }
  },

  // =====================
  // 🔥 OFERTA DIÁRIA DINÂMICA
  // =====================
  {
    id: "daily_offer",
    name: "Oferta Diária",
    description: "Pacote especial, muda todo dia.",
    currency: "gem",
    price: 200,
    type: "dynamic",
  }
];

// --------------------------------------------------------
// 🛍️ RETORNA LISTA COM OFERTAS MOLDADAS AO USUÁRIO
// --------------------------------------------------------
export function getShopCatalog(user) {
  return SHOP_CATALOG.map(item => {
    if (item.id !== "daily_offer") return item;

    const seed = (new Date().getUTCDate() + user.id * 13) % 3;

    const offers = [
      { name: "Pacote de Energia x2", price: 90, effect: { resource: "energy", amount: 60 }, type: "consumable" },
      { name: "Gemas Bônus", price: 200, effect: { give: "gem", amount: 160 }, type: "instant" },
      { name: "Cupom Raro (Ouro)", price: 175, effect: { type: "coupon", summonType: "gold" }, type: "consumable" },
    ];

    const chosen = offers[seed];
    return { ...item, ...chosen, id: "daily_offer" };
  });
}

// --------------------------------------------------------
// ⚡ RETORNA PREÇO DINÂMICO
// --------------------------------------------------------
export function getDynamicPrice(user, item) {
  if (!item || item.id !== "daily_offer") return item?.price || 0;

  const daily = getShopCatalog(user).find(i => i.id === "daily_offer");
  return daily?.price || item.price;
}

// --------------------------------------------------------
// 💰 PROCESSAR COMPRA
// --------------------------------------------------------
export function processPurchase(user, itemId, quantity = 1) {
  const item = getShopCatalog(user).find(i => i.id === itemId);
  if (!item) throw new Error(`Item não encontrado.`);

  const totalCost = getDynamicPrice(user, item) * quantity;
  spendCurrency(user, item.currency, totalCost);

  let log = `🛒 **${item.name}** comprado x${quantity}\n`;
  log += `💸 Pago: ${totalCost} ${item.currency.toUpperCase()}\n`;

  log += deliverItem(user, item, quantity);

  markUserDirty(user);
  return log;
}

// --------------------------------------------------------
// 🎁 ENTREGA DO ITEM
// --------------------------------------------------------
function deliverItem(user, item, quantity) {
  const eff = item.effect;

  if (item.type === "consumable" || item.type === "buff") {
    return deliverConsumable(user, eff, quantity);
  }

  if (item.type === "instant") {
    const total = eff.amount * quantity;
    if (eff.give === "gold") addGold(user, total);
    if (eff.give === "gem") addGems(user, total);
    if (eff.give === "xp") addXP(user, total);
    return `✨ Você recebeu +${total} ${eff.give.toUpperCase()}.`;
  }

  if (eff.type === "coupon") {
    addItemToInventory(user, `${eff.summonType}_coupon`, quantity);
    return `🎟️ Cupom adicionado x${quantity}.`;
  }

  if (item.type === "bundle") {
    let msg = "";
    for (const entry of eff.items) {
      if (entry.give === "gold") { addGold(user, entry.amount); msg += `💰 +${entry.amount} Gold\n`; }
      if (entry.give === "gem") { addGems(user, entry.amount); msg += `💎 +${entry.amount} Gemas\n`; }
      if (entry.giveCoupon) {
        addItemToInventory(user, `${entry.giveCoupon}_coupon`, entry.amount);
        msg += `🎟️ Cupom (${entry.giveCoupon}) +${entry.amount}\n`;
      }
      if (entry.buff) {
        msg += `🔥 Buff aplicado (x${entry.duration} batalhas)\n`;
      }
    }
    return msg;
  }

  return `✔️ Item entregue.`;
}

// --------------------------------------------------------
// ⚡ CONSUMÍVEIS
// --------------------------------------------------------
function deliverConsumable(user, effect, qty) {
  if (effect.resource === "energy") {
    const amount = effect.amount * qty;
    addEnergy(user, amount);
    return `⚡ Energia +${amount}`;
  }

  if (effect.resource === "towerAttempt") {
    if (!user.tower) user.tower = { floor: 1, attempts: 3, lastAccess: 0 };
    user.tower.attempts += effect.amount * qty;
    return `🏰 Tentativas +${effect.amount * qty}`;
  }

  return `Consumível entregue.`;
}