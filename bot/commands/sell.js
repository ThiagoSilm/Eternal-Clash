// src/commands/sell.js

// Importa a função de sistema para vender
import { sellCards } from "../../src/systems/inventorySystem.js";

export default {
  name: "sell",
  description: "Vende cartas do seu inventário por Ouro.",
  usage: "<Índice da Carta 1> [Índice da Carta 2]...",
  
  // Recebe o objeto 'user' do middleware
  async execute(message, args, user) {
    
    if (!user.cards || user.cards.length === 0)
      return message.reply("📦 Seu inventário está vazio.");
      
    // Converte os argumentos em índices (1-based) e remove valores não numéricos
    const sellIndexes = args.map(n => parseInt(n)).filter(Boolean);
    
    if (sellIndexes.length === 0) {
      return message.reply("❌ Forneça o índice (número) de pelo menos uma carta para vender (ex: `!sell 5 8 12`).");
    }
    
    // Converte para índices 0-based, garantindo que não há duplicatas de índices.
    const uniqueIndicesToProcess = [...new Set(sellIndexes)].map(index => index - 1);
    
    // 1. Executa a venda, delegando toda a lógica (checar decks, calcular, remover, dar ouro) ao sistema
    try {
        // A função sellCards lança um erro se houver problemas (ex: carta em deck)
        const sellResult = sellCards(user, uniqueIndicesToProcess);

        // Formata a lista de cartas vendidas
        const cardNames = sellResult.cardsSold.map(c => 
            // Assume que getCardTemplate está disponível globalmente ou foi importado no comando
            `[${c.id}] (Lv. ${c.level})` 
        ).join(', ');

        const response = 
            `💰 **Venda Concluída!**\n` +
            `Você vendeu ${sellResult.count} carta(s) e recebeu **${sellResult.goldGained} Ouro**.\n` +
            `Cartas vendidas: ${cardNames}`;

        // O middleware salva as alterações em 'user'
        return message.reply(response);
        
    } catch (err) {
        console.error("❌ Erro no comando sell:", err);
        // Retorna a mensagem de erro amigável lançada pelo sistema
        return message.reply(`⚠️ Erro ao vender cartas: ${err.message || "Erro desconhecido."}`);
    }
  }
};
