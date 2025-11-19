// claimenergy.js
// Comando para forçar a regeneração de energia e resgatar recompensas offline
// -----------------------------------------------------------------
import { EmbedBuilder } from "discord.js";
import {
  regenerateEnergy,
  claimOfflineRewards,
  REGEN_RATE_MS,
  ENERGY_TYPES
} from "../../src/systems/economySystem.js"; // Importa as funções de energia

export default {
  name: "claimenergy",
  description: "Coleta energia regenerada e resgata recompensas offline (se disponíveis).",
  usage: "[claimenergy]",
  
  async execute(message, args, user) {
    const userId = message.author.id;
    const username = message.author.username;
    
    let responseMessages = [];
    
    // 1. Resgatar Recompensas Offline
    try {
      const offlineMsg = claimOfflineRewards(user);
      if (offlineMsg) {
        responseMessages.push(offlineMsg);
      }
    } catch (err) {
      console.error(`Erro ao resgatar recompensas offline para ${userId}:`, err);
      responseMessages.push("⚠️ Erro ao tentar resgatar recompensas offline.");
    }
    
    // 2. Regenerar Energia
    let regenSuccess = false;
    try {
      const regenMsg = regenerateEnergy(user);
      if (regenMsg) {
        responseMessages.push(regenMsg);
        regenSuccess = true;
      }
    } catch (err) {
      console.error(`Erro ao regenerar energia para ${userId}:`, err);
      responseMessages.push("⚠️ Erro ao tentar regenerar energia.");
    }
    
    // --- Montagem da Resposta ---
    
    if (responseMessages.length === 0) {
      // Se não houve regeneração e nem recompensas offline
      
      // Checar o tempo restante para a próxima regeneração (usando o primeiro tipo de energia)
      const firstEnergyType = Object.values(ENERGY_TYPES)[0];
      const energyData = user.energy?.[firstEnergyType];
      
      let waitMsg = "Nenhuma energia a coletar ou recompensa offline disponível.";
      
      if (energyData) {
        const timeSinceLastRegen = Date.now() - energyData.lastRegen;
        const timeToNextPoint = REGEN_RATE_MS - (timeSinceLastRegen % REGEN_RATE_MS);
        
        const minutes = Math.floor(timeToNextPoint / (60 * 1000));
        const seconds = Math.ceil((timeToNextPoint % (60 * 1000)) / 1000);
        
        // Formata a mensagem de espera
        waitMsg = `⏳ A próxima energia regerena em **${minutes}m ${seconds}s**.`;
      }
      
      return message.reply(`💤 ${waitMsg}`);
    }
    
    // Se houve alguma ação (Offline Reward ou Regeneração)
    const finalDescription = responseMessages.join("\n\n---\n\n");
    
    const embed = new EmbedBuilder()
      .setTitle(`✅ Coleta de Recursos de ${username}`)
      .setDescription(finalDescription)
      .setColor(regenSuccess ? "#00FF7F" : "#FFD700") // Spring Green ou Gold
      .setFooter({ text: "Use !status para ver os níveis de energia atuais." })
      .setTimestamp();
      
    await message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
  }
};
