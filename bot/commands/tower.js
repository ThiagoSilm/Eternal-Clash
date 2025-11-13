// src/commands/tower.js

import {
  spendTowerAttempt,
  getTowerStatus,
  getFloorEnemy,
  getFloorReward
} from "../../src/systems/towerSystem.js";

import { battleSystem } from "../../src/systems/battleSystem.js";
import { addXP, addGold } from "../../src/systems/economySystem.js";

export default {
  name: "tower",
  description: "Desafie a Torre Infinita para avançar andares e receber recompensas.",
  usage: "[status | challenge]",

  async execute(message, args, user) {
    try {
      // ----------------------------------------------------
      // 1. Fallback – garante estrutura mínima
      // ----------------------------------------------------
      if (!user.tower) {
        user.tower = { floor: 1, attempts: 3, lastAccess: 0 };
      }

      const sub = args[0]?.toLowerCase() || "status";

      // ----------------------------------------------------
      // 2. STATUS
      // ----------------------------------------------------
      if (sub === "status") {
        const statusText = getTowerStatus(user);

        return message.reply({
          content: `🏰 **Torre Infinita — Status Atual**\n${statusText}`,
          allowedMentions: { repliedUser: false }
        });
      }

      // ----------------------------------------------------
      // 3. DESAFIO (challenge)
      // ----------------------------------------------------
      if (sub === "challenge" || sub === "c") {
        // A. Gasta tentativa (já faz reset diário internamente)
        const spent = spendTowerAttempt(user);

        if (!spent) {
          return message.reply({
            content: "❌ Você não tem tentativas de Torre restantes.",
            allowedMentions: { repliedUser: false }
          });
        }

        const floor = user.tower.floor;
        const enemy = getFloorEnemy(floor);

        // B. Batalha
        const result = battleSystem(user, enemy);

        let reply = `\n**--- ⚔️ ANDAR ${floor}: ${enemy.name} ⚔️ ---**\n`;

        // Resumo dos primeiros logs
        const partialLog = result.log.slice(0, 6).join("\n");
        reply += `${partialLog}\n... (Concluído em ${result.turns} turnos)\n`;

        // ----------------------------------------------------
        // 4. VITÓRIA
        // ----------------------------------------------------
        if (result.winner === "player") {
          const reward = getFloorReward(floor);

          addXP(user, reward.xp);
          addGold(user, reward.gold);

          // Avança andar
          user.tower.floor += 1;

          reply += `\n🎉 **Vitória no Andar ${floor}!**`;
          reply += `\n🎁 Recompensas: **+${reward.xp} XP**, **+${reward.gold} Ouro**.`;
          reply += `\n➡️ Próximo Andar: **${user.tower.floor}**`;

        } else {
          // ----------------------------------------------------
          // 5. DERROTA
          // ----------------------------------------------------
          reply += `\n😓 **Derrota!** Você perdeu a tentativa.`;
          reply += `\nTentativas restantes: **${user.tower.attempts}**.`;
        }

        return message.reply({
          content: reply,
          allowedMentions: { repliedUser: false }
        });
      }

      // ----------------------------------------------------
      // 4. HELP DEFAULT
      // ----------------------------------------------------
      return message.reply({
        content:
          "🏰 **Comandos da Torre**\n" +
          "`!tower status` — Veja seu andar, tentativas e o próximo inimigo.\n" +
          "`!tower challenge` — Gasta 1 tentativa e luta contra o próximo andar.",
        allowedMentions: { repliedUser: false }
      });

    } catch (err) {
      console.error("❌ Erro no comando tower:", err);

      return message.reply({
        content: "⚠️ Ocorreu um erro interno ao processar a Torre.",
        allowedMentions: { repliedUser: false }
      });
    }
  }
};