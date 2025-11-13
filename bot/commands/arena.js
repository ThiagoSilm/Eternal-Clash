// src/commands/arena.js

// Importamos o sistema de Arena (precisará ser atualizado para a nova lógica)
import { arenaChallenge, arenaStatus, arenaReward, getMatchmakingList } from "../../src/systems/arenaSystem.js";

export default {
  name: "arena",
  description: "Desafie outros jogadores na Arena ou veja seu status.",
  // Ajuste do usage para refletir a escolha por número
  usage: "[status | lutar <1-5> | recompensa]",
  
  async execute(message, args, user) {
    const sub = args[0]?.toLowerCase();
    const targetArg = args[1]; // Agora será um número (1-5)
    let response;
    
    try {
      // O sistema deve verificar e resetar as tentativas/lista de oponentes diariamente
      await arenaStatus(user, { checkReset: true }); 
      
      switch (sub) {
        case "status":
          // 1. Mostrar lista de oponentes, tentativas, e cooldown
          response = await arenaStatus(user);
          break;
          
        case "lutar":
          // 2. Lutar contra um oponente da lista (1-5)
          const opponentIndex = parseInt(targetArg);

          if (isNaN(opponentIndex) || opponentIndex < 1 || opponentIndex > 5) {
            throw new Error("❌ Use: `!arena lutar <número>` onde o número é o índice (1-5) do oponente na sua lista.");
          }
          
          // O sistema fará: verificar cooldown, gastar tentativa, realizar batalha, gerenciar vitória/derrota.
          response = await arenaChallenge(user, opponentIndex);
          break;
          
        case "recompensa":
          // 3. Resgatar recompensa (lógica não alterada)
          response = await arenaReward(user);
          break;
          
        default:
          // 4. Ajuda Padrão Revisada
          response =
            "🏆 **Comandos da Arena**\n" +
            "---" +
            "`!arena status` — Ver sua lista de oponentes, tentativas e cooldown.\n" +
            "`!arena lutar <1-5>` — Desafiar um oponente pelo número do índice.\n" +
            "`!arena recompensa` — Receber bônus de rank diário/semanal.";
      }
      
      await message.reply({ content: response, allowedMentions: { repliedUser: false } });
      
    } catch (err) {
      let errorMessage = "⚠️ Ocorreu um erro interno ao processar o comando da Arena.";
      
      if (err instanceof Error) {
          errorMessage = `⚠️ ${err.message}`;
      } else if (typeof err === 'string') {
          errorMessage = `⚠️ ${err}`;
      }
      
      console.error(`❌ Erro no comando !arena (${sub}):`, err);
      await message.reply({ content: errorMessage, allowedMentions: { repliedUser: false } });
    }
  }
};
