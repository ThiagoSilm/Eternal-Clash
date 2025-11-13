// src/commands/dailyquest.js

import { getQuestStatus, claimDailyQuestReward } from "../../src/systems/dailyQuestSystem.js";

export default {
  name: "dailyquest",
  description: "Verifique e resgate suas missões diárias para ganhar bônus.",
  usage: "[status | claim]",
  
  async execute(message, args, user) {
    const sub = args[0]?.toLowerCase() || 'status';
    let response = "";
    
    try {
      switch (sub) {
        case "status":
          // getQuestStatus deve retornar uma string formatada com todas as missões e progresso
          response = getQuestStatus(user);
          break;
          
        case "claim":
          // claimDailyQuestReward deve verificar se todas as missões estão concluídas
          // e, se estiverem, conceder a recompensa bônus e marcar como reivindicada.
          // Esta função modifica o objeto 'user'.
          response = claimDailyQuestReward(user);
          break;
          
        default:
          response =
            "📋 **Comandos de Missões Diárias:**\n" +
            "`!dailyquest` ou `!dailyquest status` — Ver o progresso das missões.\n" +
            "`!dailyquest claim` — Reivindicar a recompensa final do dia.";
      }
      
      // O index.js fará o salvamento automático se o objeto 'user' foi modificado (no caso 'claim').
      await message.reply({ content: response, allowedMentions: { repliedUser: false } });
      
    } catch (err) {
      console.error("❌ Erro no comando dailyquest:", err);
      // Assume-se que o sistema pode retornar uma string de erro amigável
      if (typeof err === 'string') {
          await message.reply(`⚠️ ${err}`);
      } else {
          await message.reply("⚠️ Ocorreu um erro ao processar as missões diárias.");
      }
    }
  }
};
