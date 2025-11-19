// map.js
// Comando para interagir com o sistema de mapa/aventura
// -----------------------------------------------------------------
import { EmbedBuilder } from "discord.js";
import { 
  visualizeMap,
  getNextAvailableScenesForUser,
  enterScene,
  openChest,
  MAP_CONFIG
} from "../../src/systems/mapSystem.js"; 
import { getBalance } from "../../src/systems/economySystem.js";

// --- Constantes de Emojis e Cores ---
const MAP_EMOJI = "🗺️";
const ATTACK_EMOJI = "⚔️";
const CHEST_EMOJI = "🎁";
const VICTORY_COLOR = "#2ECC71"; // Verde
const DEFEAT_COLOR = "#E74C3C";  // Vermelho
const INFO_COLOR = "#3498DB";    // Azul

export default {
  name: "map",
  description: "Gerencia a exploração do mapa, batalhas de fase e abertura de baús.",
  usage: "[view | attack <FaseID> [Dificuldade] | chest <MundoID>]",
  aliases: ["aventura"],
  
  async execute(message, args, user) { 
    const subcommand = args[0]?.toLowerCase() || 'view';
    const username = message.author.username;
    
    // --- 1. VIEW / VISUALIZAR MAPA (Padrão) ---
    if (subcommand === 'view') {
      try {
        const mapVisualization = visualizeMap(user);
        const availableScenes = getNextAvailableScenesForUser(user);
        
        let availableText = "Nenhuma fase disponível. Use `!map attack 1-1` para começar!";
        if (availableScenes.length > 0) {
          availableText = availableScenes.slice(0, 10).map(id => `\`${id}\``).join(', ');
          if (availableScenes.length > 10) availableText += `... (+${availableScenes.length - 10} mais)`;
        }

        const embed = new EmbedBuilder()
          .setTitle(`${MAP_EMOJI} Mapa de Exploração de ${username}`)
          .setDescription(`**Próximas Fases Disponíveis (Máx. 10):**\n${availableText}`)
          .addFields([
            { name: "Visualização Rápida", value: `\`\`\`${mapVisualization}\`\`\``, inline: false },
            { name: "Custo de Ataque", value: `⚡ ${MAP_CONFIG.energyCost} Energia de Aventura`, inline: true },
            { name: "Seu Ouro", value: `💰 ${getBalance(user, 'gold')}`, inline: true }
          ])
          .setColor(INFO_COLOR)
          .setFooter({ text: "Use !map attack <ID> ou !map chest <MundoID>" });

        return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });

      } catch (err) {
        console.error(`Erro em !map view:`, err);
        return message.reply("❌ Erro ao visualizar o mapa.");
      }
    }
    
    // --- 2. ATTACK / ATACAR FASE ---
    if (subcommand === 'attack') {
      const phaseId = args[1];
      const difficulty = args[2] || "Fácil";
      
      if (!phaseId) return message.reply("❌ Forneça o ID da fase (ex: `1-1`, `2-5`).");
      
      const difficultyNormalized = MAP_CONFIG.difficulties.find(d => d.toLowerCase().startsWith(difficulty.toLowerCase()));
      if (!difficultyNormalized) return message.reply(`❌ Dificuldade inválida. Use: ${MAP_CONFIG.difficulties.join(', ')}.`);

      try {
        await message.reply(`${ATTACK_EMOJI} **Iniciando a batalha** em \`${phaseId}\` (Dificuldade: ${difficultyNormalized})...`);
        
        // Simulação de delay para a batalha ser emocionante
        // await new Promise(resolve => setTimeout(resolve, 3000));

        const result = await enterScene(user, phaseId, difficultyNormalized);
        
        const isVictory = result.startsWith("🏆");
        
        const embed = new EmbedBuilder()
          .setTitle(`${ATTACK_EMOJI} Resultado da Aventura`)
          .setDescription(result)
          .setColor(isVictory ? VICTORY_COLOR : DEFEAT_COLOR)
          .setFooter({ text: isVictory ? "Parabéns, a fase foi concluída!" : "Tente novamente ou melhore seu deck." })
          .setTimestamp();
          
        return message.channel.send({ embeds: [embed] }); // Envia no canal principal para não spammar a resposta

      } catch (err) {
        console.error(`Erro em !map attack:`, err);
        return message.reply(`❌ Erro ao entrar na fase: ${err.message}`);
      }
    }

    // --- 3. CHEST / ABRIR BAÚ ---
    if (subcommand === 'chest') {
        const worldId = parseInt(args[1]);
        if (isNaN(worldId) || worldId < 1 || worldId > MAP_CONFIG.worlds) {
            return message.reply(`❌ Forneça um ID de mundo válido (1 a ${MAP_CONFIG.worlds}).`);
        }

        try {
            const result = openChest(user, worldId);
            const isSuccess = !result.startsWith("⚠️");
            
            return replyInEmbed(
                `${CHEST_EMOJI} Baú do Mundo ${worldId}`,
                result,
                isSuccess ? "#FFD700" : "#F39C12" // Gold ou Laranja
            );
        } catch (err) {
            console.error(`Erro em !map chest:`, err);
            return message.reply(`❌ Erro ao tentar abrir o baú: ${err.message}`);
        }
    }

    // --- Padrão / Ajuda ---
    message.reply(`Comando inválido. Use: \`!map ${this.usage}\``);
  }
};
