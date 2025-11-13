// src/commands/items.js

import { listUserItems, consumeItem } from "../src/systems/itemSystem.js";
import { getShopCatalog } from "../src/systems/shopSystem.js"; // Para obter metadados

export default {
  name: "items",
  description: "Gerencie e use itens do seu inventário (poções, boosters, etc.).",
  usage: "[list | use <item ID/nome> [quantidade]]",
  
  async execute(message, args, user) {
    const sub = args[0]?.toLowerCase() || 'list';
    
    // Garante que o inventário de itens exista
    if (!user.items) user.items = {}; 

    try {
      if (sub === 'list') {
        // 1. LISTAR ITENS
        const response = listUserItems(user);
        return message.reply(response);
        
      } else if (sub === 'use') {
        // 2. USAR/CONSUMIR ITEM
        const itemIdentifier = args[1]?.toLowerCase();
        let quantity = parseInt(args[2]) || 1;

        if (!itemIdentifier) {
          return message.reply("❌ Use: `!items use <nome/ID do item> [qntd]`");
        }
        if (quantity < 1) quantity = 1;

        // consumeItem deve encontrar o item, aplicar o efeito, e remover a quantidade do inventário do usuário.
        const useResult = consumeItem(user, itemIdentifier, quantity); 
        
        // O objeto 'user' foi modificado por consumeItem.
        return message.reply(`🧪 ${useResult}`);

      } else {
        return message.reply(
          "🎒 **Comandos do Inventário de Itens:**\n" +
          "`!items` ou `!items list` — Lista todos os seus itens não-carta.\n" +
          "`!items use <nome/ID> [qntd]` — Usa um item consumível (Poção, Booster)."
        );
      }
      
    } catch (err) {
      console.error("❌ Erro no comando items:", err);
      // O sistema deve lançar mensagens amigáveis em caso de erro.
      await message.reply(`⚠️ Ocorreu um erro ao usar o item. ${err.message || ''}`);
    }
  }
};
