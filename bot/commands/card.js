// src/commands/card.js

// 🎯 Importa a função do InventorySystem, que deve conter a lógica de formatação.
import { viewCardDetails } from "../src/systems/inventorySystem.js";

export default {
  name: "card",
  description: "Mostra detalhes completos de uma carta do seu inventário.",
  usage: "<índice da carta>",
  
  // Recebe o objeto 'user' do middleware
  async execute(message, args, user) {
    
    if (!user.cards || user.cards.length === 0) {
      return message.reply("📦 Seu inventário está vazio.");
    }
    
    const index = parseInt(args[0]);
    
    // Validação básica do índice
    if (isNaN(index) || index < 1 || index > user.cards.length) {
      return message.reply(`❌ Índice inválido. Use um número de 1 a ${user.cards.length}.`);
    }
    
    try {
        // 1. Delega a lógica de busca e formatação ao sistema
        // A função viewCardDetails retorna a string formatada pronta para ser exibida.
        const response = viewCardDetails(user, index);
        
        await message.reply({ content: response, allowedMentions: { repliedUser: false } });
        
    } catch (err) {
        console.error("❌ Erro no comando card:", err);
        // Se o sistema lançar um erro (ex: "Carta não existe"), ele será capturado aqui.
        await message.reply(`⚠️ Ocorreu um erro ao buscar a carta: ${err.message || 'Erro desconhecido.'}`);
    }
  }
};
