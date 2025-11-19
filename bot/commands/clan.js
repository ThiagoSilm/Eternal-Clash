import {
  createClan,
  joinClan,
  leaveClan,
  donateToClan,
  getClanInfo,
  getClanRankings,
  registerUser
} from "../../src/systems/clanSystem.js";

export default {
  name: "clan",
  description: "Gerencie ou participe de um clã.",
  usage: "[criar <nome> | entrar <nome> | sair | doar <quantia> | info [nome] | ranking]",
  
  async execute(message, args, user) {
    const sub = args[0]?.toLowerCase();
    let response = "";
    
    // Registrar usuário no sistema (simula banco)
    if (!user.username) user.username = message.author.username;
    user = await registerUser(user.id, user.username, user.gold || 0);
    
    try {
      switch (sub) {
        case "criar":
          const clanName = args.slice(1).join(" ");
          if (!clanName) return await message.reply("❌ Informe um nome para o clã.");
          if (user.clanId) return await message.reply("❌ Você já está em um clã!");
          response = await createClan(user, clanName);
          break;
          
        case "entrar":
          const joinTarget = args.slice(1).join(" ");
          if (!joinTarget) return await message.reply("❌ Informe o nome ou ID do clã que deseja entrar.");
          if (user.clanId) return await message.reply("❌ Saia do seu clã atual antes de entrar em outro.");
          response = await joinClan(user, joinTarget);
          break;
          
        case "sair":
          response = await leaveClan(user);
          break;
          
        case "doar":
          const amount = parseInt(args[1]);
          if (!amount || amount <= 0) return await message.reply("❌ Informe um valor válido para doar (Ouro).");
          response = await donateToClan(user, amount);
          break;
          
        case "info":
          const infoTarget = args.slice(1).join(" ") || user.clanId;
          response = await getClanInfo(infoTarget);
          break;
          
        case "ranking":
          const topClans = await getClanRankings();
          response = "🏆 **Ranking Global de Clãs (TOP 10):**\n---";
          if (!topClans.length) response += "\nNenhum clã no ranking.";
          else topClans.forEach((clan, i) => {
            response += `\n${i + 1}. **${clan.name}** (Nv. ${clan.level}) — XP: ${clan.xp}, Membros: ${clan.members.length}`;
          });
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
      
      await message.reply({ content: response, allowedMentions: { repliedUser: false } });
      
    } catch (err) {
      console.error("❌ Erro no comando do clã:", err);
      await message.reply(`⚠️ Ocorreu um erro ao processar o comando do clã:\n\`${err.message}\``);
    }
  }
};