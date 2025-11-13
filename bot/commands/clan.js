import {
  createClan,
  joinClan,
  leaveClan,
  donateToClan,
  getClanInfo,
  getClanRankings
} from "../../src/systems/clanSystem.js";

import { saveUser } from "../../src/systems/userSystem.js";

export default {
  name: "clan",
  description: "Gerencie ou participe de um clã.",
  
  async execute(message, args, user) {
    const sub = args[0]?.toLowerCase();
    let response = "";
    
    switch (sub) {
      case "criar":
        response = createClan(user, args.slice(1).join(" "));
        break;
        
      case "entrar":
        response = joinClan(user, args.slice(1).join(" "));
        break;
        
      case "sair":
        response = leaveClan(user);
        break;
        
      case "doar":
        const amount = parseInt(args[1]);
        if (!amount || amount <= 0) {
          response = "❌ Informe um valor válido para doar.";
        } else {
          response = donateToClan(user, amount);
        }
        break;
        
      case "info":
        response = getClanInfo(args.slice(1).join(" "));
        break;
        
      case "ranking":
        const top = getClanRankings();
        response = "🏆 **Ranking Global de Clãs:**\n";
        top.forEach((clan, i) => {
          response += `${i + 1}. ${clan.name} — Nível ${clan.level}, XP: ${clan.xp}, Membros: ${clan.members.length}\n`;
        });
        break;
        
      default:
        response =
          "🏰 **Comandos do Clã:**\n" +
          "`!clan criar <nome>` — Cria um clã\n" +
          "`!clan entrar <nome>` — Entra em um clã\n" +
          "`!clan sair` — Sai do seu clã\n" +
          "`!clan doar <quantia>` — Doe recursos para o clã\n" +
          "`!clan info <nome>` — Informações do clã\n" +
          "`!clan ranking` — Ranking global dos clãs";
    }
    
    saveUser(user);
    await message.reply(response);
  }
};