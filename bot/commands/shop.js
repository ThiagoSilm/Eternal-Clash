// src/commands/shop.js

import { spendCurrency } from "../../src/systems/economySystem.js";

import { getShopCatalog, processPurchase } from "../../src/systems/../../src/systems/shopSystem.js"


export default {
  name: "shop",
  description: "Acesse a loja para comprar itens e recursos usando Ouro ou Gemas.",
  usage: "[list | buy <id> [quantidade]]",
  
  async execute(message, args, user) {
    const sub = args[0]?.toLowerCase();
    const subCommand = sub === 'buy' ? 'buy' : 'list';
    
    let response = "";
    
    try {
      if (subCommand === 'list') {
        // 1. LISTAR ITENS
        const catalog = getShopCatalog();
        response = "🛒 **Loja Principal:**\n---\n";
        
        if (catalog.length === 0) {
            response += "A loja está vazia no momento.";
        } else {
            catalog.forEach(item => {
                response += 
                    `**[${item.id}] ${item.name}**\n` +
                    `   Preço: ${item.cost} ${item.currency.toUpperCase()}\n` +
                    `   Descrição: ${item.description}\n`;
            });
        }

      } else if (subCommand === 'buy') {
        // 2. COMPRAR ITEM
        const itemId = args[1];
        let quantity = parseInt(args[2]) || 1;
        
        if (!itemId) {
            return message.reply("❌ Use: `!shop buy <id> [quantidade]`");
        }
        if (quantity < 1) quantity = 1;

        // processPurchase deve lidar com:
        // 1. Validar o item e o preço total.
        // 2. Chamar spendCurrency(user, item.currency, totalCost).
        // 3. Adicionar o item ao inventário do usuário.
        // 4. Retornar uma mensagem de sucesso ou erro.
        response = processPurchase(user, itemId, quantity);
        
        // 🚨 O objeto 'user' foi modificado por spendCurrency e processPurchase.
        // O index.js fará o salvamento automaticamente (markUserDirty).
        
      } else {
        // Mensagem de ajuda, caso o subcomando não seja reconhecido.
        response = 
            "🛍️ **Comandos da Loja:**\n" +
            "`!shop` ou `!shop list` — Ver todos os itens à venda.\n" +
            "`!shop buy <id> [qntd]` — Comprar um item da loja.";
      }
      
      await message.reply({ content: response, allowedMentions: { repliedUser: false } });
      
    } catch (err) {
      console.error("❌ Erro no comando da loja:", err);
      // Se o erro for uma string (ex: "Recursos insuficientes"), exibe a mensagem amigável
      if (typeof err === 'string') {
          await message.reply(`⚠️ ${err}`);
      } else {
          await message.reply("⚠️ Ocorreu um erro ao processar a loja.");
      }
    }
  }
};
