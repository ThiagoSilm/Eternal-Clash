// dailyquest.js
// Comando para checar e reivindicar Missões Diárias
// -----------------------------------------------------------------
import { EmbedBuilder } from "discord.js";
import { 
  getQuestStatus, // Função que também inicializa as missões se for um novo dia
  claimDailyQuestReward 
} from "../../src/systems/dailyQuestSystem.js"; 

export default {
  name: "dailyquest",
  description: "Visualiza o status das missões diárias e reivindica o bônus final.",
  usage: "<status | claim>",
  
  async execute(message, args, user) { 
    const subcommand = args[0]?.toLowerCase();
    const username = message.author.username;

    // --- 1. STATUS (Padrão) ---
    if (!subcommand || subcommand === 'status') {
      try {
        const statusText = getQuestStatus(user);
        
        const embed = new EmbedBuilder()
          .setTitle(`📅 Status das Missões Diárias de ${username}`)
          .setDescription(statusText)
          .setColor("#FFD700") // Gold
          .setFooter({ text: "Use !dailyquest claim para pegar o bônus final." })
          .setTimestamp();

        return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });

      } catch (err) {
        console.error(`Erro em !dailyquest status:`, err);
        return message.reply("❌ Erro ao buscar o status das missões diárias.");
      }
    }

    // --- 2. CLAIM (Reivindicar Bônus Final) ---
    if (subcommand === 'claim') {
      try {
        const result = claimDailyQuestReward(user);
        
        // Se a mensagem começar com "❌", é um erro ou impedimento (ex: não completou todas)
        if (result.startsWith("❌")) {
          return message.reply(`⚠️ ${result}`);
        }
        
        // Sucesso
        const embed = new EmbedBuilder()
          .setTitle(`🎉 Bônus Final Reivindicado!`)
          .setDescription(result)
          .setColor("#2ECC71"); // Emerald

        return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
        
      } catch (err) {
        console.error(`Erro em !dailyquest claim:`, err);
        return message.reply("❌ Erro fatal ao tentar reivindicar o bônus.");
      }
    }

    // --- Padrão / Ajuda ---
    message.reply(`Comando inválido. Use: \`!dailyquest ${this.usage}\``);
  }
};
