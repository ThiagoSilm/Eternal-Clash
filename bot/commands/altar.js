// src/commands/altar.js

import {
  summonMultiple,
  summonGuardian,
  getSummonLuck,
  increaseSummonLuck,
  resetSummonLuck,
  altarJackpotRoll,
  summonCosts
} from "../../src/systems/summonSystem.js";

import { spendCurrency } from "../../src/systems/economySystem.js";

// --- Configurações ---
const MULTI_SUMMON_THRESHOLD = 5;
const MAX_SUMMON = 10;
const SLOW_ROLL_DELAY_MS = 600;

// Tipos válidos para o comando
const VALID_TYPES = ["gold", "gems", "coupons", "guardian", "sagrado", "corrupto"];

// Função helper para delay
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Calcula o custo total e valida a contagem.
 * @param {string} type O tipo de invocação (gold, gems, coupons).
 * @param {number} count O número de invocações.
 * @returns {{count: number, totalCost: number, currencyName: string} | null} Objeto com os detalhes do custo ou null se o tipo não for de invocação de cartas.
 */
function calculateCost(type, count) {
  const costConfig = summonCosts[type];

  if (!costConfig) {
    return null; // Não é um tipo de invocação de cartas (ex: guardian, sagrado)
  }

  // 1. Sanitizar a contagem
  const finalCount = Math.min(Math.max(1, count), MAX_SUMMON);
  const currencyName = type;

  // 2. Calcular o custo
  let totalCost;

  if (finalCount >= MULTI_SUMMON_THRESHOLD) {
    // Custo base para o pacote (5)
    totalCost = costConfig.multi; 
    
    // Custo individual para invocações extras (ex: 6-10)
    const extraSummons = finalCount - MULTI_SUMMON_THRESHOLD;
    if (extraSummons > 0) {
      totalCost += extraSummons * costConfig.single;
    }
  } else {
    // Custo individual (1-4)
    totalCost = costConfig.single * finalCount;
  }
  
  return { count: finalCount, totalCost, currencyName };
}

/**
 * Lida com a invocação lenta (slow roll) e edita a mensagem.
 * @param {object} message O objeto de mensagem do Discord.
 * @param {string[]} summonResults O array de linhas de resultado do summonMultiple.
 * @param {{count: number, totalCost: number, currencyName: string}} costDetails Os detalhes do custo.
 * @param {object} user O objeto do usuário.
 */
async function handleSlowRoll(message, summonResults, costDetails, user) {
  const { count, totalCost, currencyName } = costDetails;
  
  // Mensagem inicial
  const sentMessage = await message.reply(
    `🔮 Invocando ${count} carta(s) com **${currencyName.toUpperCase()}** (Custo total: ${totalCost} ${currencyName})... 🎴`
  );

  let revealedCards = [];
  
  // Separar resultados das estatísticas
  const cardLines = summonResults.filter(
    line => line && !line.startsWith("💰") && !line.startsWith("📊")
  );
  const statsLine = summonResults.find(r => r.startsWith("📊"));

  // Invocação com suspense
  for (let i = 0; i < cardLines.length; i++) {
    const line = cardLines[i];
    
    await sleep(SLOW_ROLL_DELAY_MS + Math.random() * 400); 
    
    // Garantir o formato da lista
    revealedCards.push(`- ${line.replace(/^-\s*/, "")}`);
    
    await sentMessage.edit(
      `🔮 Invocando ${count} carta(s) com **${currencyName.toUpperCase()}**... 🎴\n` +
      `🎲 Sorte atual: **${getSummonLuck(user)}%**\n\n` +
      `📜 **Cartas Reveladas (${revealedCards.length}/${count}):**\n${revealedCards.join("\n")}`
    );
  }
  
  // Adicionar estatísticas no final
  if (statsLine) {
    await sentMessage.edit(sentMessage.content + `\n${statsLine}`);
  }
}

// --- Comando Principal ---

export default {
  name: "altar",
  description: "Invoca cartas, guardiões e usa rituais especiais.",
  usage: "!altar <gold|gems|coupons|guardian|sagrado|corrupto> [quantidade]",
  
  async execute(message, args, user) {
    const type = (args[0] || "").toLowerCase();
    
    if (!VALID_TYPES.includes(type)) {
      return message.reply(
        "❌ **Tipo inválido.**\nTipos válidos: `" + VALID_TYPES.join("`, `") + "`."
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
        
        // Falha no Ritual
        increaseSummonLuck(user, -5); // Diminuir 5%
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
      
      const count = parseInt(args[1]) || 1;
      const costDetails = calculateCost(type, count);
      
      if (!costDetails) {
          // Já validado, mas é um bom guard-clause
          return message.reply("💰 Tipo de invocação de carta não configurado.");
      }
      
      const { finalCount, totalCost, currencyName } = costDetails;

      // ---------- VALIDAÇÃO E GASTO DE MOEDA ----------
      if (!spendCurrency(user, currencyName, totalCost)) {
        return message.reply(
          `💰 Você não tem **${totalCost} ${currencyName}** suficiente(s) para invocar ${finalCount} carta(s).`
        );
      }
      
      // ---------- EXECUÇÃO DA INVOCAÇÃO ----------
      // Chamamos `summonMultiple` sem custo, pois já foi gasto acima.
      const summonResults = summonMultiple(user, type, finalCount, { skipCost: true }).split("\n");
      
      // Lida com o slow roll e a edição da mensagem
      await handleSlowRoll(message, summonResults, costDetails, user);
      
      return; // Finaliza o comando
      
    } catch (err) {
      console.error("❌ Erro no comando Altar:", err);
      return message.reply(err instanceof Error ? `⚠️ Erro inesperado: ${err.message}` : "⚠️ Erro inesperado.");
    }
  }
};
