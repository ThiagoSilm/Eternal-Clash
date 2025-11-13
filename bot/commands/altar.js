// src/commands/altar.js
//
// 🔮 Sistema de Invocação
// Este comando lida com:
// - Invocação simples (gold, gem, coupon)
// - Invocação múltipla (limite automático)
// - Abertura de boosters específicos
//
// O salvamento do USER é feito pelo middleware -> NÃO inclui saveUser aqui.

import {
  summonCard,
  summonMultiple,
  summonBooster
} from "../../src/systems/summonSystem.js";

export default {
  name: "altar",
  description: "Invoca cartas ou abre boosters com gold, gem, coupon ou booster.",
  usage: "!altar <gold|gem|coupon|booster> [quantidade|booster_id]",
  
  async execute(message, args, user) {
    // ----------------------------
    // 1. NORMALIZAÇÃO
    // ----------------------------
    const type = (args[0] || "").toLowerCase();
    const validTypes = ["gold", "gem", "coupon", "booster"];
    
    if (!validTypes.includes(type)) {
      return message.reply(
        "❌ Tipo inválido.\nUse: `gold`, `gem`, `coupon` ou `booster`."
      );
    }
    
    try {
      // ----------------------------
      // 2. MODO BOOSTER
      // ----------------------------
      if (type === "booster") {
        const boosterId = args[1];
        
        if (!boosterId) {
          return message.reply(
            "❌ Você deve informar o **ID do booster**.\nExemplo: `!altar booster premium_pack`"
          );
        }
        
        const result = summonBooster(user, boosterId);
        
        return message.reply(
          `🎁 **Booster aberto:** \`${boosterId}\`\n\n${result}`
        );
      }
      
      // ----------------------------
      // 3. MODO INVOCAR CARTAS (GOLD / GEM / COUPON)
      // ----------------------------
      const MAX_SUMMON = 10; // limite seguro
      let count = parseInt(args[1]) || 1;
      
      if (count < 1) count = 1;
      if (count > MAX_SUMMON) count = MAX_SUMMON;
      
      let result;
      
      if (count === 1) {
        result = summonCard(user, type);
      } else {
        result = summonMultiple(user, type, count);
      }
      
      return message.reply(
        `🔮 **Invocação usando ${type.toUpperCase()} (x${count})**\n\n${result}`
      );
      
      // ----------------------------
      // FIM DO TRY
      // ----------------------------
      
    } catch (err) {
      console.error("❌ Erro no comando ALtar:", err);
      
      const msg =
        err instanceof Error ?
        `⚠️ ${err.message}` :
        "⚠️ Erro inesperado ao realizar a invocação.";
      
      return message.reply(msg);
    }
  }
};