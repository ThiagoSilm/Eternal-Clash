// daily.js
// Comando principal para interagir com o sistema de recompensas diárias e cofres
// -----------------------------------------------------------------
import { EmbedBuilder } from "discord.js";
import { 
  claimDaily,
  getDailyStatus,
  claimWeeklyChest,
  claimMonthlyReward,
  claimDailyVIP,
  dailyDraw
} from "../../src/systems/dailySystem.js"; 

export default {
  name: "daily",
  description: "Coleta a recompensa diária, Cofres e participa do sorteio.",
  usage: "[claim | status | chest | monthly | vip | draw]",
  aliases: ["diario"],
  
  async execute(message, args, user) { 
    const subcommand = args[0]?.toLowerCase() || 'claim';
    const username = message.author.username;

    // --- Helper para enviar Embeds ---
    async function replyInEmbed(title, description, color = "#FFD700") {
        const embed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(description)
            .setColor(color);
        await message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
    }

    // --- 1. CLAIM (Principal) ---
    if (subcommand === 'claim') {
      try {
        const result = claimDaily(user);
        
        // Se a mensagem começar com "❌" (que o claimDaily não faz, mas é uma boa prática)
        if (result.startsWith("📆 Você já")) {
          return message.reply(`❌ ${result}`);
        }
        
        return replyInEmbed("🎉 Recompensa Diária Coletada!", result, "#2ECC71"); // Sucesso (Verde)
        
      } catch (err) {
        if (err.message.includes("Você já coletou")) {
             return message.reply(`❌ ${err.message}`);
        }
        console.error(`Erro em !daily claim:`, err);
        return message.reply("❌ Erro fatal ao tentar coletar o daily.");
      }
    }

    // --- 2. STATUS ---
    if (subcommand === 'status') {
      try {
        const statusText = getDailyStatus(user);
        return replyInEmbed("📊 Status Diário", statusText, "#3498DB"); // Azul
      } catch (err) {
        console.error(`Erro em !daily status:`, err);
        return message.reply("❌ Erro ao buscar o status diário.");
      }
    }
    
    // --- 3. CHEST (Cofre Semanal) ---
    if (subcommand === 'chest' || subcommand === 'weekly') {
      try {
        const result = claimWeeklyChest(user);
        if (result.startsWith("📦 Seu")) {
          return message.reply(`📦 ${result}`);
        }
        return replyInEmbed("📦 Cofre Semanal Aberto", result, "#F1C40F"); // Amarelo
      } catch (err) {
        console.error(`Erro em !daily chest:`, err);
        return message.reply("❌ Erro ao tentar abrir o cofre semanal.");
      }
    }
    
    // --- 4. MONTHLY (Cofre Mensal) ---
    if (subcommand === 'monthly') {
      try {
        const result = claimMonthlyReward(user);
        if (result.startsWith("❌ Você")) {
          return message.reply(`❌ ${result}`);
        }
        return replyInEmbed("🌙 Recompensa Mensal!", result, "#9B59B6"); // Roxo
      } catch (err) {
        console.error(`Erro em !daily monthly:`, err);
        return message.reply("❌ Erro ao tentar reivindicar a recompensa mensal.");
      }
    }

    // --- 5. VIP ---
    if (subcommand === 'vip') {
        try {
            const result = claimDailyVIP(user);
            if (result.startsWith("❌ Você")) {
                return message.reply(`❌ ${result}`);
            }
            return replyInEmbed("💎 Daily VIP Bônus", result, "#FF00FF"); // Rosa Neon
        } catch (err) {
            console.error(`Erro em !daily vip:`, err);
            return message.reply("❌ Erro ao tentar coletar o bônus VIP.");
        }
    }

    // --- 6. DRAW (Sorteio) ---
    if (subcommand === 'draw' || subcommand === 'sorteio') {
        try {
            const result = dailyDraw(user);
            if (result.startsWith("⏳ Você")) {
                return message.reply(`❌ ${result}`);
            }
            // Jackpot merece uma cor especial
            const color = result.includes("JACKPOT") ? "#FF4500" : "#7F8C8D";
            return replyInEmbed("🎰 Sorteio Diário", `Você ganhou: ${result}`, color); 
        } catch (err) {
            console.error(`Erro em !daily draw:`, err);
            return message.reply("❌ Erro ao participar do sorteio.");
        }
    }


    // --- Padrão / Ajuda ---
    message.reply(`Comando inválido. Use: \`!daily ${this.usage}\``);
  }
};
