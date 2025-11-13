// src/commands/altar.js

import {
  summonCard,
  summonMultiple,
  summonBooster
} from "../../src/systems/summonSystem.js";

export default {
  name: "altar",
  description: "Invoca cartas ou abre boosters usando gold, gem, coupon ou booster.",
  usage: "<gold | gem | coupon | booster> [quantidade | booster_id]",
  
  async execute(message, args, user) {
    try {
      // ----------------------------------------------------
      // 1. NORMALIZAÇÃO DE ENTRADA
      // ----------------------------------------------------
      const validTypes = ["gold", "gem", "coupon", "booster"];
      const type = (args[0] || "gold").toLowerCase();
      
      if (!validTypes.includes(type)) {
        return message.reply(
          "❌ Tipo inválido.\nUse: `gold`, `gem`, `coupon` ou `booster`."
        );
      }
      
      // ----------------------------------------------------
      // 2. BOOSTER (fluxo especial)
      // ----------------------------------------------------
      if (type === "booster") {
        const boosterId = args[1];
        
        if (!boosterId) {
          return message.reply(
            "❌ Você precisa informar o **ID do booster**.\nExemplo: `!altar booster premium_pack`"
          );
        }
        
        const result = summonBooster(user, boosterId);
        
        return message.reply(
          `🎁 **Booster Aberto: ${boosterId}**\n---\n${result}`
        );
      }
      
      // ----------------------------------------------------
      // 3. INVOCAR CARTAS (TIPOS PADRÃO)
      // ----------------------------------------------------
      let count = parseInt(args[1]) || 1;
      const MAX_COUNT = 5;
      if (count < 1) count = 1;
      if (count > MAX_COUNT) count = MAX_COUNT;
      
      let result;
      if (count === 1) {
        result = summonCard(user, type);
      } else {
        result = summonMultiple(user, type, count);
      }
      
      // ----------------------------------------------------
      // 4. RESPOSTA AO JOGADOR
      // ----------------------------------------------------
      await message.reply(
        `🔮 **Invocação por ${type.toUpperCase()} (x${count})**\n---\n${result}`
      );
      
      // ----------------------------------------------------
      // FIM DO TRY
      // ----------------------------------------------------
    } catch (err) {
      console.error("❌ Erro no comando !altar:", err);
      
      const msg =
        err instanceof Error ?
        `⚠️ ${err.message}` :
        "⚠️ Ocorreu um erro interno ao realizar a invocação.";
      
      return message.reply(msg);
    }
  },
};