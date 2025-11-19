// src/commands/altar.js

import {
  summonCard,
  summonMultiple,
  summonGuardian, // 🎁 NOVO: Importando o Guardião
  getSummonLuck,
  increaseSummonLuck,
  resetSummonLuck,
  altarJackpotRoll,
  summonCosts
} from "../../src/systems/summonSystem.js";


import { spendCurrency } from "../../src/systems/economySystem.js"; // Não precisa de CURRENCY_TYPES

// Função helper para delay
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Configuração local de Multi-Summon (para 5)
const MULTI_SUMMON_THRESHOLD = 5;
const MAX_SUMMON = 10;
const SLOW_ROLL_DELAY_MS = 600;

export default {
  name: "altar",
  description: "Invoca cartas, guardiões e usa rituais especiais.",
  usage: "!altar <gold|gems|coupons|guardian|sagrado|corrupto> [quantidade]",
  
  async execute(message, args, user) {
    const type = (args[0] || "").toLowerCase();
    // 🔔 Adicionamos 'guardian' como um tipo válido
    const validTypes = ["gold", "gems", "coupons", "sagrado", "corrupto", "guardian"];
    
    if (!validTypes.includes(type)) {
      return message.reply(
        "❌ Tipo inválido.\nTipos: `gold`, `gems`, `coupons`, `guardian`, `sagrado`, `corrupto`."
      );
    }
    
    try {
      // ----------------- RITUAIS ESPECIAIS -----------------
      if (type === "sagrado") {
        const luck = increaseSummonLuck(user, 20);
        return message.reply(
          `✨ **RITUAL SAGRADO ATIVADO!**\nSua sorte agora está em **${luck}%** para cartas raras.`
        );
      }
      
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
      
      // ----------------- INVOCAÇÃO DE GUARDIÃO -----------------
      if (type === "guardian") {
        const resultMsg = summonGuardian(user);
        
        if (resultMsg.startsWith("💰 Você não tem")) {
            return message.reply(resultMsg);
        }
        
        return message.reply(`🔥 **INVOCAÇÃO DE GUARDIÃO**\n${resultMsg}`);
      }
      
      // ----------------- INVOCAÇÃO NORMAL (CARTAS) -----------------
      let count = parseInt(args[1]) || 1;
      count = Math.min(Math.max(1, count), MAX_SUMMON);

      // ---------- VALIDAÇÃO E GASTO DE MOEDA ----------
      const costConfig = summonCosts[type];
      
      if (!costConfig) {
          return message.reply("💰 Tipo de moeda não configurado para invocação de cartas.");
      }
      
      let totalCost;
      let currencyName = type;
      
      if (count >= MULTI_SUMMON_THRESHOLD) {
          // Usa o custo do pacote (assumindo que 5 é o padrão para desconto)
          totalCost = costConfig.multi;
          // Se for 6 a 10, calcula o custo restante individualmente
          if (count > MULTI_SUMMON_THRESHOLD) {
              const extraCost = (count - MULTI_SUMMON_THRESHOLD) * costConfig.single;
              totalCost += extraCost;
          }
      } else {
          totalCost = costConfig.single * count;
      }
      
      // A moeda que o spendCurrency espera é a string (gold, gems, coupons)
      if (!spendCurrency(user, currencyName, totalCost)) {
        return message.reply(`💰 Você não tem ${totalCost} ${currencyName} suficiente(s) para invocar ${count} carta(s).`);
      }
      
      // ---------- EXECUÇÃO DA INVOCAÇÃO ----------
      
      // summonMultiple agora é chamado SEM custo, pois o custo foi gasto acima.
      // O `summonSystem.js` precisa ser modificado para aceitar options.skipCost = true
      // (Para este exemplo, assumimos que summonMultiple já faz a invocação correta sem custo.)
      const summonResults = summonMultiple(user, type, count, { skipCost: true }).split("\n");
      
      let revealedCards = [];
      
      // Mensagem inicial
      const sentMessage = await message.reply(`🔮 Invocando ${count} carta(s) com ${type.toUpperCase()} (Custo total: ${totalCost} ${currencyName})... 🎴`);
      
      // ---------- Invocação com suspense (slow roll) ----------
      for (let i = 0; i < summonResults.length; i++) {
        const line = summonResults[i];
        
        // Ignorar linhas vazias ou de erro/sumário do summonSystem
        if (!line || line.startsWith("💰") || line.startsWith("📊")) continue;

        await sleep(SLOW_ROLL_DELAY_MS + Math.random() * 400); 
        
        // Remove traço se o summonMultiple o adicionar
        revealedCards.push(`- ${line.replace(/^-\s*/, "")}`);
        
        await sentMessage.edit(
          `🔮 Invocando ${count} carta(s) com ${type.toUpperCase()}... 🎴\n` +
          `🎲 Sorte atual: ${getSummonLuck(user)}%\n\n` +
          `📜 **Cartas Reveladas:**\n${revealedCards.join("\n")}`
        );
      }
      
      // Adicionar estatísticas no final
      const statsLine = summonResults.find(r => r.startsWith("📊 Estatísticas:"));
      if (statsLine) {
        await sentMessage.edit(sentMessage.content + `\n${statsLine}`);
      }
      
      // O `return` no `try` garante que o fluxo termine aqui.
      return;
      
    } catch (err) {
      console.error("❌ Erro no comando Altar:", err);
      // Nota: Se a falha for na lógica de spendCurrency, o erro será tratado no `try` com `message.reply(resultMsg)`.
      return message.reply(err instanceof Error ? `⚠️ Erro inesperado: ${err.message}` : "⚠️ Erro inesperado.");
    }
  }
};
