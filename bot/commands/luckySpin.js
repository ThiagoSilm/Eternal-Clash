// src/commands/luckyspin.js
import { EmbedBuilder } from "discord.js";
import { spinLucky } from "../../src/systems/luckySpinSystem.js";

export default {
  name: "luckyspin",
  description: "Gira a roda da sorte por 100 gemas. Cada 10 giros pagos dão 1 giro especial grátis.",
  usage: "[spin [quantidade] | status]",

  async execute(message, args, user) {
    if (!user.luckySpin) user.luckySpin = { spins: 0, freeSpins: 0 };

    let sub = (args[0] || "spin").toLowerCase();
    if (!isNaN(parseInt(sub))) { args.unshift("spin"); sub = "spin"; }

    // ------------------------------
    // STATUS
    // ------------------------------
    if (sub === "status") {
      const embed = new EmbedBuilder()
        .setTitle("🎯 Status da Roda da Sorte")
        .setColor("Yellow")
        .addFields(
          { name: "🔄 Giros pagos", value: `${user.luckySpin.spins}` },
          { name: "✨ Giros grátis", value: `${user.luckySpin.freeSpins}` },
          { name: "📊 Próximo Mega Spin", value: `${10 - (user.luckySpin.spins % 10)}/10` }
        );
      return message.reply({ embeds: [embed] });
    }

    // ------------------------------
    // SPIN
    // ------------------------------
    if (sub === "spin") {
      const count = Math.min(parseInt(args[1]) || 1, 10);
      if (count < 1) return message.reply("❌ Quantidade inválida.");

      const results = [];
      let freeUsed = 0;

      // Spins pagos
      for (let i = 0; i < count; i++) {
        const res = spinLucky(user, false);
        results.push(res);
      }

      // Spins grátis
      while (user.luckySpin.freeSpins > 0) {
        user.luckySpin.freeSpins--;
        const freeRes = spinLucky(user, true);
        results.push({ ...freeRes, msg: `✨ [GRÁTIS] ${freeRes.msg}` });
        freeUsed++;
      }

      // Agrupa resultados por raridade
      const grouped = { common: [], rare: [], legendary: [] };
      for (const r of results) grouped[r.rarity].push(r.msg);

      const embed = new EmbedBuilder()
        .setTitle(`🎰 Lucky Spin — ${count} giro(s)`)
        .setColor("Blue")
        .addFields(
          { name: "🔹 Comum", value: grouped.common.join("\n") || "Nenhum", inline: true },
          { name: "💜 Raro", value: grouped.rare.join("\n") || "Nenhum", inline: true },
          { name: "💛 Lendário", value: grouped.legendary.join("\n") || "Nenhum", inline: true },
          { name: "📊 Próximo Mega Spin", value: `${10 - (user.luckySpin.spins % 10)}/10`, inline: true },
          { name: "✨ Giros grátis usados", value: `${freeUsed}`, inline: true }
        );

      return message.reply({ embeds: [embed] });
    }

    // ------------------------------
    // SUBCOMANDO INVÁLIDO
    // ------------------------------
    return message.reply(
      "❌ Subcomando inválido.\n" +
      "`!luckyspin` — 1 giro\n" +
      "`!luckyspin 5` — 5 giros\n" +
      "`!luckyspin status` — ver status"
    );
  }
};