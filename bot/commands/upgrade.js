import { EmbedBuilder } from "discord.js";
import { getCardTemplate } from "../../src/systems/cardSystem.js";
import { levelUpCard, burnCardForXp, getCardNextLevelXP } from "../../src/systems/xpSystem.js";
import { spendGold } from "../../src/systems/economySystem.js";

export default {
  name: "upgrade",
  description: "Upa uma carta usando outras cartas como sacrifício.",
  usage: "<carta_principal> <carta_doadora_1> [carta_doadora_2 ...]",

  async execute(message, args, user) {
    if (!user.cards || user.cards.length === 0) return message.reply("📭 Você não possui cartas.");
    if (args.length < 2) return message.reply("❌ Use: `!upgrade <principal> <doadora1> <doadora2> ...`");

    const mainIndex = parseInt(args[0]);
    if (isNaN(mainIndex) || mainIndex < 1 || mainIndex > user.cards.length)
      return message.reply("❌ Índice da carta principal inválido.");

    const mainCard = user.cards[mainIndex - 1];
    if (!mainCard) return message.reply("❌ Carta principal não encontrada.");
    if (mainCard.isGuardian) return message.reply("⚠️ Guardiões não podem ser upados.");

    const previousLevel = mainCard.level;
    const previousXP = mainCard.xp || 0;

    // ------------------------------
    // Seleção das cartas sacrificadas
    // ------------------------------
    const sacrificeIndexes = args.slice(1).map(n => parseInt(n) - 1);
    const ignoredCards = [];
    const sacrificeCards = [];

    for (const i of sacrificeIndexes) {
      const card = user.cards[i];
      if (!card) continue;
      if (card.uniqueId === mainCard.uniqueId) {
        ignoredCards.push(`${card.name} (principal)`);
        continue;
      }
      if (card.isGuardian) {
        ignoredCards.push(`${card.name} (guardião)`);
        continue;
      }
      sacrificeCards.push(card);
    }

    if (sacrificeCards.length === 0) return message.reply("⚠️ Nenhuma carta válida para sacrifício foi encontrada.");

    // ------------------------------
    // Cálculo de custo em ouro
    // ------------------------------
    let totalGoldCost = 0;
    for (const card of sacrificeCards) totalGoldCost += Math.floor(card.level ** 1.5 * 50);
    if (!spendGold(user, totalGoldCost))
      return message.reply(`💰 Ouro insuficiente. Precisa de **${totalGoldCost}**.`);

    // ------------------------------
    // Queimar cartas e calcular XP
    // ------------------------------
    const burnDetails = [];
    let totalXP = 0;
    for (const card of sacrificeCards) {
      const burnResult = burnCardForXp(user, card.uniqueId);
      if (!burnResult.success) continue;
      totalXP += burnResult.gainedXP;
      const template = getCardTemplate(card.id);
      burnDetails.push({ name: `${template?.name || "Carta"} (Lv.${card.level})`, xp: burnResult.gainedXP });
    }

    if (burnDetails.length === 0) return message.reply("⚠️ Nenhuma carta pôde ser sacrificada.");

    // ------------------------------
    // Level up da carta principal
    // ------------------------------
    const levelUpResult = levelUpCard(user, mainCard.uniqueId, totalXP);
    const newLevel = mainCard.level;
    const currentXP = mainCard.xp || 0;
    const nextLevelXP = getCardNextLevelXP(mainCard);

    // Barra visual de XP
    const barLength = 20;
    const progress = Math.min(currentXP / nextLevelXP, 1);
    const filledBars = Math.round(barLength * progress);
    const emptyBars = barLength - filledBars;
    const xpBar = `\`${"█".repeat(filledBars)}${"-".repeat(emptyBars)}\` ${Math.floor(progress * 100)}%`;

    // ------------------------------
    // Embed de resultado
    // ------------------------------
    let burnSummary = burnDetails.map(b => `${b.name} (+${b.xp} XP)`).join("\n");
    if (burnSummary.length > 1024) burnSummary = `${burnDetails.length} cartas sacrificadas`;

    const embed = new EmbedBuilder()
      .setTitle("✨ Upgrade Concluído")
      .setColor("Gold")
      .addFields(
        { name: "Carta Principal", value: mainCard.name, inline: true },
        { name: "Nível", value: `${previousLevel} → ${newLevel}`, inline: true },
        { name: "XP Atual", value: xpBar, inline: false },
        { name: "XP Ganho", value: `${totalXP}`, inline: true },
        { name: "Ouro Gasto", value: `${totalGoldCost}`, inline: true },
        { name: "Sacrifício", value: burnSummary, inline: false }
      )
      .setFooter({ text: ignoredCards.length > 0 ? `Cartas ignoradas: ${ignoredCards.join(", ")}` : "" });

    return message.reply({ embeds: [embed] });
  }
};