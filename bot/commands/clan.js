import {
  createClan,
  joinClan,
  leaveClan,
  donateToClan,
  getClanInfo
} from "../../src/systems/clanSystem.js";

import { saveUser } from "../../src/systems/userSystem.js"; // garante persistência

export default {
  name: "clan",
  description: "Gerencie ou participe de um clã.",
  
  async execute(message, args, user) {
    const sub = args[0];
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
        response = donateToClan(user, parseInt(args[1]));
        break;
        
      case "info":
        response = getClanInfo(args.slice(1).join(" "));
        break;
        
      default:
        response =
          "🏰 **Comandos do Clã:**\n" +
          "`!clan criar <nome>` — Cria um clã\n" +
          "`!clan entrar <nome>` — Entra em um clã\n" +
          "`!clan sair` — Sai do seu clã\n" +
          "`!clan doar <quantia>` — Doe recursos para o clã\n" +
          "`!clan info <nome>` — Informações do clã";
    }
    
    // Garante que as alterações no jogador (ouro, XP, status do clã etc.) sejam salvas
    saveUser(user);
    
    await message.reply(response);
  }
};