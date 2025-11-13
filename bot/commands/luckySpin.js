// src/commands/luckySpin.js
import { loadUser, saveUser } from "../../src/systems/economySystem.js";
import { spinLuckyWheel } from "../../src/systems/luckySpinSystem.js";

export default {
  name: "luckyspin",
  description: "Gira a roda da sorte por 100 de ouro. Cada 10 giros, ganha um giro grátis especial.",
  async execute(message, args) {
    const userId = message.author.id;
    const user = loadUser(userId);
    
    const subcommand = (args[0] || "spin").toLowerCase();
    
    if (subcommand === "spin") {
      const count = parseInt(args[1]) || 1;
      if (count < 1) return message.reply("❌ Informe um número válido de giros.");
      if (count > 10) return message.reply("⚠️ Máximo de 10 giros por comando.");
      
      let totalResult = "";
      for (let i = 0; i < count; i++) {
        const result = spinLuckyWheel(user);
        totalResult += `🎰 Giro ${i + 1}: ${result}\n`;
      }
      
      saveUser(user);
      return message.reply(totalResult.trim());
    } else if (subcommand === "status") {
      const spins = user.luckySpin?.spins || 0;
      const free = user.luckySpin?.freeSpins || 0;
      return message.reply(`🎯 Giros usados: ${spins} | Giros grátis acumulados: ${free}`);
    } else {
      return message.reply("❌ Subcomando inválido. Use: spin, status.");
    }
  }
};