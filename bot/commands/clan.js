// src/commands/clan.js

import {
  createClan,
  joinClan,
  leaveClan,
  donateToClan,
  getClanInfo,
  getClanRankings
} from "../../src/systems/clanSystem.js";

export default {
  name: "clan",
  description: "Gerencie ou participe de um clã.",
  usage: "[criar <nome> | entrar <nome> | sair | doar <quantia> | info [nome] | ranking]",
  
  // O objeto 'user' é passado corretamente pelo middleware
  async execute(message, args, user) {
    const sub = args[0]?.toLowerCase();
    let response = "";
    
    // Assumimos que o campo 'username' está no objeto user para logging no clanSystem
    if (!user.username) {
        user.username = message.author.username;
    }
    
    try {
      switch (sub) {
        case "criar":
          const clanName = args.slice(1).join(" ");
          response = createClan(user, clanName);
          break;
            
        case "entrar":
          const joinTarget = args.slice(1).join(" ");
          response = joinClan(user, joinTarget);
          break;
            
        case "sair":
          response = leaveClan(user);
          break;
            
        case "doar":
          const amount = parseInt(args[1]);
          if (!amount || amount <= 0) {
            response = "❌ Informe um valor válido para doar (Ouro).";
          } else {
            response = donateToClan(user, amount);
          }
          break;
            
        case "info":
          // Se não houver nome, mostra info do clã do usuário
          const infoTarget = args.slice(1).join(" ") || user.clanId; 
          if (!infoTarget) {
              response = "❌ Informe o nome/ID do clã ou entre em um para ver as informações.";
          } else {
              response = getClanInfo(infoTarget);
          }
          break;
            
        case "ranking":
          const topClans = getClanRankings();
          response = "🏆 **Ranking Global de Clãs (TOP 10):**\n---";
          
          if (topClans.length === 0) {
              response += "\nNenhum clã no ranking.";
          } else {
              topClans.forEach((clan, i) => {
                  response += `\n${i + 1}. **${clan.name}** (Nv. ${clan.level}) — XP: ${clan.xp}, Membros: ${clan.members?.length || 'N/A'}`;
              });
          }
          break;
            
        default:
          response =
            "🏰 **Comandos do Clã:**\n" +
            "`!clan criar <nome>` — Cria um clã (Custo: 5000 Ouro)\n" +
            "`!clan entrar <nome/id>` — Entra em um clã\n" +
            "`!clan sair` — Sai do seu clã\n" +
            "`!clan doar <quantia>` — Doe Ouro para o clã (dá XP ao clã)\n" +
            "`!clan info [nome/id]` — Informações de um clã\n" +
            "`!clan ranking` — Ranking global dos clãs";
      }
      
      // O salvamento do objeto 'user' (alterado em criar, entrar, sair, doar)
      // é delegado ao index.js.
      await message.reply({ content: response, allowedMentions: { repliedUser: false } });

    } catch (err) {
        console.error("❌ Erro no comando do clã:", err);
        await message.reply("⚠️ Ocorreu um erro ao processar o comando do clã.");
    }
  }
};
