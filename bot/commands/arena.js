// src/commands/arena.js

import { arenaChallenge, arenaStatus, arenaReward } from "../../src/systems/arenaSystem.js";

export default {
  name: "arena",
  description: "Desafie outros jogadores na Arena ou veja seu status.",
  usage: "[status | lutar <id> | recompensa]",
  
  async execute(message, args, user) {
    const sub = args[0]?.toLowerCase(); // Uso seguro do subcomando
    const target = args[1]; // ID ou nome do oponente
    let response;
    
    try {
      switch (sub) {
        case "status":
          // Comando de leitura. arenaStatus deve retornar string com rank/pontos
          response = await arenaStatus(user);
          break;
          
        case "lutar":
          if (!target) {
            response = "⚔️ Use: `!arena lutar <idDoOponente>` (Pode ser o ID ou o nome do usuário do Discord).";
          } else {
            // arenaChallenge deve modificar o objeto 'user' (gasto de energia/tentativas)
            // e possivelmente o objeto do oponente (se for outro user do bot).
            response = await arenaChallenge(user, target);
          }
          break;
          
        case "recompensa":
          // arenaReward deve modificar o objeto 'user' (adicionando ouro/itens)
          response = await arenaReward(user);
          break;
          
        default:
          response =
            "🏆 **Comandos da Arena**\n" +
            "---" +
            "`!arena status` — Ver seu rank e pontos atuais.\n" +
            "`!arena lutar <id>` — Desafiar outro jogador ou NPC.\n" +
            "`!arena recompensa` — Receber bônus de rank diário/semanal.";
      }
      
      // O index.js cuidará de chamar markUserDirty(user) se o objeto 'user' foi modificado.
      await message.reply({ content: response, allowedMentions: { repliedUser: false } });
      
    } catch (err) {
      console.error("❌ Erro no comando da Arena:", err);
      await message.reply("⚠️ Ocorreu um erro ao processar o comando da Arena.");
    }
  }
};
