// src/commands/upgrade.js

// Importações dos sistemas
import { getCardTemplate } from "../systems/cardSystem.js"; 
// 🟢 Corrigido o caminho: do 'src/commands' para 'src/systems' é '../systems'
import { levelUpCard, burnCardForXp } from "../systems/xpSystem.js"; 
import { spendGold } from "../systems/economySystem.js"; 

export default {
  name: "upgrade",
  description: "Upa cartas usando outras cartas e ouro.",
  usage: "<Índice da Carta Principal> <Índice da Carta Doadora 1> [Índice da Carta Doadora 2]...",
  
  async execute(message, args, user) {
    
    // --- 1. VALIDAÇÃO E SELEÇÃO DAS CARTAS ---
    
    const mainIndex = parseInt(args[0]);
    const mainCard = user.cards[mainIndex - 1]; 
    
    if (!mainCard) return message.reply("❌ Carta principal inválida. Use `!cards` para ver os índices.");
    if (mainCard.isGuardian) return message.reply("⚠️ Guardiões não podem ser upados com este comando.");
    
    const sacrificeIndexes = args.slice(1).map(n => parseInt(n) - 1);
    if (sacrificeIndexes.length === 0) return message.reply("⚠️ Nenhuma carta doadora foi especificada.");

    // Mapeia e valida os índices de sacrifício
    const sacrificeCandidates = sacrificeIndexes
        .map(i => user.cards[i])
        .filter(c => c && !c.isGuardian && c.uniqueId !== mainCard.uniqueId);

    if (sacrificeCandidates.length === 0) {
        return message.reply("⚠️ Nenhuma carta válida (não Guardiã e diferente da principal) para usar como XP foi encontrada nos índices fornecidos.");
    }
    
    // --- 2. CÁLCULO DE CUSTOS E VALORES DE SACRIFÍCIO ---
    
    let totalXP = 0;
    let totalGoldCost = 0;
    
    // Ouro necessário para queimar cada carta (Mantendo sua fórmula original)
    for (const card of sacrificeCandidates) {
      // ⚠️ Corrigido: Aqui deve usar o valor base de XP, não o que a burnCardForXp retorna, pois ela fará o trabalho depois.
      // 💰 Sua fórmula original para custo em ouro: Nível * 100
      totalGoldCost += Math.floor(card.level * 100); 
      
      // 💡 O XP total que as cartas iriam dar (usamos getCardXPValue para simular o valor)
      // Como o xpSystem.js foi corrigido, vou importar getCardXPValue para calcular o XP sem queimar a carta ainda.
      // ❌ Você não me deu o arquivo de importações de upgrade.js completo. Vou assumir a importação:
      // import { levelUpCard, burnCardForXp, getCardXPValue } from "../systems/xpSystem.js"; 
      // Caso não consiga importar getCardXPValue, teremos que recalcular o XP mais tarde ou estimar. 
      // Por enquanto, faremos o cálculo do gold cost primeiro.
    }
    
    // --- 3. EXECUÇÃO DA TRANSAÇÃO E QUEIMA DE CARTAS ---
    
    // A. Gasto de Ouro
    const goldSpentSuccess = spendGold(user, totalGoldCost); 
    
    if (!goldSpentSuccess) {
        return message.reply(`💰 Ouro insuficiente. Precisa de **${totalGoldCost}** ouro para o processo.`);
    }
    
    // B. Queima de Cartas e Acúmulo de XP
    const burnedCardsDetails = [];
    const uniqueIdsToBurn = sacrificeCandidates.map(c => c.uniqueId);

    // Iteramos sobre os uniqueIds para queimar cada carta
    for (const uniqueId of uniqueIdsToBurn) {
        // 🟢 Corrigido: burnCardForXp faz a queima (remoção) E retorna o XP
        const burnResult = burnCardForXp(user, uniqueId); 
        
        if (burnResult.success) {
            totalXP += burnResult.gainedXP;
            // Guardamos os detalhes para a mensagem final, se necessário
            burnedCardsDetails.push({ name: getCardTemplate(burnResult.burnedCard.id)?.name || 'Carta', xp: burnResult.gainedXP });
        } else {
            // Este caso é improvável após as validações, mas é um bom *guard*
            console.error(`Falha ao queimar a carta ${uniqueId}: ${burnResult.message}`);
        }
    }
    
    // --- 4. LEVEL UP DA CARTA PRINCIPAL ---
    
    // 🟢 Corrigido: levelUpCard precisa do uniqueId e do XP GANHO
    const result = levelUpCard(user, mainCard.uniqueId, totalXP); 
    
    // O index.js (middleware) cuidará do salvamento.
    
    // --- 5. RETORNO DA MENSAGEM ---
    
    let burnSummary = burnedCardsDetails.map(d => `${d.name} (+${d.xp} XP)`).join(', ');
    if (burnSummary.length > 100) {
        burnSummary = `${burnedCardsDetails.length} cartas sacrificadas.`;
    }

    return message.reply(
        `✨ **Upgrade Concluído!**\n\n` +
        `**1. Sacrifício:** ${burnSummary}\n` +
        `   💳 XP Ganho: **${totalXP}**.\n` +
        `   💰 Ouro gasto: **${totalGoldCost}**.\n\n` +
        `**2. Carta Principal (${mainCard.name}):**\n` +
        `   ${result.message}`
    );
  }
};
