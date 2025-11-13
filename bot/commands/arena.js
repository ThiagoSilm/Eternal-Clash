// src/commands/arena.js

import {
  arenaChallenge,
  arenaStatus,
  arenaReward
} from "../../src/systems/arenaSystem.js";

export default {
  name: "arena",
  description: "Desafie jogadores na Arena, veja status ou colete recompensas.",
  usage: "[status | lutar <1-5> | recompensa]",
  
  async execute(message, args, user) {
    if (!user) {
      return message.reply("⚠️ Usuário não encontrado no sistema. Tente novamente.");
    }
    
    const sub = (args[0] || "").toLowerCase();
    const num = Number(args[1]);
    
    try {
      // Sempre checa reset diário antes de qualquer ação
      await arenaStatus(user, { checkReset: true }).catch(() => {});
      
      let reply;
      
      switch (sub) {
        // ----------------------------------------------------
        // STATUS
        // ----------------------------------------------------
        case "status": {
          reply = await arenaStatus(user);
          break;
        }
        
        // ----------------------------------------------------
        // LUTAR
        // ----------------------------------------------------
        case "lutar": {
          if (!Number.isInteger(num) || num < 1 || num > 5) {
            return message.reply(
              "❌ Escolha inválida.\nUse: `!arena lutar <1-5>` para selecionar o oponente pelo índice."
            );
          }
          
          reply = await arenaChallenge(user, num);
          break;
        }
        
        // ----------------------------------------------------
        // RECOMPENSA
        // ----------------------------------------------------
        case "recompensa": {
          reply = await arenaReward(user);
          break;
        }
        
        // ----------------------------------------------------
        // DEFAULT / AJUDA
        // ----------------------------------------------------
        default: {
          reply =
            "🏆 **Comandos da Arena**\n" +
            "━━━━━━━━━━━━━━\n" +
            "`!arena status` — Ver tentativas, cooldown e lista de oponentes.\n" +
            "`!arena lutar <1-5>` — Desafiar um oponente da sua lista.\n" +
            "`!arena recompensa` — Resgatar recompensas diárias/semanal.\n";
        }
      }
      
      return message.reply({
        content: reply,
        allowedMentions: { repliedUser: false }
      });
      
    } catch (err) {
      console.error(`❌ Erro no comando !arena (${sub})`, err);
      
      const msg =
        err instanceof Error ?
        `⚠️ ${err.message}` :
        "⚠️ Erro interno ao processar a Arena.";
      
      return message.reply({
        content: msg,
        allowedMentions: { repliedUser: false }
      });
    }
  }
};