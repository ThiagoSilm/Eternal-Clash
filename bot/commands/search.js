// src/commands/search.js

// Importa a função de sistema para busca
import { searchInventory } from "../../src/systems/inventorySystem.js";

export default {
  name: "search",
  description: "Busca cartas no seu inventário pelo nome e retorna o índice.",
  usage: "<nome parcial da carta>",
  
  // Recebe o objeto 'user' do middleware
  async execute(message, args, user) {
    
    if (!user.cards || user.cards.length === 0)
      return message.reply("📦 Seu inventário está vazio.");

    const searchTerm = args.join(" ").trim();
    
    if (!searchTerm) {
        return message.reply("❌ Forneça o nome ou parte do nome da carta que você está buscando.");
    }
    
    try {
      // 1. Delega a busca ao sistema (searchInventory retorna o índice 1-based)
      const foundCards = searchInventory(user, searchTerm); 
      
      if (foundCards.length === 0) {
        return message.reply(`🔍 Nenhuma carta encontrada com o termo "${searchTerm}".`);
      }
      
      // Limita a 10 resultados para evitar spam
      const topResults = foundCards.slice(0, 10);

      let response = `🔍 **${topResults.length} Cartas Encontradas** (por "${searchTerm}"): \n`;
      
      topResults.forEach((card) => {
        // 'card' contém o índice 1-based, nome e level
        response += `[${card.index}] **${card.name}** (Lv. ${card.level}) - ${card.type}\n`;
      });
      
      response += "\n💡 Use o índice (ex: `!card 15`) para ver os detalhes ou `!sell 15` para vender.";
      
      await message.reply({ content: response, allowedMentions: { repliedUser: false } });
      
    } catch (err) {
      console.error("❌ Erro no comando search:", err);
      await message.reply("⚠️ Ocorreu um erro ao tentar pesquisar as cartas.");
    }
  }
};
