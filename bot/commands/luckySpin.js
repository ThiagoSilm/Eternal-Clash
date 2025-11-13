// src/commands/luckySpin.js

// 🚨 CORREÇÃO: Removemos a importação de loadUser/saveUser.
import { spinLuckyWheel } from "../src/systems/luckySpinSystem.js";

export default {
  name: "luckyspin",
  description: "Gira a roda da sorte por 100 de ouro. Cada 10 giros, ganha um giro grátis especial.",
  usage: "[spin [quantidade] | status]",
  
  // ⚠️ ATENÇÃO: Recebe o objeto 'user' do middleware do index.js
  async execute(message, args, user) { 
    
    // Inicializa a estrutura da roleta se ela ainda não existir
    if (!user.luckySpin) {
        user.luckySpin = {
            spins: 0,
            freeSpins: 0,
        };
    }

    const subcommand = (args[0] || "spin").toLowerCase();
    
    if (subcommand === "spin") {
      const count = parseInt(args[1]) || 1;
      
      if (count < 1) return message.reply("❌ Informe um número válido de giros.");
      if (count > 10) return message.reply("⚠️ Máximo de 10 giros por comando.");
      
      let totalResult = "";
      
      // O spinLuckyWheel(user) deve modificar o objeto 'user' (ouro e contagem de giros)
      for (let i = 0; i < count; i++) {
        const result = spinLuckyWheel(user);
        totalResult += `🎰 Giro ${i + 1}: ${result}\n`;
      }
      
      // O index.js (middleware) cuidará do salvamento automático.
      return message.reply(totalResult.trim());
      
    } else if (subcommand === "status") {
      const spins = user.luckySpin.spins;
      const free = user.luckySpin.freeSpins;
      
      return message.reply(`🎯 Status da Roda da Sorte:\n` + 
                           `🔄 Giros pagos usados: **${spins}**\n` +
                           `✨ Giros grátis acumulados: **${free}**`);
                           
    } else {
      return message.reply("❌ Subcomando inválido. Use: `!luckyspin spin [quantidade]` ou `!luckyspin status`.");
    }
  }
};
