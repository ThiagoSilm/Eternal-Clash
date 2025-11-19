// status.js
// Comando para exibir o status completo do usuário (nível, recursos, estatísticas)
// -----------------------------------------------------------------
import { EmbedBuilder } from "discord.js";
import { 
  getBalance, 
  getStats, 
  getUserLevel, 
  getNextLevelXP,
  getCurrentEnergy, 
  getMaxEnergy 
} from "../../src/systems/economySystem.js"; 
import { getBattlePower, getDeckPower } from "../../src/systems/battleSystem.js";

// --- Constantes de Emojis e Cores ---
const STATUS_EMOJI = "📊";
const STATUS_COLOR = "#3498DB"; // Azul

export default {
  name: "status",
  description: "Exibe o nível, recursos, energia e estatísticas de batalha do seu perfil.",
  usage: "[status]",
  aliases: ["stats", "perfil", "eu"],
  
  async execute(message, args, user) { 
    const username = message.author.username;
    
    // --- 1. Dados do Usuário ---
    const level = getUserLevel(user);
    const xp = getStats(user).xp || 0;
    const nextLevelXP = getNextLevelXP(level);
    const xpProgress = `${xp}/${nextLevelXP}`;
    
    const gold = getBalance(user, 'gold');
    const gems = getBalance(user, 'gem');
    
    const currentEnergy = getCurrentEnergy(user);
    const maxEnergy = getMaxEnergy(user);
    
    // --- 2. Dados de Batalha ---
    const battlePower = getBattlePower(user);
    const deckPower = getDeckPower(user, "deck1"); // Considera o deck padrão para status
    const wins = getStats(user).wins || 0;
    const losses = getStats(user).losses || 0;
    
    // --- 3. Monta a Mensagem ---
    
    const embed = new EmbedBuilder()
      .setTitle(`${STATUS_EMOJI} Perfil de ${username}`)
      .setDescription(`Seu resumo de progresso e poder no jogo.`)
      .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
      .setColor(STATUS_COLOR)
      .addFields([
        // --- Nível e XP ---
        { name: "✨ Nível", value: `**${level}**`, inline: true },
        { name: "⭐ XP", value: `${xpProgress}`, inline: true },
        { name: "⚡ Energia", value: `**${currentEnergy}**/${maxEnergy}`, inline: true },
        
        // --- Recursos ---
        { name: "💰 Ouro", value: `${gold}`, inline: true },
        { name: "💎 Gemas", value: `${gems}`, inline: true },
        { name: "\u200b", value: "\u200b", inline: true }, // Campo vazio para espaçamento
        
        // --- Poder e Batalha ---
        { name: "⚔️ Poder Base", value: `${battlePower}`, inline: true },
        { name: "🃏 Poder do Deck 1", value: `${deckPower}`, inline: true },
        { name: "📊 Recorde de Batalha", value: `Vitórias: ${wins} | Derrotas: ${losses}`, inline: true },
      ])
      .setFooter({ text: "O Poder de Batalha é influenciado por equipamentos e buffs." })
      .setTimestamp();
      
    return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
  }
};
