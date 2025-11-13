// src/commands/luckySpin.js

import { spinLucky } from "../../src/systems/luckySpinSystem.js";

export default {
  name: "luckyspin",
  description: "Gira a roda da sorte por 100 gemas. A cada 10 giros pagos, ganha 1 giro especial grátis.",
  usage: "[spin [quantidade] | status]",
  
  async execute(message, args, user) {
    
    // Blindagem total
    if (!user.luckySpin || typeof user.luckySpin !== "object") {
      user.luckySpin = { spins: 0, freeSpins: 0 };
    }
    
    let sub = (args[0] || "spin").toLowerCase();
    
    // Caso o usuário informe apenas um número → é quantidade
    if (!isNaN(parseInt(sub))) {
      args.unshift("spin");
      sub = "spin";
    }
    
    // ------------------------------
    // STATUS
    // ------------------------------
    if (sub === "status") {
      const { spins, freeSpins } = user.luckySpin;
      return message.reply(
        `🎯 **Status da Roda da Sorte**\n` +
        `🔄 Giros pagos total: **${spins}**\n` +
        `✨ Giros grátis acumulados: **${freeSpins}**`
      );
    }
    
    // ------------------------------
    // SPIN
    // ------------------------------
    if (sub === "spin") {
      
      const count = Math.min(parseInt(args[1]) || 1, 100);
      if (count < 1) return message.reply("❌ Informe uma quantidade válida de giros.");
      
      let res = `🎰 **Roda da Sorte — ${count} giros**\n`;
      
      let paidSpins = 0;
      
      for (let i = 0; i < count; i++) {
        
        const result = spinLucky(user);
        
        // spinLucky deve lançar erro se faltar gemas
        if (typeof result === "string" && result.startsWith("ERR:")) {
          return message.reply("❌ " + result.replace("ERR:", "").trim());
        }
        
        paidSpins++;
        res += `\n➡️ **Giro ${i + 1}:** ${result}`;
      }
      
      // GIRO ESPECIAL AUTOMÁTICO
      let freeUsed = 0;
      let fullFreeLog = "";
      
      while (user.luckySpin.freeSpins > 0) {
        user.luckySpin.freeSpins--;
        freeUsed++;
        
        const freeResult = spinLucky(user, true);
        fullFreeLog += `\n✨ **Giro Especial:** ${freeResult}`;
      }
      
      if (freeUsed > 0) {
        res += `\n\n🎁 Você ganhou **${freeUsed} giro(s) especial(is)**!\n${fullFreeLog}`;
      }
      
      return message.reply(res.trim());
    }
    
    // ------------------------------
    // SUBCOMANDO INVÁLIDO
    // ------------------------------
    return message.reply(
      "❌ Subcomando inválido.\n" +
      "**Use:**\n" +
      "`!luckyspin` — 1 giro\n" +
      "`!luckyspin 5` — 5 giros\n" +
      "`!luckyspin spin 10` — 10 giros\n" +
      "`!luckyspin status` — ver status"
    );
  }
};