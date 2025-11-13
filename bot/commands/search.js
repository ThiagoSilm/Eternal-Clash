// src/commands/search.js

import { searchInventory } from "../../src/systems/inventorySystem.js";

export default {
  name: "search",
  description: "Busca cartas no seu inventário pelo nome e retorna o índice.",
  usage: "<nome parcial da carta>",
  
  async execute(message, args, user) {
    
    if (!user.cards || user.cards.length === 0)
      return message.reply("📦 Seu inventário está vazio.");
    
    // Normaliza para busca sem acentos
    const searchTerm = args.join(" ")
      .trim()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    if (!searchTerm) {
      return message.reply("❌ Forneça o nome ou parte do nome da carta.");
    }
    
    try {
      // Deve retornar array de: { index: 1-based, name, level, type }
      const foundCards = searchInventory(user, searchTerm);
      
      if (!foundCards || foundCards.length === 0) {
        return message.reply(`🔍 Nenhuma carta encontrada com "${searchTerm}".`);
      }
      
      const topResults = foundCards.slice(0, 10);
      
      let response = `🔍 **${topResults.length} Carta(s) Encontrada(s)** (por "${searchTerm}"): \n`;
      
      topResults.forEach(card => {
        // Garante que nada quebre
        const type = card.type ?? "Sem tipo";
        const level = card.level ?? "?";
        const index = card.index ?? "?";
        
        response += `[${index}] **${card.name}** (Lv. ${level}) - ${type}\n`;
      });
      
      response += "\n💡 Use o índice: `!card 15` para ver a carta ou `!sell 15` para vender.";
      
      await message.reply({
        content: response,
        allowedMentions: { repliedUser: false }
      });
      
    } catch (err) {
      console.error("❌ Erro no comando search:", err);
      await message.reply("⚠️ Ocorreu um erro na busca.");
    }
  }
};