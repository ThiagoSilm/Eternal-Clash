// src/commands/card.js

import { viewCardDetails } from "../../src/systems/inventorySystem.js";

export default {
  name: "card",
  description: "Mostra detalhes completos de uma carta do seu inventário.",
  usage: "<índice da carta>",
  
  async execute(message, args, user) {
    try {
      // ----------------------------------------------------
      // 1. Inventário vazio
      // ----------------------------------------------------
      if (!user.cards || user.cards.length === 0) {
        return message.reply("📦 Seu inventário está vazio.");
      }
      
      // ----------------------------------------------------
      // 2. Validação do índice
      // ----------------------------------------------------
      if (!args[0]) {
        return message.reply(`❌ Você deve informar o índice da carta.\nUse: **!card <1-${user.cards.length}>**`);
      }
      
      const index = Number(args[0]);
      
      if (!Number.isInteger(index) || index < 1 || index > user.cards.length) {
        return message.reply(`❌ Índice inválido.\nUse um número entre **1** e **${user.cards.length}**.`);
      }
      
      // ----------------------------------------------------
      // 3. Chamada real ao sistema que formata a carta
      // ----------------------------------------------------
      const formatted = viewCardDetails(user, index);
      
      if (!formatted || typeof formatted !== "string") {
        throw new Error("O sistema retornou um formato inválido para a carta.");
      }
      
      // ----------------------------------------------------
      // 4. Enviar a carta formatada
      // ----------------------------------------------------
      return message.reply({
        content: formatted,
        allowedMentions: { repliedUser: false }
      });
      
    } catch (err) {
      console.error("❌ Erro no comando card:", err);
      
      return message.reply(
        `⚠️ Falha ao exibir a carta:\n\`${err.message || "Erro desconhecido."}\``
      );
    }
  }
};