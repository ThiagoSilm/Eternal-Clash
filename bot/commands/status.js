import { getEnergyStatus } from "../../src/systems/energySystem.js";
import { viewDeck } from "../../src/systems/inventorySystem.js";
import { getDailyStatus } from "../../src/systems/dailySystem.js";
import { EmbedBuilder } from "discord.js";

// Barra animada com degradê para XP
function createXPBar(current, max, size = 10) {
  const ratio = Math.min(current / max, 1);
  const filled = Math.round(ratio * size);
  const empty = size - filled;

  const gradient = ["🟥","🟧","🟨","🟩","🟦","🟪","✨"]; // degradê colorido
  let bar = "";
  for (let i = 0; i < filled; i++) {
    bar += gradient[i % gradient.length];
  }
  bar += "⬛".repeat(empty);
  return bar;
}

// Barra de energia animada
function createEnergyBar(current, max, size = 10) {
  const ratio = Math.min(current / max, 1);
  const filled = Math.round(ratio * size);
  const empty = size - filled;

  let bar = "";
  for (let i = 0; i < filled; i++) {
    bar += i % 2 === 0 ? "⚡" : "🔥"; // alterna emojis para efeito visual
  }
  bar += "⚪".repeat(empty);
  return bar + ` (${current}/${max})`;
}

// Formata deck com raridade e tipo
function formatDeck(deck) {
  if (!deck || deck.length === 0) return "Nenhuma carta no deck.";
  
  return deck.map((card, i) => {
    let rarityEmoji = "🟦"; // comum
    if (card.rarity === "raro") rarityEmoji = "🟪";
    else if (card.rarity === "épico") rarityEmoji = "🟧";
    else if (card.rarity === "lendário") rarityEmoji = "🟥";

    let typeEmoji = "⚔️"; // ataque
    if (card.type === "magia") typeEmoji = "🪄";
    else if (card.type === "defesa") typeEmoji = "🛡️";
    else if (card.type === "suporte") typeEmoji = "🩹";

    return `\`${i + 1}.\` ${rarityEmoji}${typeEmoji} **${card.name}**`;
  }).join("\n");
}

export default {
  name: "status",
  description: "Mostra HUD de RPG interativo do jogador.",
  usage: "[status]",

  async execute(message, args, user) {
    try {
      const userId = message.author.id;
      const username = message.author.username;

      // -----------------------
      // Energia
      // -----------------------
      let maxEnergy = 10;
      let energyStatus = "⚠️ Sistema de energia indisponível.";
      try {
        const energy = getEnergyStatus(userId) ?? 0;
        energyStatus = createEnergyBar(energy, maxEnergy);
      } catch {}

      // -----------------------
      // Status diário
      // -----------------------
      let dailyStatus = "⚠️ Sistema diário indisponível.";
      try {
        dailyStatus = getDailyStatus(userId) ?? "⚠️ (indefinido)";
      } catch {}

      // -----------------------
      // Deck
      // -----------------------
      let deckStatus = "Nenhuma carta no deck.";
      try {
        const deck = viewDeck(user, "main");
        deckStatus = formatDeck(deck);
      } catch {}

      // -----------------------
      // XP
      // -----------------------
      const level = user.level ?? 1;
      const currentXP = user.xp ?? 0;
      const xpForNext = 100 * level;
      const xpBar = createXPBar(currentXP, xpForNext);

      // -----------------------
      // Embed ultra HUD
      // -----------------------
      const embed = new EmbedBuilder()
        .setTitle(`🎮 HUD de ${username}`)
        .setDescription("💥 Status RPG interativo completo 💥")
        .addFields(
          { name: "📈 Nível", value: `${level}`, inline: true },
          { name: "⭐ XP", value: `${currentXP}/${xpForNext} ${xpBar}`, inline: false },
          { name: "💰 Ouro", value: `${user.gold ?? 0}`, inline: true },
          { name: "⚡ Energia", value: energyStatus, inline: false },
          { name: "🃏 Deck Principal", value: deckStatus, inline: false },
          { name: "🎁 Status Diário", value: dailyStatus, inline: false }
        )
        .setColor("#FFD700")
        .setFooter({ text: "✨ Continue evoluindo e colecionando!" })
        .setTimestamp();

      await message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });

    } catch (err) {
      console.error("❌ Erro no comando !status:", err);
      await message.reply("❌ Ocorreu um erro ao exibir seu status.");
    }
  }
};