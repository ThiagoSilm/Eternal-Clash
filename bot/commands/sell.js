// sell.js
// Comando para vender cartas do inventário por Ouro.
// -----------------------------------------------------------------
import { EmbedBuilder } from "discord.js";
import { sellCards } from "../../src/systems/inventorySystem.js"; 

export default {
  name: "sell",
  description: "Vende cartas do seu inventário por Ouro. Use os índices da lista do !inv.",
  usage: "<índice1> [índice2] [índice3...]",
  aliases: ["vender"],
  
  async execute(message, args, user) { 
    const indicesRaw = args;
    
    if (indicesRaw.length === 0) {
      return message.reply("❌ Por favor, forneça o(s) **índice(s)** das cartas que deseja vender, conforme aparecem na lista do `!inv`.");
    }

    // Filtra e converte todos os argumentos para números válidos (índices > 0)
    const indicesToSell = indicesRaw
      .map(s => parseInt(s.trim()))
      .filter(n => !isNaN(n) && n > 0);

    if (indicesToSell.length === 0) {
      return message.reply("❌ Nenhum índice válido foi fornecido. Use números inteiros positivos (ex: `!sell 1 5 12`).");
    }

    // Remove duplicatas de índices para evitar processamento redundante ou erros
    const uniqueIndices = [...new Set(indicesToSell)];

    try {
      const result = sellCards(user, uniqueIndices);

      const embed = new EmbedBuilder()
        .setTitle(`💰 Venda de Cartas Concluída`)
        .setDescription(`Você vendeu **${result.count}** cartas com sucesso!`)
        .addFields([
          { name: "Cartas Vendidas", value: `${result.count} cartas`, inline: true },
          { name: "Ouro Ganho", value: `+${result.goldGained} Ouro`, inline: true }
        ])
        .setColor("#16A085") // Cor Verde-Escuro (Dinheiro)
        .setFooter({ text: `Lembre-se: cartas bloqueadas (🔒) ou em decks não podem ser vendidas.` })
        .setTimestamp();
        
      return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });

    } catch (err) {
      // O sistema de inventário lança exceções se a carta estiver bloqueada/em deck/inválida
      return message.reply(`❌ **Falha na Venda:** ${err.message}`);
    }
  }
};
