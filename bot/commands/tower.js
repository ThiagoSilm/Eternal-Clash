// src/commands/tower.js

import {
  spendTowerAttempt,
  getTowerStatus,
  getFloorEnemy,
  getFloorReward,
  getTowerRankings,
  getRandomTowerEvent
} from "../../src/systems/towerSystem.js";

import { runBattle } from "../../src/systems/battleSystem.js";
import { addXP, addGold, addItem, addTemporaryGem } from "../../src/systems/economySystem.js";
import { getGuardian } from "../../src/systems/guardianSystem.js";
import { MessageEmbed } from "discord.js";

export default {
  name: "tower",
  description: "Torre Infinita Épica: eventos, combos, histórias e prêmios lendários.",
  usage: "[status | challenge | rankings]",
  
  async execute(message, args, user) {
    try {
      if (!user.tower) {
        user.tower = { floor: 1, attempts: 3, lastAccess: 0, winStreak: 0, tempGems: [] };
      }
      
      const sub = args[0]?.toLowerCase() || "status";
      
      // -------------------- STATUS --------------------
      if (sub === "status") {
        const statusText = getTowerStatus(user);
        const gemsText = user.tower.tempGems.length > 0 ? `💎 Gemas ativas: ${user.tower.tempGems.join(", ")}` : "";
        const embed = new MessageEmbed()
          .setTitle("🏰 Torre Infinita — Status Atual")
          .setDescription(`${statusText}\n💪 Vitórias consecutivas: ${user.tower.winStreak}\n${gemsText}`)
          .setColor("BLUE");
        return message.reply({ embeds: [embed] });
      }
      
      // -------------------- RANKINGS --------------------
      if (sub === "rankings") {
        const rankings = getTowerRankings();
        const rankingText = rankings.map((r, i) => `${i+1}. ${r.username} — Andar ${r.floor}`).join("\n");
        const embed = new MessageEmbed()
          .setTitle("🏆 Ranking da Torre Infinita")
          .setDescription(rankingText || "Nenhum ranking disponível.")
          .setColor("GOLD");
        return message.reply({ embeds: [embed] });
      }
      
      // -------------------- CHALLENGE --------------------
      if (sub === "challenge" || sub === "c") {
        const spent = spendTowerAttempt(user);
        if (!spent) return message.reply({ content: "❌ Sem tentativas restantes.", allowedMentions: { repliedUser: false } });
        
        const floor = user.tower.floor;
        let enemy = getFloorEnemy(floor);
        
        // Gera deck e guardian se necessário
        if (!enemy.deck || enemy.deck.length === 0) {
          enemy.deck = [
            { id: "strike", type: "attack", value: 10 },
            { id: "shield", type: "defense", value: 8 },
            { id: "poison", type: "debuff", apply: [{ name: "poison", value: 3, turns: 2 }] }
          ];
        }
        
        // Eventos do andar
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
            eventText = `💎 Evento: ${event.description} — Ganha a gema temporária "${event.gem}"!`;
          } else if (event.type === "lore") {
            eventText = `📜 História do andar: ${event.description}`;
          }
        }
        
        // Boss a cada 5 andares
        const isBossFloor = floor % 5 === 0;
        if (isBossFloor) {
          enemy.name = `👑 Boss Épico: ${enemy.name}`;
          enemy.guardian = getGuardian(enemy.guardianId);
        }
        
        // Executa batalha
        const result = runBattle(user, enemy, { auto: true });
        
        // Logs formatados
        const battleLogs = result.log.map(l => `\`${l.turn ? `Turno ${l.turn}` : ""}\` **${l.actor}**: ${l.action || l.note || ""}`).slice(0, 10).join("\n");
        
        const embed = new MessageEmbed()
          .setTitle(`⚔️ Andar ${floor}: ${enemy.name}`)
          .setDescription(`${eventText}\n\n${battleLogs}\n... (Concluído em ${result.turn-1} turnos)`)
          .setColor(isBossFloor ? "RED" : "DARK_BLUE");
        
        // -------------------- VITÓRIA --------------------
        if (result.winner === "player") {
          user.tower.winStreak += 1;
          
          const reward = getFloorReward(floor);
          const multiplier = 1 + user.tower.winStreak * 0.1;
          
          reward.xp = Math.floor(reward.xp * (1 + floor * 0.05) * multiplier);
          reward.gold = Math.floor(reward.gold * (1 + floor * 0.05) * multiplier);
          
          if (Math.random() < (isBossFloor ? 0.5 : 0.15)) {
            reward.item = `🎴 Carta Lendária do Andar ${floor}`;
            addItem(user, reward.item);
          }
          
          addXP(user, reward.xp);
          addGold(user, reward.gold);
          user.tower.floor += 1;
          
          embed.addField("🏆 Vitória!", `Recompensas: **+${reward.xp} XP**, **+${reward.gold} Ouro**${reward.item ? `, ${reward.item}` : ""}\n🔥 Combo de vitórias: x${multiplier.toFixed(1)}\n➡️ Próximo Andar: **${user.tower.floor}**`);
          
        } else {
          user.tower.winStreak = 0;
          
          const defeatXP = Math.floor(floor * 5);
          const defeatGold = Math.floor(floor * 2);
          addXP(user, defeatXP);
          addGold(user, defeatGold);
          
          embed.addField("😓 Derrota!", `Ainda ganha **+${defeatXP} XP** e **+${defeatGold} Ouro**\nTentativas restantes: **${user.tower.attempts}**`);
        }
        
        return message.reply({ embeds: [embed] });
      }
      
      // -------------------- HELP --------------------
      const embedHelp = new MessageEmbed()
        .setTitle("🏰 Comandos da Torre Épica")
        .setDescription(
          "`!tower status` — Veja seu andar, tentativas, combo de vitórias e gemas temporárias.\n" +
          "`!tower challenge` — Gasta 1 tentativa e lute contra o próximo andar.\n" +
          "`!tower rankings` — Veja o ranking global da Torre.\n" +
          "🎯 Andares especiais podem ter eventos, buffs/debuffs, gemas temporárias, mini-histórias e cartas lendárias!"
        )
        .setColor("BLUE");
      
      return message.reply({ embeds: [embedHelp] });
      
    } catch (err) {
      console.error("❌ Erro no comando tower:", err);
      return message.reply({ content: "⚠️ Ocorreu um erro interno ao processar a Torre.", allowedMentions: { repliedUser: false } });
    }
  }
};