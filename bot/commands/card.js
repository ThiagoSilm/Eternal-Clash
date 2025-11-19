// src/commands/card.js
import { viewCardDetails } from "../../src/systems/inventorySystem.js";
import { EmbedBuilder } from "discord.js";

export default {
  name: "card",
  description: "Mostra detalhes completos de uma carta do seu inventário.",
  usage: "<índice da carta> ou 'lista'",
  
  async execute(message, args, user) {
    try {
      if (!user.cards || user.cards.length === 0) {
        return message.reply("📦 Seu inventário está vazio.");
      }
      
      // Mostrar lista de cartas
      if (!args[0] || args[0].toLowerCase() === "lista") {
        const list = user.cards
          .map((c, i) => `${i + 1}. ${c.name || "Carta sem nome"}`)
          .join("\n");
        const embedList = new EmbedBuilder()
          .setTitle("📜 Inventário de Cartas")
          .setDescription(list)
          .setColor("Blue");
        return message.reply({ embeds: [embedList] });
      }
      
      // Validar índice
      const index = Number(args[0]);
      if (!Number.isInteger(index) || index < 1 || index > user.cards.length) {
        return message.reply(`❌ Índice inválido.\nUse um número entre 1 e ${user.cards.length}.`);
      }
      
      const card = user.cards[index - 1];
      if (!card) return message.reply("❌ Carta não encontrada.");
      
      const formatted = viewCardDetails(user, index - 1);
      if (!formatted || typeof formatted !== "string") {
        throw new Error("Falha ao gerar a visualização da carta.");
      }
      
      // Criar embed da carta
      const embedCard = new EmbedBuilder()
        .setTitle(`🃏 ${card.name || "Carta sem nome"}`)
        .setDescription(formatted)
        .setColor("Green");
      
      return message.reply({ embeds: [embedCard] });
      
    } catch (err) {
      console.error("❌ Erro no comando card:", err);
      return message.reply(`⚠️ Falha ao exibir a carta:\n\`${err.message || "Erro desconhecido."}\``);
    }
  }
};