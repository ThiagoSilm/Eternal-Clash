// src/commands/altar.js

import { summonCard, summonMultiple, summonBooster } from "../../src/systems/summonSystem.js";

export default {
  name: "altar",
  description: "Invoca cartas ou guardiões pelo altar usando ouro, cupom ou gemas.",
  usage: "<gold | gem | coupon | guardian | booster> [quantidade]",
  
  async execute(message, args, user) {
    
    // 1. Variáveis e Validação de Entrada
    const validTypes = ["gold", "gem", "coupon", "booster"]; // 'guardian' é uma carta, não um tipo de invocação separado aqui
    const typeArg = (args[0] || "gold").toLowerCase();
    
    if (!validTypes.includes(typeArg)) {
      return message.reply(
        "❌ Tipo inválido. Use: `gold`, `gem`, `coupon` ou `booster`."
      );
    }
    
    let count = parseInt(args[1]) || 1;
    if (count < 1) count = 1;
    // O limite é importante para evitar spam e sobrecarga, mantemos 5.
    const MAX_COUNT = 5;
    if (count > MAX_COUNT && typeArg !== "booster") { 
        // Booster geralmente abre 1 de cada vez, mas se for o caso de multi-booster, reavalie MAX_COUNT
        count = MAX_COUNT; 
    }
    
    let results = [];
    
    try {
      
      // 2. Lógica de Invocação
      if (typeArg === "booster") {
        // Boosters são mais complexos e devem usar a função específica do summonSystem
        if (count > 1) {
            // Em produção, se o booster tem um ID, não é ideal rodar em loop
            return message.reply("⚠️ Para Booster, use apenas 1 por vez para especificar o ID.");
        }
        
        // Assumindo que o ID do booster é o args[1] ou que só existe 1 ID por padrão
        // Se a lógica da loja e do inventário permitir, o usuário deve passar o ID do booster.
        // Vou assumir que o usuário deve passar o ID: !altar booster <booster_id>
        const boosterId = args[1]; 
        if (!boosterId) {
             return message.reply("❌ Por favor, especifique o ID do Booster que você deseja abrir (ex: `!altar booster premium_pack`).");
        }
        
        const msg = summonBooster(user, boosterId);
        results.push(msg);

      } else {
        // gold, gem, coupon: Invocação normal (single ou multi)
        if (count === 1) {
          const msg = summonCard(user, typeArg);
          results.push(msg);
        } else {
          // Invocação Múltipla
          const msg = summonMultiple(user, typeArg, count);
          results.push(msg);
        }
      }
      
      // 3. Formatação e Resposta
      // O `summonMultiple` já retorna uma string com quebras de linha.
      const finalMessage = results.join("\n");
      
      await message.reply(`🔮 **Invocação por ${typeArg.toUpperCase()} (x${count})**:\n---\n${finalMessage}`);
      
    } catch (err) {
      // 4. Manuseio Robusto de Erros
      let errorMessage = "⚠️ Ocorreu um erro interno ao invocar no altar.";
      
      // Capturamos erros lançados intencionalmente (ex: "Ouro insuficiente")
      if (err instanceof Error) {
          // Se for uma mensagem de erro de jogo (ex: economia ou carta)
          errorMessage = `⚠️ ${err.message}`;
      } else if (typeof err === 'string') {
          // Caso algum sistema subjacente ainda lance strings em vez de Error
          errorMessage = `⚠️ ${err}`;
      }
      
      console.error(`❌ Erro no comando !altar (${typeArg}, x${count}):`, err);
      await message.reply(errorMessage);
    }
  },
};
