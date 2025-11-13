// src/commands/sell.js

import { sellCards } from "../../src/systems/inventorySystem.js";
import { getCardTemplate } from "../../src/systems/cardSystem.js";

export default {
  name: "sell",
  description: "Vende cartas do seu inventário por Ouro.",
  usage: "<Índice da Carta 1> [Índice da Carta 2]...",
  
  async execute(message, args, user) {
    
    if (!user.cards || user.cards.length === 0)
      return message.reply("📦 Seu inventário está vazio.");
    
    // Converte args -> números válidos
    const sellIndexes = args
      .map(n => parseInt(n))
      .filter(n => !isNaN(n));
    
    if (sellIndexes.length === 0)
      return message.reply("❌ Use: `!sell 5 8 12`");
    
    // Remove duplicatas e converte para índice 0-based
    const uniqueIndicesToProcess = [...new Set(sellIndexes)].map(i => i - 1);
    
    try {
      const sellResult = sellCards(user, uniqueIndicesToProcess);
      
      const cardNames = sellResult.cardsSold
        .map(c => {
          const t = getCardTemplate(c.id);
          return `[${c.id}] ${t.name} (Lv. ${c.level})`;
        })
        .join(", ");
      
      const response =
        `💰 **Venda Concluída!**\n` +
        `Você vendeu ${sellResult.count} carta(s) e recebeu **${sellResult.goldGained} Ouro**.\n` +
        `Cartas vendidas: ${cardNames}`;
      
      return message.reply(response);
      
    } catch (err) {
      console.error("❌ Erro no comando sell:", err);
      return message.reply(`⚠️ ${err.message ?? err}`);
    }
  }
};