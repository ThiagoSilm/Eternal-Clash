// src/commands/items.js

import { listUserItems, consumeItem } from "../../src/systems/itemSystem.js";
import { getShopCatalog } from "../../src/systems/shopSystem.js"; // opcional

export default {
  name: "items",
  description: "Gerencie e use itens do seu inventário (poções, boosters, etc.).",
  usage: "[list | use <item ID/nome> [quantidade]]",
  
  async execute(message, args, user) {
    const sub = args[0]?.toLowerCase() || 'list';
    
    // Garante estrutura
    if (!user.items) user.items = {};
    
    try {
      
      if (sub === 'list') {
        const response = listUserItems(user);
        return message.reply(response);
      }
      
      if (sub === 'use') {
        const itemIdentifier = args[1] ?
          String(args[1]).toLowerCase() :
          null;
        
        let quantity = parseInt(args[2]) || 1;
        if (!itemIdentifier) {
          return message.reply("❌ Use: `!items use <nome/ID do item> [qntd]`");
        }
        if (quantity < 1) quantity = 1;
        
        const useResult = consumeItem(user, itemIdentifier, quantity);
        return message.reply(`🧪 ${useResult}`);
      }
      
      return message.reply(
        "🎒 **Inventário de Itens:**\n" +
        "`!items` — Lista seus itens.\n" +
        "`!items use <nome/ID> [qntd]` — Usa um item consumível."
      );
      
    } catch (err) {
      console.error("❌ Erro no comando items:", err);
      return message.reply(`⚠️ Ocorreu um erro ao usar o item. ${err.message || ''}`);
    }
  }
};