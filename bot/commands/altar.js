// src/commands/altar.js

import {
  summonCard,
  summonMultiple,
  getSummonLuck,
  increaseSummonLuck,
  resetSummonLuck,
  altarJackpotRoll
} from "../../src/systems/summonSystem.js";

export default {
  name: "altar",
  description: "Invoca cartas e usa rituais especiais.",
  usage: "!altar <gold|gems|coupons|sagrado|corrupto> [quantidade]",
  
  async execute(message, args, user) {
    const type = (args[0] || "").toLowerCase();
    const validTypes = ["gold", "gems", "coupons", "sagrado", "corrupto"];
    
    if (!validTypes.includes(type)) {
      return message.reply(
        "❌ Tipo inválido.\nTipos: `gold`, `gems`, `coupons`, `sagrado`, `corrupto`."
      );
    }
    
    try {
      // ======================================================
      // 🔮 1. RITUAL SAGRADO — aumenta drasticamente o Pity
      // ======================================================
      if (type === "sagrado") {
        const luck = increaseSummonLuck(user, 20); // +20% pity
        return message.reply(
          `✨ **RITUAL SAGRADO ATIVADO!**\nSua sorte agora está em **${luck}%** para cartas raras.`
        );
      }
      
      // ======================================================
      // 🔥 2. RITUAL CORRUPTO — risco alto, recompensa insana
      // ======================================================
      if (type === "corrupto") {
        const roll = altarJackpotRoll(user);
        if (roll.jackpot) {
          resetSummonLuck(user);
          return message.reply(
            `💀🔥 **RITUAL CORRUPTO — JACKPOT ABSOLUTO!**\nVocê ganhou uma carta **LENDÁRIA** automática:\n${roll.card}`
          );
        }
        
        return message.reply(
          `💀 Ritual corrupto falhou… você perdeu **5% de sorte!**\nSorte atual: ${getSummonLuck(user)}%`
        );
      }
      
      // ======================================================
      // 🔮 3. INVOCAR CARTAS NORMAIS (gold, gems, coupons)
      // ======================================================
      const MAX_SUMMON = 10;
      let count = parseInt(args[1]) || 1;
      if (count < 1) count = 1;
      if (count > MAX_SUMMON) count = MAX_SUMMON;
      
      // Chamada do summon múltiplo
      const result = count === 1 ?
        [summonCard(user, type)] :
        summonMultiple(user, type, count).split("\n");
      
      // Separar mensagens de cartas e estatísticas
      let messages = [];
      let statsIndex = result.findIndex(r => r.startsWith("📊 Estatísticas:"));
      let cardsList = statsIndex >= 0 ? result.slice(0, statsIndex) : result;
      let statsLine = statsIndex >= 0 ? result[statsIndex] : "";
      
      // Montar mensagem profissional
      messages.push(`🔮 **Invocação usando ${type.toUpperCase()} (x${count})**`);
      messages.push(`🎲 Sorte atual: ${getSummonLuck(user)}%`);
      messages.push("");
      messages.push("📜 **Cartas Recebidas:**");
      cardsList.forEach(line => messages.push(`- ${line}`));
      if (statsLine) messages.push(statsLine);
      
      return message.reply(messages.join("\n"));
    } catch (err) {
      console.error("❌ Erro no comando Altar:", err);
      return message.reply(err instanceof Error ? `⚠️ ${err.message}` : "⚠️ Erro inesperado.");
    }
  }
};