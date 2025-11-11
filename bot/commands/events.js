import { claimDaily, getDailyStatus } from "../../src/systems/dailySystem.js";
import { dailyDraw } from "../../src/systems/drawSystem.js";
import { getOrCreateUser } from "../../src/systems/userSystem.js";

export default {
  name: "events",
  description: "Gerencie eventos diários e sorteios.",
  async execute(message, args) {
    const sub = args[0];
    const userId = message.author.id;
    
    // garante que o usuário exista antes de qualquer ação
    const user = getOrCreateUser(userId);
    let response;
    
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
            "`!events login` — Coletar recompensa diária\n" +
            "`!events status` — Ver sequência de login\n" +
            "`!events sorteio` — Girar a sorte do dia";
      }
      
      await message.reply(response);
    } catch (err) {
      console.error("Erro no comando de eventos:", err);
      await message.reply("⚠️ Ocorreu um erro ao processar o evento.");
    }
  },
};