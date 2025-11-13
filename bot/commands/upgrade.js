// src/commands/upgrade.js

// -----------------------------
// 📦 IMPORTAÇÕES CORRETAS
// -----------------------------

import { getCardTemplate } from "../../src/systems/cardSystem.js";
import {
    levelUpCard,
    burnCardForXp,
    getCardXPValue
} from "../systems/xpSystem.js";
import { spendGold } from "../systems/economySystem.js";

export default {
    name: "upgrade",
    description: "Upa uma carta usando outras cartas como sacrifício.",
    usage: "<carta_principal> <carta_doadora_1> [carta_doadora_2 ...]",
    
    async execute(message, args, user) {
        
        // -------------------------------------------------------
        // 1. VALIDAÇÕES GERAIS
        // -------------------------------------------------------
        if (!user.cards || user.cards.length === 0) {
            return message.reply("📭 Você não possui cartas.");
        }
        
        if (args.length < 2) {
            return message.reply("❌ Use: `!upgrade <principal> <doadora1> <doadora2> ...`");
        }
        
        const mainIndex = parseInt(args[0]);
        const mainCard = user.cards[mainIndex - 1];
        
        if (!mainCard) {
            return message.reply("❌ Índice da carta principal inválido.");
        }
        
        if (mainCard.isGuardian) {
            return message.reply("⚠️ Guardiões não podem ser upados.");
        }
        
        // -------------------------------------------------------
        // 2. SELEÇÃO DAS CARTAS SACRIFICADAS
        // -------------------------------------------------------
        
        const sacrificeIndexes = args.slice(1).map(n => parseInt(n) - 1);
        
        const sacrificeCards = sacrificeIndexes
            .map(i => user.cards[i])
            .filter(c => c && !c.isGuardian && c.uniqueId !== mainCard.uniqueId);
        
        if (sacrificeCards.length === 0) {
            return message.reply("⚠️ Nenhuma carta válida para sacrifício foi encontrada.");
        }
        
        // -------------------------------------------------------
        // 3. CÁLCULO DO CUSTO EM OURO E XP TOTAL
        // -------------------------------------------------------
        
        let totalGoldCost = 0;
        let totalXP = 0;
        
        for (const card of sacrificeCards) {
            totalGoldCost += Math.floor(card.level * 100);
            totalXP += getCardXPValue(card);
        }
        
        // -------------------------------------------------------
        // 4. COBRAR OURO
        // -------------------------------------------------------
        
        const goldSuccess = spendGold(user, totalGoldCost);
        
        if (!goldSuccess) {
            return message.reply(`💰 Ouro insuficiente. Precisa de **${totalGoldCost}**.`);
        }
        
        // -------------------------------------------------------
        // 5. QUEIMAR AS CARTAS E GERAR XP
        // -------------------------------------------------------
        
        const burnDetails = [];
        
        for (const card of sacrificeCards) {
            const burnResult = burnCardForXp(user, card.uniqueId);
            
            if (!burnResult.success) continue;
            
            const template = getCardTemplate(card.id);
            burnDetails.push({
                name: template?.name || "Carta",
                xp: burnResult.gainedXP
            });
        }
        
        // -------------------------------------------------------
        // 6. LEVEL UP DA CARTA PRINCIPAL
        // -------------------------------------------------------
        
        const levelUpResult = levelUpCard(user, mainCard.uniqueId, totalXP);
        
        // -------------------------------------------------------
        // 7. RESPOSTA AO USUÁRIO
        // -------------------------------------------------------
        
        let burnSummary = burnDetails
            .map(b => `${b.name} (+${b.xp} XP)`)
            .join(", ");
        
        if (burnSummary.length > 100) {
            burnSummary = `${burnDetails.length} cartas sacrificadas`;
        }
        
        return message.reply(
            `✨ **UPGRADE CONCLUÍDO**\n\n` +
            `🔥 **Sacrifício:** ${burnSummary}\n` +
            `📈 XP Ganho: **${totalXP}**\n` +
            `💰 Ouro gasto: **${totalGoldCost}**\n\n` +
            `🂠 **${mainCard.name}:**\n${levelUpResult.message}`
        );
    }
};