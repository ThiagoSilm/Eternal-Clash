// src/commands/altar.js
import { loadUser, saveUser } from "../../src/systems/economySystem.js";
import { summonCard, summonMultiple } from "../../src/systems/summonSystem.js";
import { getCardTemplate } from "../../src/systems/cardSystem.js";

export default {
  name: "altar",
  description: "Invoca cartas ou guardiões pelo altar usando ouro, cupom ou gemas.",
  async execute(message, args) {
    const userId = message.author.id;
    const user = loadUser(userId);
    
    const validTypes = ["gold", "gem", "coupon", "guardian", "booster"];
    const typeArg = (args[0] || "gold").toLowerCase();
    
    if (!validTypes.includes(typeArg)) {
      return message.reply(
        "❌ Tipo inválido. Use: gold, gem, coupon, guardian ou booster."
      );
    }
    
    let count = parseInt(args[1]) || 1;
    if (count < 1) count = 1;
    if (count > 5) count = 5; // limite para evitar spam
    
    let results = [];
    
    try {
      if (typeArg === "guardian") {
        for (let i = 0; i < count; i++) {
          const msg = summonCard(user, "guardian");
          results.push(msg);
        }
      } else if (typeArg === "booster") {
        for (let i = 0; i < count; i++) {
          const msgs = summonMultiple(user, "booster", 5).split("\n");
          results.push(...msgs);
        }
      } else {
        if (count === 1) {
          results.push(summonCard(user, typeArg));
        } else {
          const msgs = summonMultiple(user, typeArg, count).split("\n");
          results.push(...msgs);
        }
      }
      
      // Adiciona detalhes de cada carta invocada
      const detailed = results.map((line) => {
        // tenta extrair o ID da carta do texto retornado pelo summonSystem
        const match = line.match(/(\d+★)/);
        if (match) return line;
        return line;
      });
      
      saveUser(user);
      await message.reply(detailed.join("\n"));
    } catch (err) {
      console.error("Erro no altar:", err);
      await message.reply("⚠️ Ocorreu um erro ao invocar no altar.");
    }
  },
};