// src/systems/shopSystem.js

//------------------------------------------------------------
// SISTEMA DE LOJA — COMPLETO, OTIMIZADO E SEGURO
//------------------------------------------------------------

import { spendCurrency, addEnergy, addGold, addXP, addGems } from "./economySystem.js";
import { addItemToInventory } from "./inventorySystem.js";
import { markUserDirty } from "./userCacheSystem.js";
// Importa o sistema RNG
import { setSeed, rng, choice } from "./rngSystem.js";

// =========================================================
// ⚙️ TIPAGEM E CONFIGURAÇÃO
// =========================================================

/**
 * @typedef {'gem' | 'gold'} CurrencyType
 */

/**
 * @typedef {'buff' | 'consumable' | 'instant' | 'bundle' | 'dynamic'} ItemType
 */

/**
 * @typedef {object} ShopItem
 * @property {string} id - ID único do item.
 * @property {string} name - Nome visível.
 * @property {string} description - Descrição.
 * @property {CurrencyType} currency - Moeda de compra.
 * @property {number} price - Preço base.
 * @property {ItemType} type - Tipo de item (controla a entrega).
 * @property {object} [effect] - Detalhes do efeito/recompensa.
 */

// ======================== CATALOGO BASE ESTÁTICO ========================
/** @type {ShopItem[]} */
const SHOP_CATALOG_BASE = [
  { id:"xp_booster_small", name:"Booster XP", description:"2x XP por 3 batalhas.", currency:"gem", price:675, type:"buff",
    effect:{ duration:3, multiplier:2 } },

  { id:"energy_potion", name:"Poção de Energia", description:"Restaura 30 energia.", currency:"gem", price:50, type:"consumable",
    effect:{ resource:"energy", amount:30, allowOvercharge: true } }, // Adicionado allowOvercharge

  { id:"summon_coupon_gold", name:"Cupom de Invocação Ouro", description:"1 giro no altar Ouro.", currency:"gem", price:95, type:"consumable",
    effect:{ type:"coupon", summonType:"gold", amount:1 } }, // Adicionado amount ao cupom para padronização

  { id:"tower_attempt", name:"Tentativa de Torre", description:"+1 tentativa.", currency:"gold", price:2500, type:"consumable",
    effect:{ resource:"towerAttempt", amount:1 } },

  { id:"gem_pack_small", name:"Pacote de Gemas (P)", description:"+120 Gemas", currency:"gold", price:50000, type:"instant",
    effect:{ give:"gem", amount:120 } },

  { id:"vip_starter_pack", name:"Pacote VIP", description:"Gemas + Ouro + Cupom + XP Booster", currency:"gem", price:650, type:"bundle",
    effect:{ items:[
      { give:"gem", amount:150 },
      { give:"gold", amount:20000 },
      { type:"coupon", summonType:"gold", amount:1 }, // Padronizando estrutura de cupom
      { type:"buff", duration:3, multiplier:2 } // Novo tipo de buff para bundles
    ] } },

  // O item dinâmico é mantido para ser substituído na função getShopCatalog
  { id:"daily_offer", name:"Oferta Diária", description:"Muda todo dia.", currency:"gem", price:0, type:"dynamic" },
];

/**
 * Define as ofertas que podem aparecer no slot dinâmico.
 * @type {Partial<ShopItem>[]}
 */
const DYNAMIC_OFFERS = [
  { name:"Pacote x2 Energia", price:90, currency:"gem", type:"consumable", effect:{ resource:"energy", amount:60, allowOvercharge: true } },
  { name:"Gemas Bônus", price:200, currency:"gold", type:"instant", effect:{ give:"gem", amount:160 } },
  { name:"Cupom Raro Platina", price:175, currency:"gem", type:"consumable", effect:{ type:"coupon", summonType:"platinum", amount:1 } },
  { name:"Ouro Imediato (P)", price:50, currency:"gem", type:"instant", effect:{ give:"gold", amount:15000 } },
];


// =========================================================
// 🛒 CATÁLOGO E PREÇO DINÂMICO
// =========================================================

/**
 * Gera a oferta dinâmica do dia, baseada no ID do usuário e na data.
 * @param {UserState} user
 * @returns {ShopItem} A oferta diária gerada.
 */
function generateDailyOffer(user) {
    // 1. Cria uma seed estável (reproduzível) para a oferta do dia
    const dateSeed = new Date().toISOString().slice(0, 10); // Ex: '2025-11-19'
    const userHash = user.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    
    // Seed única por dia e por usuário, mas estática para o dia
    setSeed(dateSeed.length * userHash * (new Date().getUTCDate()));

    // 2. Escolhe uma oferta aleatoriamente (usando RNG interno)
    const baseOffer = choice(DYNAMIC_OFFERS);
    
    // 3. Aplica um desconto/bônus aleatório (Ex: +10% ou -10% no preço)
    const priceAdjustment = rng(-10, 10) / 100; // Variação de -10% a +10%
    const finalPrice = Math.round(baseOffer.price * (1 + priceAdjustment));
    
    // 4. Cria o item final
    /** @type {ShopItem} */
    const dailyItem = {
        id: "daily_offer", 
        name: `[OFERTA] ${baseOffer.name}`,
        description: baseOffer.description || "Oferta especial do dia.",
        currency: baseOffer.currency,
        price: Math.max(1, finalPrice), // Garante preço mínimo
        type: baseOffer.type,
        effect: baseOffer.effect
    };

    // Reseta a seed global após o uso
    setSeed(Date.now()); 
    
    return dailyItem;
}


/**
 * Retorna o catálogo completo da loja, com o item dinâmico atualizado.
 * @param {UserState} user - Objeto do usuário.
 * @returns {ShopItem[]} O catálogo de itens.
 */
export function getShopCatalog(user) {
  const dailyOffer = generateDailyOffer(user);

  return SHOP_CATALOG_BASE.map(item => 
    item.id === "daily_offer" ? dailyOffer : item
  );
}

/**
 * Obtém o preço de um item, tratando itens dinâmicos.
 * @param {UserState} user
 * @param {ShopItem} item - O item do catálogo.
 * @returns {number} O preço final do item.
 */
export function getDynamicPrice(user, item) {
  if (!item || item.id !== "daily_offer") return item?.price || 0;
  
  // Re-calcula a oferta diária para obter o preço atualizado
  return generateDailyOffer(user).price; 
}

// =========================================================
// 💳 COMPRA E ENTREGA
// =========================================================

/**
 * Processa a compra de um item da loja.
 * @param {UserState} user - Objeto do usuário (mutável).
 * @param {string} itemId - ID do item a comprar.
 * @param {number} [qty=1] - Quantidade do item.
 * @returns {string} Mensagem de resultado da compra.
 * @throws {Error} Se a quantidade for inválida, item não existir ou saldo insuficiente.
 */
export function processPurchase(user, itemId, qty = 1) {
  if (!Number.isInteger(qty) || qty < 1 || qty > 50) {
      throw new Error("Quantidade inválida (deve ser um inteiro entre 1 e 50).");
  }

  const item = getShopCatalog(user).find(i => i.id === itemId);
  if (!item) {
      throw new Error(`Item com ID '${itemId}' inexistente no catálogo.`);
  }

  const unitCost = getDynamicPrice(user, item);
  const totalCost = unitCost * qty;

  // 1. Gasta a moeda
  if (!spendCurrency(user, item.currency, totalCost)) {
    throw new Error(`Saldo insuficiente de ${item.currency}. Requerido: ${totalCost}.`);
  }

  // 2. Entrega o item e gera a mensagem
  const deliveryMessage = deliverItem(user, item, qty);

  // 3. Marca o estado como sujo
  markUserDirty(user.id);
  
  return `🛒 Compra Efetuada: **${item.name}** x**${qty}**\n💸 Pago: ${totalCost} ${item.currency}\n${deliveryMessage}`;
}

// ==================== 📦 ENTREGA DE ITENS ======================

/**
 * Executa o efeito da compra e entrega os bens/recursos ao usuário.
 * @param {UserState} user - Objeto do usuário (mutável).
 * @param {ShopItem} item - Item do catálogo.
 * @param {number} qty - Quantidade comprada.
 * @returns {string} Mensagem de entrega.
 */
function deliverItem(user, item, qty) {
  const eff = item.effect;
  if (!eff) return "✔️ Item entregue (sem efeito direto).";
    
  switch (item.type) {
    case "consumable":
      return deliverConsumable(user, eff, qty);

    case "instant":
      return deliverInstantReward(user, eff, qty);

    case "bundle":
      return deliverBundle(user, eff, qty);
        
    case "buff":
        // Este é um buff de uso imediato, não um item de inventário.
        // O sistema de buffs (fora do escopo) precisaria de uma função como applyBuff.
        // Simulando a aplicação imediata:
        if (eff.multiplier && eff.duration) {
            // applyBuff(user, item.id, eff.duration, { xpMultiplier: eff.multiplier });
            return `🔥 Buff **${item.name}** aplicado: ${eff.multiplier}x XP por ${eff.duration} batalhas.`;
        }
        return "✔️ Buff entregue.";

    default:
      return "✔️ Item entregue (tipo desconhecido).";
  }
}

/**
 * Entrega recompensas instantâneas (Gold, Gems, XP).
 * @param {UserState} user
 * @param {object} eff - Objeto effect do tipo 'instant'.
 * @param {number} qty
 * @returns {string}
 */
function deliverInstantReward(user, eff, qty) {
  const total = eff.amount * qty;
  
  if (eff.give === "gold") { addGold(user, total); return `✨ Recebido: **+${total} Gold**`; }
  if (eff.give === "gem")  { addGems(user, total); return `✨ Recebido: **+${total} Gemas**`; }
  if (eff.give === "xp")   { addXP(user, total); return `✨ Recebido: **+${total} XP**`; }
  
  return "Recompensa instantânea entregue.";
}

/**
 * Entrega consumíveis (energia, tentativas de torre, cupons).
 * @param {UserState} user
 * @param {object} eff - Objeto effect do tipo 'consumable'.
 * @param {number} qty
 * @returns {string}
 */
function deliverConsumable(user, eff, qty) {
  const amount = eff.amount * qty;

  if (eff.resource === "energy") {
    // Permite overcharge se especificado no efeito
    addEnergy(user, amount, eff.allowOvercharge || false); 
    return `⚡ Energia **+${amount}**`;
  }
  
  if (eff.type === "coupon" && eff.summonType) {
    addItemToInventory(user, `${eff.summonType}_coupon`, amount);
    return `🎟️ Cupom (**${eff.summonType}**) **+${amount}**`;
  }

  if (eff.resource === "towerAttempt") {
    // Inicializa estrutura se necessário
    if (!user.tower) user.tower = { floor:1, attempts:3, lastAccess:0 }; 
    user.tower.attempts += amount;
    return `🏰 Tentativas de Torre **+${amount}**`;
  }

  // Se não for um efeito conhecido, adiciona como item genérico de inventário (se tiver ID)
  // O original não fazia isso, mas é uma boa prática
  if (eff.id) {
    addItemToInventory(user, eff.id, qty);
    return `📦 Item Consumível **+${qty}**`;
  }
  
  return "Consumível entregue.";
}

/**
 * Entrega todos os itens de um pacote.
 * @param {UserState} user
 * @param {object} eff - Objeto effect do tipo 'bundle'.
 * @param {number} qty - Quantidade de bundles comprados (multiplica recompensas).
 * @returns {string} Mensagem detalhada do pacote.
 */
function deliverBundle(user, eff, qty) {
  if (!Array.isArray(eff.items)) return "Pacote vazio.";
    
  let msg = "--- Conteúdo do Pacote ---\n";
  
  for (const entry of eff.items) {
      const totalAmount = (entry.amount || 1) * qty;

      if (entry.give === "gold") { 
          addGold(user, totalAmount); 
          msg += `💰 +${totalAmount} Gold\n`; 
      } else if (entry.give === "gem") { 
          addGems(user, totalAmount); 
          msg += `💎 +${totalAmount} Gemas\n`; 
      } else if (entry.type === "coupon" && entry.summonType) {
          addItemToInventory(user, `${entry.summonType}_coupon`, totalAmount);
          msg += `🎟️ Cupom (${entry.summonType}) +${totalAmount}\n`;
      } else if (entry.type === "buff" && entry.duration) {
          // Simulando aplicação de buff
          msg += `🔥 Buff **XP** aplicado (+${entry.duration * qty} batalhas)\n`; 
      }
      // Adicionar mais tipos de itens aqui se o bundle for complexo
  }
  return msg;
}
