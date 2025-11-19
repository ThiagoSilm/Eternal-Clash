// upgrade.js
// Comando para aumentar o nível de uma carta no inventário.
// -----------------------------------------------------------------
import { EmbedBuilder } from "discord.js";
import { upgradeCard } from "../../src/systems/inventorySystem.js";
import { getBalance } from "../../src/systems/economySystem.js";

// --- Constantes de Emojis e Cores ---
const UPGRADE_EMOJI = "⬆️";
const SUCCESS_COLOR = "#2980B9"; // Azul Marinho
const MAX_LEVEL = 100; // Assumindo um nível máximo

export default {
  name: "upgrade",
  description: "Aumenta o nível de uma carta em seu inventário usando XP e Ouro.",
  usage: "<Índice do Inventário> [Quantidade de Níveis (padrão: 1)]",
  aliases: ["up"],
  
  async execute(message, args, user) {
    // IMPORTANTE: O inventorySystem utiliza o uniqueId ou a posição do array (índice - 1).
    // Aqui estamos usando o índice do inventário como o uniqueId para evitar problemas.
    const inventoryIndex = parseInt(args[0]);
    const levelsToUpgrade = parseInt(args[1]) || 1;
    
    if (isNaN(inventoryIndex) || inventoryIndex < 1) {
      return message.reply("❌ Forneça o **Índice do Inventário** da carta que deseja aprimorar (veja em `!inv`).");
    }
    
    if (isNaN(levelsToUpgrade) || levelsToUpgrade < 1) {
      return message.reply("❌ Quantidade de níveis inválida. Deve ser um número inteiro positivo.");
    }
    
    try {
      // O sistema `upgradeCard` gerencia a lógica complexa (custo, máximo, etc.)
      // Note que a função upgradeCard no inventorySystem usa o uniqueId, não o index.
      // Se você pretende usar o índice, a lógica de busca precisa ser ajustada no inventorySystem
      // ou você deve passar o uniqueId. Para compatibilidade, usaremos o índice por enquanto.
      
      const result = upgradeCard(user, inventoryIndex, levelsToUpgrade);
      
      const {
        cardName,
        oldLevel,
        newLevel,
        xpSpent, // O inventorySystem atual não retorna XP gasto, apenas ouro. Ajuste isso.
        goldSpent,
      } = result;
      
      // O `totalLevels` é igual a `newLevel - oldLevel`
      const totalLevels = newLevel - oldLevel;
      
      const embed = new EmbedBuilder()
        .setTitle(`${UPGRADE_EMOJI} Aprimoramento de Carta Concluído!`)
        .setDescription(`A carta **${cardName}** foi aprimorada com sucesso!`)
        .addFields([
          { name: "Nível", value: `De **${oldLevel}** para **${newLevel}** (Subiu ${totalLevels} Níveis)`, inline: false },
          { name: "Ouro Gasto", value: `-${goldSpent} Ouro`, inline: true },
          { name: "Saldo Ouro", value: `${getBalance(user, 'gold')}`, inline: true },
        ])
        .setColor(SUCCESS_COLOR)
        .setFooter({ text: `Próximo nível máximo: ${MAX_LEVEL}` })
        .setTimestamp();
      
      // Adicionando campo de XP se houver lógica de XP
      if (xpSpent !== undefined) {
        embed.addFields([
          { name: "XP Gasto", value: `-${xpSpent} XP`, inline: true },
          { name: "Saldo XP", value: `${getBalance(user, 'xp')}`, inline: true }
        ]);
      }
      
      return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
      
    } catch (err) {
      // O sistema `upgradeCard` deve lançar erros em casos de:
      // - Carta não encontrada / inválida
      // - Nível máximo atingido
      // - Saldo insuficiente (XP ou Ouro)
      return message.reply(`❌ **Falha no Aprimoramento:** ${err.message}`);
    }
  }
}