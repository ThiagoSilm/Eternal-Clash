// src/commands/altar.js

// 🚨 CORREÇÃO: Removemos loadUser/saveUser.
import { summonCard, summonMultiple } from "../../src/systems/summonSystem.js";
import { getCardTemplate } from "../../src/systems/cardSystem.js";

export default {
  name: "altar",
  description: "Invoca cartas ou guardiões pelo altar usando ouro, cupom ou gemas.",
  usage: "<gold | gem | coupon | guardian | booster> [quantidade]",
  
  // ⚠️ ATENÇÃO: Adicionamos o objeto 'user' para receber o dado do middleware
  async execute(message, args, user) {
    
    // O usuário já está garantido e carregado (ou criado) pelo index.js.
    
    const validTypes = ["gold", "gem", "coupon", "guardian", "booster"];
    const typeArg = (args[0] || "gold").toLowerCase();
    
    if (!validTypes.includes(typeArg)) {
      return message.reply(
        "❌ Tipo inválido. Use: `gold`, `gem`, `coupon`, `guardian` ou `booster`."
      );
    }
    
    let count = parseInt(args[1]) || 1;
    if (count < 1) count = 1;
    // O limite de 5 é uma boa prática
    if (count > 5) count = 5; 
    
    let results = [];
    
    try {
      if (typeArg === "guardian") {
        // Invocação de Guardião (geralmente única)
        for (let i = 0; i < count; i++) {
          // summonCard(user, type) deve modificar o objeto user
          const msg = summonCard(user, "guardian");
          results.push(msg);
        }
      } else if (typeArg === "booster") {
        // Invocação de Booster (invoca múltiplas de uma vez, mas o loop controla a quantidade de boosters)
        for (let i = 0; i < count; i++) {
          // summonMultiple retorna uma string que pode conter várias linhas
          const msgs = summonMultiple(user, "booster", 5).split("\n"); 
          results.push(...msgs);
        }
      } else {
        // Invocação normal (gold, gem, coupon)
        if (count === 1) {
          results.push(summonCard(user, typeArg));
        } else {
          // Multi-summon usando a função que lida com custos e resultados em massa
          const msgs = summonMultiple(user, typeArg, count).split("\n");
          results.push(...msgs);
        }
      }
      
      // Formatação dos resultados
      const detailed = results.map((line) => {
        // Adiciona um emoji simples de destaque para facilitar a leitura
        return `🌟 ${line}`;
      });
      
      // O index.js (middleware) cuidará do salvamento automático.
      await message.reply(`🔮 **Invocação por ${typeArg.toUpperCase()} (x${count})**:\n---\n${detailed.join("\n")}`);
      
    } catch (err) {
      console.error("❌ Erro no altar:", err);
      // Se o erro for uma string (ex: "Ouro insuficiente"), exibe a mensagem amigável
      if (typeof err === 'string') {
          await message.reply(`⚠️ ${err}`);
      } else {
          await message.reply("⚠️ Ocorreu um erro ao invocar no altar.");
      }
    }
  },
};
