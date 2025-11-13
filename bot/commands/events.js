// src/commands/events.js

import { claimDaily, getDailyStatus, dailyDraw } from "../../src/systems/dailySystem.js";

export default {
  name: "events",
  description: "Gerencie eventos diários e sorteios.",
  usage: "[login | status | sorteio]",
  
  // ⚠️ ATENÇÃO: Adicionamos o objeto 'user' para receber o dado do middleware
  async execute(message, args, user) {
    const sub = args[0]?.toLowerCase(); // Tratamento mais seguro para subcomando
    
    // O usuário já está garantido e carregado (ou criado) pelo index.js.
    let response;
    
    try {
      switch (sub) {
        case "login":
          // claimDaily deve modificar o objeto 'user' (adicionando recompensas, atualizando status)
          response = claimDaily(user);
          break;
          
        case "status":
          // getDailyStatus deve ler o objeto 'user'
          response = getDailyStatus(user);
          break;
          
        case "sorteio":
          // dailyDraw deve modificar o objeto 'user' (dando a recompensa, atualizando cooldown)
          response = dailyDraw(user);
          break;
          
        default:
          response =
            "🎁 **Comandos de Evento**\n" +
            "---" +
            "`!events login` — Coletar recompensa diária de login.\n" +
            "`!events status` — Ver sequência e status do login.\n" +
            "`!events sorteio` — Girar a sorte do dia (cooldown/recompensa única).\n" +
            "---";
      }
      
      // O index.js cuidará de chamar markUserDirty(user) e salvá-lo automaticamente
      // se o objeto 'user' foi modificado por claimDaily ou dailyDraw.
      
      await message.reply({ content: response, allowedMentions: { repliedUser: false } });
      
    } catch (err) {
      console.error("❌ Erro no comando de eventos:", err);
      await message.reply("⚠️ Ocorreu um erro ao processar o evento.");
    }
  },
};
