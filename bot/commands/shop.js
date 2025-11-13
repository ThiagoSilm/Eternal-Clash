// src/commands/shop.js

import { spendCurrency } from "../../src/systems/economySystem.js";
import { getShopCatalog, processPurchase } from "../../src/systems/shopSystem.js";

export default {
  name: "shop",
  description: "Acessa a loja para comprar itens com Ouro ou Gemas.",
  usage: "[list | buy <id> [quantidade]]",
  
  async execute(message, args, user) {
    const sub = (args[0] || "").toLowerCase();
    
    try {
      // --------------------------------------------------
      // LISTAR ITENS
      // --------------------------------------------------
      if (sub === "" || sub === "list" || sub === "loja") {
        const catalog = getShopCatalog() || [];
        
        let reply = "🛒 **Loja Principal:**\n━━━━━━━━━━━━━━\n";
        
        if (catalog.length === 0) {
          reply += "A loja está vazia.";
        } else {
          for (const item of catalog) {
            reply +=
              `**[${item.id}] ${item.name}**\n` +
              `💵 Preço: **${item.cost} ${item.currency.toUpperCase()}**\n` +
              `📘 ${item.description}\n\n`;
          }
        }
        
        return message.reply({
          content: reply,
          allowedMentions: { repliedUser: false }
        });
      }
      
      // --------------------------------------------------
      // COMPRAR ITEM
      // --------------------------------------------------
      if (sub === "buy" || sub === "comprar") {
        const itemId = args[1];
        const quantity = Math.max(1, parseInt(args[2]) || 1);
        
        if (!itemId) {
          return message.reply("❌ Use: `!shop buy <id> [quantidade]`");
        }
        
        // processPurchase retorna string → resposta final
        const purchaseResult = await processPurchase(user, itemId, quantity);
        
        return message.reply({
          content: purchaseResult,
          allowedMentions: { repliedUser: false }
        });
      }
      
      // --------------------------------------------------
      // AJUDA
      // --------------------------------------------------
      const help =
        "🛍️ **Comandos da Loja:**\n" +
        "`!shop` — Ver lista de itens.\n" +
        "`!shop list` — Ver tudo que está à venda.\n" +
        "`!shop buy <id> [qnt]` — Comprar um item.";
      
      return message.reply({
        content: help,
        allowedMentions: { repliedUser: false }
      });
      
    } catch (err) {
      console.error("❌ Erro no comando shop:", err);
      
      const msg =
        typeof err === "string" ?
        `⚠️ ${err}` :
        "⚠️ Ocorreu um erro ao processar a Loja.";
      
      return message.reply({
        content: msg,
        allowedMentions: { repliedUser: false }
      });
    }
  }
};