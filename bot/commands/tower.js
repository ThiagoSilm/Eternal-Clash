// src/commands/tower.js
import {
  spendTowerAttempt,
  getTowerStatus,
  getFloorEnemy,
  getFloorReward,
  getTowerRankings,
  getRandomTowerEvent,
  addTemporaryGem,
  giveGuardianShard
} from "../../src/systems/towerSystem.js";

import { runBattle } from "../../src/systems/battleSystem.js";
import { addXP, addGold } from "../../src/systems/economySystem.js";
import { EmbedBuilder } from "discord.js";

export default {
  name: "tower",
  description: "Torre Infinita Épica: eventos, combos, histórias e prêmios lendários.",
  usage: "[status | challenge | rankings]",

  async execute(message, args, user) {
    try {
      console.log("🚀 Executando !tower", args, "User tower:", user.tower);

      if (!user.tower) user.tower = {
        floor: 1,
        attempts: 3,
        lastAccess: 0,
        winStreak: 0,
        tempGems: [],
        tokens: 0,
        towerShop: { lastReset: 0, items: [] }
      };

      const sub = args[0]?.toLowerCase() || "status";

      // -------------------- STATUS --------------------
      if (sub === "status") {
        const statusText = getTowerStatus(user) || "Nenhum status disponível.";
        const embed = new EmbedBuilder()
          .setTitle("🏰 Torre Infinita — Status Atual")
          .setDescription(statusText)
          .setColor("Blue");
        return message.reply({ embeds: [embed] });
      }

      // -------------------- RANKINGS --------------------
      if (sub === "rankings") {
        const rankings = getTowerRankings() || [];
        const rankingText = rankings.length
          ? rankings.map((r, i) => `${i + 1}. ${r.username} — Andar ${r.floor}`).join("\n")
          : "Nenhum ranking disponível.";
        const embed = new EmbedBuilder()
          .setTitle("🏆 Ranking da Torre Infinita")
          .setDescription(rankingText)
          .setColor("Gold");
        return message.reply({ embeds: [embed] });
      }

      // -------------------- CHALLENGE --------------------
      if (sub === "challenge" || sub === "c") {
        const spent = spendTowerAttempt(user);
        if (!spent) return message.reply({ content: "❌ Sem tentativas restantes.", allowedMentions: { repliedUser: false } });

        const floor = user.tower.floor;
        let enemy = getFloorEnemy(floor);

        if (!enemy || !enemy.deck) {
          enemy.deck = [
            { id: "strike", type: "attack", value: 10 },
            { id: "shield", type: "defense", value: 8 },
            { id: "poison", type: "debuff", apply: [{ name: "poison", value: 3, turns: 2 }] }
          ];
        }

        // Eventos aleatórios do andar
        const event = getRandomTowerEvent(floor);
        let eventText = "";
        if (event) {
          if (event.type === "buff") {
            enemy.hp = Math.floor(enemy.hp * (1 - event.value));
            eventText = `✨ Evento: ${event.description} (HP inimigo reduzido em ${event.value * 100}%)`;
          } else if (event.type === "debuff") {
            enemy.hp = Math.floor(enemy.hp * (1 + event.value));
            eventText = `⚡ Evento: ${event.description} (HP inimigo aumentado em ${event.value * 100}%)`;
          } else if (event.type === "gem") {
            addTemporaryGem(user, event.gem);
            eventText = `💎 Evento: ${event.description} — Gema temporária "${event.gem}"!`;
          } else if (event.type === "lore") {
            eventText = `📜 História do andar: ${event.description}`;
          }
        }

        const isBossFloor = floor % 5 === 0;
        if (isBossFloor) {
          enemy.name = `👑 Boss Épico: ${enemy.name}`;
        }

        const result = runBattle(user, enemy, { auto: true });
        if (!result || !result.log) return message.reply("⚠️ Ocorreu um erro na batalha. Tente novamente.");

        const battleLogs = result.log.map(l =>
          `\`${l.turn ? `Turno ${l.turn}` : ""}\` **${l.actor}**: ${l.action || l.note || ""}`
        ).slice(0, 10).join("\n");

        const embed = new EmbedBuilder()
          .setTitle(`⚔️ Andar ${floor}: ${enemy.name}`)
          .setDescription(`${eventText}\n\n${battleLogs}\n... (Concluído em ${result.turn - 1} turnos)`)
          .setColor(isBossFloor ? "Red" : "DarkBlue");

        // Vitória
        if (result.winner === "player") {
          user.tower.winStreak += 1;
          let reward = getFloorReward(floor);

          // Grandes recompensas a cada 5 níveis
          if (floor % 5 === 0) {
            reward.gold *= 3;
            reward.xp *= 3;

            // Ganha shard de guardião
            const shardId = giveGuardianShard(user);
            embed.addFields([
              { name: "🎴 Shard de Guardião!", value: `Você recebeu 1 shard do guardião: **${shardId}**` }
            ]);
          }

          // Aplica combo de vitórias
          const multiplier = 1 + user.tower.winStreak * 0.1;
          reward.xp = Math.floor(reward.xp * (1 + floor * 0.05) * multiplier);
          reward.gold = Math.floor(reward.gold * (1 + floor * 0.05) * multiplier);

          addXP(user, reward.xp);
          addGold(user, reward.gold);
          user.tower.floor += 1;

          embed.addFields([
            {
              name: "🏆 Vitória!",
              value: `Recompensas: **+${reward.xp} XP**, **+${reward.gold} Ouro**\n🔥 Combo de vitórias: x${multiplier.toFixed(1)}\n➡️ Próximo Andar: **${user.tower.floor}**`
            }
          ]);
        } else {
          user.tower.winStreak = 0;
          const defeatXP = Math.floor(floor * 5);
          const defeatGold = Math.floor(floor * 2);
          addXP(user, defeatXP);
          addGold(user, defeatGold);

          embed.addFields([
            {
              name: "😓 Derrota!",
              value: `Ainda ganha **+${defeatXP} XP** e **+${defeatGold} Ouro**\nTentativas restantes: **${user.tower.attempts}**`
            }
          ]);
        }

        return message.reply({ embeds: [embed] });
      }

      // -------------------- HELP --------------------
      const embedHelp = new EmbedBuilder()
        .setTitle("🏰 Comandos da Torre Épica")
        .setDescription(
          "`!tower status` — Veja seu andar, tentativas, combo de vitórias e gemas temporárias.\n" +
          "`!tower challenge` — Gasta 1 tentativa e lute contra o próximo andar.\n" +
          "`!tower rankings` — Veja o ranking global da Torre.\n" +
          "🎯 Andares especiais (a cada 5 níveis) dão shards de guardiões e grandes recompensas!"
        )
        .setColor("Blue");

      return message.reply({ embeds: [embedHelp] });

    } catch (err) {
      console.error("❌ Erro no comando tower:", err);
      return message.reply({
        content: "⚠️ Ocorreu um erro interno ao processar a Torre.",
        allowedMentions: { repliedUser: false }
      });
    }
  }
};