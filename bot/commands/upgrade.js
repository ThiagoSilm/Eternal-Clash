// src/commands/upgrade.js

// Importações dos sistemas
import { getCardTemplate } from "../../src/systems/cardSystem.js";
import { levelUpCard, burnCardForXP } from "../../src/systems/xpSystem.js";
import { spendGold } from "../../src/systems/economySystem.js"; // Assume-se que existe spendGold

export default {
  name: "upgrade",
  description: "Upa cartas usando outras cartas e ouro.",
  usage: "<Índice da Carta Principal> <Índice da Carta Doadora 1> [Índice da Carta Doadora 2]...",
  
  async execute(message, args, user) {
    // ... (Lógica de validação de índices e cartas é mantida) ...
    
    const mainIndex = parseInt(args[0]);
    const mainCard = user.cards[mainIndex - 1]; 
    if (!mainCard) return message.reply("❌ Carta principal inválida.");
    if (mainCard.isGuardian) return message.reply("⚠️ Guardiões não podem ser upados com este comando.");
    
    const sacrificeIndexes = args.slice(1).map(n => parseInt(n) - 1);
    if (sacrificeIndexes.length === 0) return message.reply("⚠️ Nenhuma carta doadora foi especificada.");

    const validSacrificeIndexes = sacrificeIndexes.filter(i => 
        i >= 0 && i < user.cards.length && i !== (mainIndex - 1)
    );
    
    const sacrifices = validSacrificeIndexes
      .map(i => user.cards[i])
      .filter(c => c && !c.isGuardian);
      
    if (sacrifices.length === 0) return message.reply("⚠️ Nenhuma carta válida (não Guardiã) para usar como XP foi encontrada nos índices fornecidos.");
    
    let totalXP = 0;
    let totalGold = 0;
    
    // 1. Calcula XP e Custo de Ouro
    for (const card of sacrifices) {
      totalXP += burnCardForXP(card); 
      totalGold += Math.floor(card.level * 100); 
    }
    
    // 2. Tenta gastar o ouro usando o sistema
    const goldSpentSuccess = spendGold(user, totalGold); // ⚠️ Uso da função do sistema
    
    if (!goldSpentSuccess) {
        return message.reply(`💰 Ouro insuficiente. Precisa de ${totalGold} ouro.`);
    }
    
    // 3. Executa as modificações:
    
    // A. Remoção segura das cartas sacrificadas (Filtrando o array original)
    const sacrificedUniqueIds = new Set(sacrifices.map(c => c.uniqueId));
    user.cards = user.cards.filter(c => !sacrificedUniqueIds.has(c.uniqueId));
    
    // B. Gasto de Ouro (Já foi feito pela função spendGold, não é preciso subtrair user.gold aqui)
    
    // C. Adiciona XP à carta principal
    mainCard.xp = (mainCard.xp || 0) + totalXP;
    
    // D. Tenta upar a carta (levelUpCard deve ser capaz de encontrar a carta dentro do user)
    const result = levelUpCard(user, mainCard.uniqueId); 
    
    // O index.js (middleware) cuidará do salvamento.
    return message.reply(`✨ Upgrade concluído!\n${result.message}\n💳 XP Ganho: ${totalXP}. 💰 Ouro gasto: ${totalGold}.`);
  }
};
