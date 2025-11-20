// src/commands/altar.js
import {
  summonMultiple,
  summonGuardian,
  getSummonLuck,
  increaseSummonLuck,
  resetSummonLuck,
  altarJackpotRoll,
  summonCosts
} from '../../src/systems/summonSystem.js';

import { spendCurrency } from '../../src/systems/economySystem.js';

export default {
  name: 'altar',
  description: 'Invoca cartas, guardiões e usa rituais especiais.',
  usage: '!altar <gold|gems|coupons|guardian|sagrado|corrupto> [quantidade]',
  async execute(message, args, user) {
    // --- Configurações ---
    const MULTI_SUMMON_THRESHOLD = 5;
    const MAX_SUMMON = 10;
    const SLOW_ROLL_DELAY_MS = 600;

    // Tipos válidos para o comando
    const VALID_TYPES = ['gold', 'gems', 'coupons', 'guardian', 'sagrado', 'corrupto'];

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
      const {
        count,
        totalCost,
        currencyName
      } = costDetails;

      // Mensagem inicial
      const sentMessage = await message.reply(
        `🔮 Invocando ${count} carta(s) com **${currencyName.toUpperCase()}** (Custo total: ${totalCost} ${currencyName})`
      );

      let revealedCards = [];

      // Separar resultados das estatísticas
      const cardLines = summonResults.filter(
        line => line && !line.startsWith('💰') && !line.startsWith('📊')
      );
      const statsLine = summonResults.find(r => r.startsWith('📊'));

      // Invocação com suspense
      for (let i = 0; i < cardLines.length; i++) {
        const line = cardLines[i];
        await sleep(SLOW_ROLL_DELAY_MS + Math.random() * 400); // Adiciona um pouco de aleatoriedade no delay

        // Garantir o formato da lista
        revealedCards.push(`- ${line.replace(/^-\s*/, '')}`);
        await sentMessage.edit(
          `🔮 Invocando ${count} carta(s) com **${currencyName.toUpperCase()}**... 🎴\n` +
          `✨ Sorte atual: **${getSummonLuck(user)}%**\n\n` +
          `📜 **Cartas Reveladas (${revealedCards.length}/${count}):**\n${revealedCards.join('\n')}`
        );
      }

      // Adicionar a linha final de estatísticas se existir
      if (statsLine) {
        await sentMessage.edit(sentMessage.content + `\n${statsLine}`);
      }
    }


    // -------------------------------------------------
    // Lógica Principal da Função Execute
    // -------------------------------------------------
    const type = args[0] ? args[0].toLowerCase() : null;
    let count = args[1] ? parseInt(args[1], 10) : 1;

    if (!type || !VALID_TYPES.includes(type)) {
      return message.reply(`Uso inválido. Tipos permitidos: ${VALID_TYPES.join(', ')}.\nUso correto: \`${this.usage}\``);
    }

    // --- Tratamento para invocações de cartas (gold, gems, coupons) ---
    const costDetails = calculateCost(type, count);

    if (costDetails) {
      const {
        finalCount, // Não é mais finalCount, mas count dentro de costDetails
        totalCost,
        currencyName
      } = costDetails; // Desestruturar novamente para usar os nomes corretos

      // Verificar se o usuário tem saldo suficiente (função dummy, você deve ter a sua implementada)
      // if (user[currencyName] < totalCost) {
      //     return message.reply(`Você não tem ${totalCost} ${currencyName} suficientes para esta invocação!`);
      // }

      try {
        // Deduzir o custo do usuário (implemente esta função no seu economySystem)
        // await spendCurrency(user, currencyName, totalCost);

        // Realizar a invocação em massa
        const summonResults = await summonMultiple(user, finalCount, type);

        // Se for apenas uma invocação, usar o slow roll para suspense
        if (finalCount === 1) {
          await handleSlowRoll(message, summonResults, costDetails, user);
        } else {
          // Para múltiplos (2 a 10), enviar o resultado completo de uma vez
          const luckInfo = `✨ Sorte atual: **${getSummonLuck(user)}%**`;
          const resultsMessage = `🔮 Você invocou ${finalCount} carta(s) com **${currencyName.toUpperCase()}** (Custo: ${totalCost} ${currencyName}).\n${luckInfo}\n\n📜 **Resultados:**\n${summonResults.join('\n')}`;
          await message.reply(resultsMessage);
        }

        // Lançar o jackpot (se a função altarJackpotRoll existir e fizer sentido aqui)
        // altarJackpotRoll(user, message);

      } catch (error) {
        console.error(`Erro ao processar invocação de ${type}:`, error);
        await message.reply('Ocorreu um erro ao tentar realizar sua invocação. Por favor, tente novamente mais tarde.');
      }
      return; // Finaliza a execução aqui para tipos de cartas
    }

    // --- Tratamento para outros tipos (guardian, sagrado, corrupto) ---
    switch (type) {
      case 'guardian':
        // Lógica para invocar guardião
        // await summonGuardian(user, message);
        await message.reply('A invocação de guardião ainda não está totalmente implementada.');
        break;
      case 'sagrado':
      case 'corrupto':
        // Lógica para rituais sagrados/corruptos
        await message.reply(`O ritual ${type} ainda não está totalmente implementado.`);
        break;
      default:
        // Caso que não deveria acontecer devido à verificação inicial, mas é um fallback seguro
        await message.reply('Tipo de invocação inválido.');
    }
  },
};
