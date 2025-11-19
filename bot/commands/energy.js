// energy.js
// Comando para verificar o status da energia
// -----------------------------------------------------------------
import { EmbedBuilder } from "discord.js";
import {
  ensureEnergy,
  regenerateEnergy,
  REGEN_RATE_MS,
  ENERGY_TYPES
} from "../../src/systems/economySystem.js";

export default {
  name: "energy",
  description: "Mostra o status atual de todas as energias e o tempo para a próxima regeneração.",
  usage: "[energy]",
  aliases: ["energia"],
  
  async execute(message, args, user) {
    const userId = message.author.id;
    const username = message.author.username;

    try {
      // 1. Regenerar Silenciosamente
      // Chamamos regenerateEnergy para garantir que os valores de 'user.energy' 
      // estão atualizados com base no tempo decorrido, mas ignoramos a mensagem de retorno.
      regenerateEnergy(user); 
      
      // 2. Garantir Inicialização
      ensureEnergy(user); 
      
      const fields = [];
      let minTimeToNextRegen = Infinity;
      let timeToNextRegenMs = 0;
      
      // 3. Montar Campos do Embed para cada Tipo de Energia
      for (const k of Object.keys(ENERGY_TYPES)) {
        const type = ENERGY_TYPES[k];
        const e = user.energy[type];
        
        // Adicionar status da energia
        fields.push({
          name: `⚡ ${type.toUpperCase()}`,
          value: `**${e.current} / ${e.max}**`,
          inline: true
        });

        // Encontrar a energia com o menor tempo restante para a próxima regeneração
        if (e.current < e.max) {
            if (e.lastRegen < minTimeToNextRegen) {
                minTimeToNextRegen = e.lastRegen;
                
                const now = Date.now();
                const elapsed = now - e.lastRegen;
                // Calcula o tempo que falta no ciclo de REGEN_RATE_MS
                timeToNextRegenMs = REGEN_RATE_MS - (elapsed % REGEN_RATE_MS);
            }
        }
      }
      
      // 4. Calcular e Formatar Tempo para Próxima Regeneração
      let footerText;
      if (timeToNextRegenMs < Infinity && timeToNextRegenMs > 0) {
        const totalSeconds = Math.ceil(timeToNextRegenMs / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        
        footerText = `⏳ Próximo ponto de energia em: ${minutes}m ${seconds}s`;
      } else {
        footerText = "✅ Todas as suas energias estão no máximo!";
      }

      // 5. Enviar Resposta
      const embed = new EmbedBuilder()
        .setTitle(`🔋 Status de Energia de ${username}`)
        .addFields(fields)
        .setColor("#3498DB") // Azul
        .setFooter({ text: footerText })
        .setTimestamp();
        
      await message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });

    } catch (err) {
      console.error(`Erro em !energy para ${userId}:`, err);
      return message.reply("❌ Erro ao buscar o status da sua energia.");
    }
  }
};
