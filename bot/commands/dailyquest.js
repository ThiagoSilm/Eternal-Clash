// src/commands/dailyquest.js

import {
  getQuestStatus,
  claimDailyQuestReward
} from "../../src/systems/dailyQuestSystem.js";

export default {
  name: "dailyquest",
  description: "Verifique e resgate suas missões diárias para ganhar bônus.",
  usage: "[status | claim]",
  
  async execute(message, args, user) {
    
    // Garantia absoluta contra erros do middleware
    if (!user) {
      return message.reply("❌ Erro interno: usuário não carregado.");
    }
    
    const sub = args[0]?.toLowerCase() || "status";
    let response = "";
    
    try {
      switch (sub) {
        
        case "status":
          // Apenas leitura — não modifica o user
          response = getQuestStatus(user);
          break;
          
        case "claim":
          // Esta função modifica user (recompensa + marcar claim)
          response = claimDailyQuestReward(user);
          break;
          
        default:
          response =
            "📋 **Comandos de Missões Diárias:**\n" +
            "• `!dailyquest` ou `!dailyquest status` — Ver o progresso das missões.\n" +
            "• `!dailyquest claim` — Reivindicar a recompensa final do dia.";
      }
      
      await message.reply({
        content: response,
        allowedMentions: { repliedUser: false }
      });
      
    } catch (err) {
      console.error("❌ Erro no comando dailyquest:", err);
      
      // Sistema aceita erros em forma de string → retornar direto
      if (typeof err === "string") {
        return message.reply(`⚠️ ${err}`);
      }
      
      return message.reply("⚠️ Ocorreu um erro ao processar suas missões diárias.");
    }
  },
};