// src/commands/events.js

import { claimDaily, getDailyStatus } from "../../src/systems/dailySystem.js";
import { EmbedBuilder } from "discord.js";

export default {
  name: "events",
  description: "Eventos diários com slot machine cinematográfico ultra épico.",
  usage: "[login | status | sorteio]",

  async execute(message, args, user) {
    if (!user) return message.reply("❌ Erro interno: usuário não carregado.");

    const sub = (args[0] || "").toLowerCase();

    const prizes = [
      { name: "50 moedas", rarity: "Comum", color: "Grey", emoji: "⚪" },
      { name: "5 gemas", rarity: "Raro", color: "Blue", emoji: "🔵" },
      { name: "Carta rara", rarity: "Épico", color: "Purple", emoji: "🟣" },
      { name: "100 moedas", rarity: "Comum", color: "Grey", emoji: "⚪" },
      { name: "Carta lendária", rarity: "Lendário", color: "Gold", emoji: "🟡" },
    ];

    function rollPrize() {
      const rand = Math.random();
      if (rand <= 0.05) return prizes.find(p => p.rarity === "Lendário");
      if (rand <= 0.20) return prizes.find(p => p.rarity === "Épico");
      if (rand <= 0.50) return prizes.find(p => p.rarity === "Raro");
      return prizes.find(p => p.rarity === "Comum");
    }

    try {
      let embed;

      switch (sub) {
        case "login":
          {
            const result = claimDaily(user); // { success: bool, message: string, streak: number }
            const streakEmojis = "⭐".repeat(result.streak) || "Nenhum";

            embed = new EmbedBuilder()
              .setTitle("🎁 Recompensa Diária")
              .setDescription(result.message)
              .addFields({ name: "🔥 Streak Atual", value: streakEmojis, inline: true })
              .setColor(result.success ? "Green" : "Grey")
              .setTimestamp();
          }
          break;

        case "status":
          {
            const status = getDailyStatus(user); // { daysCollected, totalDays, currentBonus, streak }
            const streakEmojis = "⭐".repeat(status.streak) || "Nenhum";

            embed = new EmbedBuilder()
              .setTitle("📊 Status Diário")
              .setColor("Blue")
              .setTimestamp()
              .addFields(
                { name: "Dias coletados", value: `${status.daysCollected}/${status.totalDays}`, inline: true },
                { name: "Bônus Atual", value: status.currentBonus || "Nenhum", inline: true },
                { name: "🔥 Streak", value: streakEmojis, inline: true }
              );
          }
          break;

        case "sorteio":
          {
            // Slot machine cinematográfico
            const lines = 5;
            const sequence = Array.from({ length: lines }, () => rollPrize());
            const suspenseMsg = await message.reply({ content: "🎰 Rodando a slot machine...", allowedMentions: { repliedUser: false } });

            // Função para atualizar mensagem a cada 0.5s
            let step = 0;
            const interval = setInterval(async () => {
              step++;
              const display = sequence.map(p => `${p.emoji} ${p.name}`).join(" → ") + " → ??";
              await suspenseMsg.edit({ content: `🎰 Rodando: ${display}` });

              // Atualiza cada linha individualmente para efeito de slot
              sequence.forEach((_, i) => {
                if (Math.random() > 0.5) sequence[i] = rollPrize();
              });

              if (step >= 6) { // total 6 passos = 3 segundos
                clearInterval(interval);
                const finalPrize = rollPrize();
                embed = new EmbedBuilder()
                  .setTitle("🎰 Sorteio Diário - Resultado Final")
                  .setDescription(`Você ganhou: **${finalPrize.name}**\nRaridade: **${finalPrize.rarity}** ${finalPrize.emoji}`)
                  .setColor(finalPrize.color)
                  .setTimestamp();
                await suspenseMsg.edit({ content: null, embeds: [embed] });
              }
            }, 500); // 0.5s por passo

            return;
          }

        default:
          embed = new EmbedBuilder()
            .setTitle("🎉 Comandos de Eventos")
            .setColor("Purple")
            .setDescription("Use os comandos abaixo para aproveitar os eventos diários:")
            .addFields(
              { name: "!events login", value: "Coleta sua recompensa diária", inline: false },
              { name: "!events status", value: "Mostra o progresso e bônus diário", inline: false },
              { name: "!events sorteio", value: "Roda a sorte diária estilo slot machine cinematográfico", inline: false }
            )
            .setFooter({ text: "Volte todos os dias para receber recompensas!" })
            .setTimestamp();
          break;
      }

      if (embed) await message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });

    } catch (err) {
      console.error("❌ Erro no comando events:", err);
      return message.reply("⚠️ Erro interno ao processar o evento.");
    }
  },
};