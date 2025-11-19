// src/commands/altar.js

import {
  summonCard,
  summonMultiple,
  getSummonLuck,
  increaseSummonLuck,
  resetSummonLuck,
  altarJackpotRoll,
  summonCosts,
  spendCurrency
} from "../../src/systems/summonSystem.js";

// Função helper para delay
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Cores por raridade (pode usar se mandar embed)
const rarityEmojis = {
  1: "⚪",
  2: "🟢",
  3: "🔵",
  4: "🟣",
  5: "✨🌟"
};

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
      // 🔮 Ritual Sagrado
      if (type === "sagrado") {
        const luck = increaseSummonLuck(user, 20);
        return message.reply(
          `✨ **RITUAL SAGRADO ATIVADO!**\nSua sorte agora está em **${luck}%** para cartas raras.`
        );
      }
      
      // 🔥 Ritual Corrupto
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
      
      // 🔮 Invocar cartas normais
      const MAX_SUMMON = 10;
      let count = parseInt(args[1]) || 1;
      if (count < 1) count = 1;
      if (count > MAX_SUMMON) count = MAX_SUMMON;
      
      // ---------- VALIDAÇÃO DE MOEDA ----------
      const costSingle = summonCosts[type]?.single || 0;
      const costMulti = summonCosts[type]?.multi || costSingle * count;
      const totalCost = count > 1 ? costMulti : costSingle;
      
      if (!spendCurrency(user, type, totalCost)) {
        return message.reply(`💰 Você não tem moedas suficientes para invocar ${count} carta(s).`);
      }
      
      // ---------- Invocação com suspense ----------
      let summonResults = count === 1 ? [summonCard(user, type)] : summonMultiple(user, type, count).split("\n");
      let revealedCards = [];
      
      // Mensagem inicial
      const sentMessage = await message.reply(`🔮 Invocando ${count} carta(s) com ${type.toUpperCase()}... 🎴`);
      
      for (let i = 0; i < summonResults.length; i++) {
        // suspense antes de revelar cada carta
        await sleep(600 + Math.random() * 400); // 0.6s a 1s de delay
        
        // Pegar linha da carta
        const line = summonResults[i].replace(/^-\s*/, ""); // remove traço se houver
        revealedCards.push(`- ${line}`);
        
        // Atualizar mensagem com cartas reveladas até agora
        await sentMessage.edit(
          `🔮 Invocando ${count} carta(s) com ${type.toUpperCase()}... 🎴\n` +
          `🎲 Sorte atual: ${getSummonLuck(user)}%\n\n` +
          `📜 **Cartas Reveladas:**\n${revealedCards.join("\n")}`
        );
      }
      
      // Adicionar estatísticas no final
      const statsLine = summonResults.find(r => r.startsWith("📊 Estatísticas:"));
      if (statsLine) {
        await sentMessage.edit(
          sentMessage.content + `\n${statsLine}`
        );
      }
      
      return;
    } catch (err) {
      console.error("❌ Erro no comando Altar:", err);
      return message.reply(err instanceof Error ? `⚠️ ${err.message}` : "⚠️ Erro inesperado.");
    }
  }
};