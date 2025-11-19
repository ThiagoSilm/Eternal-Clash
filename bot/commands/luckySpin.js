// luckyspin.js
// Comando para o Lucky Spin (Gira a Roda da Fortuna com custo em Ouro e recompensa em Gemas)
// -----------------------------------------------------------------
import { EmbedBuilder } from "discord.js";
import { spinLucky } from "../../src/systems/luckySpinSystem.js"; 
import { getBalance } from "../../src/systems/economySystem.js"; // Para checar o saldo

// Configurações para o comando (deve ser o mesmo custo do sistema)
const SPIN_COST = 100;
const MAX_SPIN_HISTORY = 5;

// Cores para as raridades
const RARITY_COLORS = {
    common: "#CCCCCC",
    rare: "#0077FF",
    epic: "#AA00FF",
    legendary: "#FF8C00",
    mythic: "#FF0000",
    jackpot: "#FFD700" // Gold
};

// Emojis de Raridade (para apelo visual)
const RARITY_EMOJIS = {
    common: "⚪",
    rare: "🟦",
    epic: "🟪",
    legendary: "🟧",
    mythic: "🟥",
    jackpot: "👑"
};

export default {
  name: "luckyspin",
  description: `Gira a Roda da Fortuna para ganhar Gemas. Custo: ${SPIN_COST} Ouro.`,
  usage: "[luckyspin]",
  aliases: ["spin", "roda"],
  
  async execute(message, args, user) {
    const userId = message.author.id;
    const username = message.author.username;
    
    if (getBalance(user, "gold") < SPIN_COST) {
        return message.reply(`❌ Você precisa de **${SPIN_COST} Ouro** para girar a Roda da Fortuna!`);
    }

    try {
        // Inicializa o histórico se não existir
        if (!user.luckySpin) user.luckySpin = { spins: 0, history: [] };

        // 1. Executa o Spin
        const result = spinLucky(user);

        // Se falhou (raro, mas por segurança)
        if (result.msg.startsWith("❌")) {
            return message.reply(result.msg);
        }
        
        // 2. Adiciona ao Histórico (para o apelo "social proof")
        const historyEntry = `${RARITY_EMOJIS[result.rarity]} | ${result.msg.replace(/\n/g, ' ')}`;
        user.luckySpin.history.unshift(historyEntry);
        if (user.luckySpin.history.length > MAX_SPIN_HISTORY) {
            user.luckySpin.history.pop();
        }
        
        // 3. Monta a Mensagem
        const totalSpins = user.luckySpin.spins;
        const nextMegaSpin = 10 - (totalSpins % 10);
        
        const description = [
            `**Resultado da Rodada:**\n${RARITY_EMOJIS[result.rarity]} ${result.msg}`,
            "---",
            `**Status:**`,
            `Total de Spins: ${totalSpins}`,
            `Próximo **MEGA SPIN** em: **${nextMegaSpin}** spins!`
        ].join('\n');
        
        const historyList = user.luckySpin.history.map(h => `- ${h}`).join('\n');

        const embed = new EmbedBuilder()
            .setTitle(`🎡 ${username} Gira a Roda! (Custo: ${SPIN_COST} 💰)`)
            .setDescription(description)
            .addFields([
                { name: `📜 Últimos ${Math.min(MAX_SPIN_HISTORY, user.luckySpin.history.length)} Prêmios`, value: historyList || "Nenhum histórico.", inline: false }
            ])
            .setColor(RARITY_COLORS[result.rarity] || "#AAAAAA")
            .setTimestamp();
            
        await message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });

    } catch (err) {
      console.error(`Erro em !luckyspin para ${userId}:`, err);
      return message.reply("❌ Ocorreu um erro ao girar a Roda da Fortuna.");
    }
  }
};
