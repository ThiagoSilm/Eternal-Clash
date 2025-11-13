// src/commands/events.js

import { claimDaily, getDailyStatus, dailyDraw } from "../../src/systems/dailySystem.js";

export default {
  name: "events",
  description: "Gerencie eventos diários e sorteios.",
  usage: "[login | status | sorteio]",
  
  async execute(message, args, user) {
    if (!user) {
      return message.reply("❌ Erro interno: usuário não carregado.");
    }
    
    const sub = (args[0] || "").toLowerCase();
    let response = "";
    
    try {
      switch (sub) {
        case "login":
          response = claimDaily(user);
          break;
          
        case "status":
          response = getDailyStatus(user);
          break;
          
        case "sorteio":
          response = dailyDraw(user);
          break;
          
        default:
          response =
            "🎁 **Comandos de Evento:**\n" +
            "```\n" +
            "!events login   → Coleta sua recompensa diária\n" +
            "!events status  → Mostra o progresso e bônus diário\n" +
            "!events sorteio → Roda a sorte diária\n" +
            "```";
          break;
      }
      
      await message.reply({
        content: response,
        allowedMentions: { repliedUser: false }
      });
      
    } catch (err) {
      console.error("❌ Erro no comando events:", err);
      return message.reply("⚠️ Erro interno ao processar o evento.");
    }
  },
};