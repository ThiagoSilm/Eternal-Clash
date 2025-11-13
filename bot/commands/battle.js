// src/commands/battle.js

import { runBattle } from "../../src/systems/battleSystem.js";
import { spendEnergy, addXP, addGold, regenerateEnergy } from "../../src/systems/economySystem.js";

export default {
  name: "battle",
  description: "Batalhe contra inimigos e ganhe XP e ouro.",
  
  async execute(message, args, user) {
    if (!user) {
      return message.reply("⚠️ Usuário não carregado. Reinicie o comando.");
    }
    
    let reply = "";
    
    // ----------------------------------------------------
    // 1. Regeneração automática de energia
    // ----------------------------------------------------
    const regenMsg = regenerateEnergy(user);
    if (regenMsg) reply += `⚡ ${regenMsg}\n`;
    
    const energyCost = 4;
    if (!spendEnergy(user, energyCost)) {
      return message.reply(
        reply + `❌ Energia insuficiente. Você precisa de **${energyCost}** de energia.`
      );
    }
    
    // ----------------------------------------------------
    // 2. Oponente padrão (placeholder temporário)
    // ----------------------------------------------------
    const opponent = {
      id: "cpu_shadow",
      name: "CPU - Oponente Sombrio",
      cards: [
        { id: "shadow_beast", name: "Monstro das Sombras", hp: 120, attack: 35 },
        { id: "lesser_demon", name: "Demônio Menor", hp: 90, attack: 25 }
      ],
      guardianId: "G02"
    };
    
    // ----------------------------------------------------
    // 3. BATALHA REAL
    // ----------------------------------------------------
    let battle;
    try {
      battle = runBattle(user, opponent); // novo nome mais adequado
    } catch (err) {
      console.error("❌ Erro no runBattle:", err);
      return message.reply("⚠️ Erro interno ao processar a batalha.");
    }
    
    // ----------------------------------------------------
    // 4. Resumo do LOG (para não explodir o Discord)
    // ----------------------------------------------------
    const maxLines = 8;
    const summary =
      battle.log.length > maxLines ?
      battle.log.slice(0, maxLines).join("\n") +
      `\n... (${battle.log.length} eventos totais)` :
      battle.log.join("\n");
    
    reply +=
      `\n**⚔️ INÍCIO DA BATALHA**\n` +
      "━━━━━━━━━━━━━━\n" +
      summary +
      `\n\n🕒 **Turnos:** ${battle.turns}\n`;
    
    // ----------------------------------------------------
    // 5. Recompensas
    // ----------------------------------------------------
    if (battle.winner === "player") {
      const xpGain = 1500;
      const goldGain = 800;
      
      addXP(user, xpGain);
      addGold(user, goldGain);
      
      reply +=
        `\n🏆 **Você venceu!**\n` +
        `✨ XP ganho: **${xpGain}**\n` +
        `💰 Ouro ganho: **${goldGain}**\n`;
    } else {
      reply += "\n😓 **Derrota!** Nenhuma recompensa recebida.";
    }
    
    // ----------------------------------------------------
    // 6. Resposta final
    // ----------------------------------------------------
    return message.reply({
      content: reply,
      allowedMentions: { repliedUser: false }
    });
  }
};