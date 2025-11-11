import { arenaChallenge, arenaStatus, arenaReward } from "../src/systems/arenaSystem.js";

export default {
  name: "arena",
  description: "Desafie outros jogadores na Arena ou veja seu status.",
  
  async execute(message, args, user) {
    const sub = args[0];
    const target = args[1]; // ID ou nome do oponente
    let response;
    
    switch (sub) {
      case "status":
        response = await arenaStatus(user);
        break;
        
      case "lutar":
        if (!target) {
          response = "⚔️ Use: `!arena lutar <idDoOponente>`";
        } else {
          response = await arenaChallenge(user, target);
        }
        break;
        
      case "recompensa":
        response = await arenaReward(user);
        break;
        
      default:
        response =
          "🏆 **Comandos da Arena:**\n" +
          "`!arena status` — Ver seu rank e pontos\n" +
          "`!arena lutar <id>` — Desafiar outro jogador\n" +
          "`!arena recompensa` — Receber bônus do seu rank";
    }
    
    await message.reply(response);
  }
};