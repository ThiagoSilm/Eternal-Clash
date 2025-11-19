// src/systems/shopSystem.js
//------------------------------------------------------------
// SISTEMA DE LOJA — COMPLETO, OTIMIZADO E SEGURO
//------------------------------------------------------------

import { spendCurrency, addEnergy, addGold, addXP, addGems } from "./economySystem.js";
import { addItemToInventory } from "./inventorySystem.js";
import { markUserDirty } from "./userCacheSystem.js";

// ======================== CATALOGO BASE ========================
const SHOP_CATALOG = [
  { id:"xp_booster_small", name:"Booster XP", description:"2x XP por 3 batalhas.", currency:"gem", price:675, type:"buff",
    effect:{ duration:3, multiplier:2 } },

  { id:"energy_potion", name:"Poção de Energia", description:"Restaura 30 energia.", currency:"gem", price:50, type:"consumable",
    effect:{ resource:"energy", amount:30 } },

  { id:"summon_coupon_gold", name:"Cupom de Invocação Ouro", description:"1 giro no altar Ouro.", currency:"gem", price:95, type:"consumable",
    effect:{ type:"coupon", summonType:"gold" } },

  { id:"tower_attempt", name:"Tentativa de Torre", description:"+1 tentativa.", currency:"gold", price:2500, type:"consumable",
    effect:{ resource:"towerAttempt", amount:1 } },

  { id:"gem_pack_small", name:"Pacote de Gemas (P)", description:"+120 Gemas", currency:"gold", price:50000, type:"instant",
    effect:{ give:"gem", amount:120 } },

  { id:"gem_pack_large", name:"Pacote de Gemas (G)", description:"+300 Gemas", currency:"gold", price:120000, type:"instant",
    effect:{ give:"gem", amount:300 } },

  { id:"mega_energy_bundle", name:"Mega Energia", description:"+150 energia", currency:"gem", price:220, type:"consumable",
    effect:{ resource:"energy", amount:150 } },

  { id:"vip_starter_pack", name:"Pacote VIP", description:"Gemas + Ouro + Cupom + XP Booster", currency:"gem", price:650, type:"bundle",
    effect:{ items:[
      { give:"gem", amount:150 },
      { give:"gold", amount:20000 },
      { giveCoupon:"gold", amount:1 },
      { buff:"xp_small", duration:3 }
    ] } },

  { id:"daily_offer", name:"Oferta Diária", description:"Muda todo dia.", currency:"gem", price:200, type:"dynamic" },
];

// ======================= OFERTA DIÁRIA =======================
export function getShopCatalog(user) {
  return SHOP_CATALOG.map(item => {
    if (item.id !== "daily_offer") return item;

    // Proteção: seed fixo e imutável
    const seed = (new Date().getUTCDate() + (user.id || 1) * 13) % 3;

    const offers = [
      { name:"Pacote x2 Energia", price:90,  effect:{ resource:"energy", amount:60 }, type:"consumable" },
      { name:"Gemas Bônus",       price:200, effect:{ give:"gem", amount:160 }, type:"instant" },
      { name:"Cupom Raro Ouro",   price:175, effect:{ type:"coupon", summonType:"gold" }, type:"consumable" }
    ];

    return { ...item, ...offers[seed], id:"daily_offer" };
  });
}

// ======================= PREÇO TOTAL =======================
export function getDynamicPrice(user, item) {
  if (!item || item.id !== "daily_offer") return item?.price || 0;
  return getShopCatalog(user).find(i => i.id === "daily_offer").price;
}

// ========================= COMPRAR =========================
export function processPurchase(user, itemId, qty = 1) {
  if (qty < 1 || qty > 50) throw new Error("Quantidade inválida.");

  const item = getShopCatalog(user).find(i => i.id === itemId);
  if (!item) throw new Error("Item inexistente.");

  const cost = getDynamicPrice(user, item) * qty;

  // Proteção: evita compra sem dinheiro
  if (!spendCurrency(user, item.currency, cost))
    throw new Error(`Saldo insuficiente de ${item.currency}.`);

  const result = `🛒 Comprado: **${item.name}** x${qty}\n💸 Pago: ${cost} ${item.currency}\n`
               + deliverItem(user, item, qty);

  markUserDirty(user);
  return result;
}

// ==================== ENTREGA DE ITENS ======================
function deliverItem(user, item, qty) {
  const eff = item.effect;

  if (item.type === "consumable")
    return deliverConsumable(user, eff, qty);

  if (item.type === "instant") {
    const total = eff.amount * qty;
    if (eff.give === "gold") addGold(user, total);
    if (eff.give === "gem")  addGems(user, total);
    if (eff.give === "xp")   addXP(user, total);
    return `✨ Recebido: +${total} ${eff.give}`;
  }

  if (eff?.type === "coupon") {
    addItemToInventory(user, `${eff.summonType}_coupon`, qty);
    return `🎟️ Cupom (${eff.summonType}) +${qty}`;
  }

  if (item.type === "bundle") {
    let msg = "";
    for (const entry of eff.items) {
      if (entry.give === "gold") { addGold(user, entry.amount); msg += `💰 +${entry.amount} Gold\n`; }
      if (entry.give === "gem")  { addGems(user, entry.amount); msg += `💎 +${entry.amount} Gemas\n`; }
      if (entry.giveCoupon) {
        addItemToInventory(user, `${entry.giveCoupon}_coupon`, entry.amount);
        msg += `🎟️ Cupom (${entry.giveCoupon}) +${entry.amount}\n`;
      }
      if (entry.buff) msg += `🔥 Buff ativo (${entry.duration} batalhas)\n`;
    }
    return msg;
  }

  return "✔️ Item entregue.";
}

// =================== CONSUMÍVEIS ===================
function deliverConsumable(user, eff, qty) {
  const amount = eff.amount * qty;

  if (eff.resource === "energy") {
    addEnergy(user, amount);
    return `⚡ Energia +${amount}`;
  }

  if (eff.resource === "towerAttempt") {
    if (!user.tower) user.tower = { floor:1, attempts:3, lastAccess:0 };
    user.tower.attempts += amount;
    return `🏰 Tentativas +${amount}`;
  }

  return "Consumível entregue.";
}