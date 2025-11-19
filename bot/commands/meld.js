// meld.js
// Comando para tentar fundir (meld) duas cartas para transferir um efeito.
// -----------------------------------------------------------------
import { EmbedBuilder } from "discord.js";
import { tryMeld, calculateMeldCost } from "../../src/systems/cardSystem.js";
import { findUserCardByUnique } from "../../src/systems/cardSystem.js"; // Para ver o nome

// --- Constantes de Emojis e Cores ---
const MELD_EMOJI = "🧪";
const MELD_COLOR = "#8E44AD"; // Púrpura

export default {
  name: "meld",
  description: "Tenta fundir (Meld) uma carta doadora em uma base para transferir um efeito. Alto risco!",
  usage: "<UID da Carta Base> <UID da Carta Doadora>",
  aliases: ["fundir", "combinar"],
  
  async execute(message, args, user) { 
    const baseUid = args[0];
    const donorUid = args[1];
    
    if (!baseUid || !donorUid) {
      return message.reply("❌ Uso inválido. Forneça o UID da Carta Base e o UID da Carta Doadora. (UIDs em `!inv`)");
    }

    // Pré-visualização do custo
    const baseCard = findUserCardByUnique(user, baseUid);
    if (!baseCard) {
        return message.reply(`❌ Carta Base (\`${baseUid}\`) não encontrada.`);
    }
    const donorCard = findUserCardByUnique(user, donorUid);
    if (!donorCard) {
        return message.reply(`❌ Carta Doadora (\`${donorUid}\`) não encontrada.`);
    }

    const cost = calculateMeldCost(baseCard);

    // Confirmação de segurança
    if (args[2]?.toLowerCase() !== 'confirm') {
        const embed = new EmbedBuilder()
            .setTitle(`${MELD_EMOJI} Confirmação de Meld`)
            .setDescription(`Você está prestes a usar a carta **${donorCard.name}** (\`${donorUid}\`) para tentar dar um efeito à **${baseCard.name}** (\`${baseUid}\`).`)
            .addFields([
                { name: "CUSTO", value: `${cost} Ouro`, inline: true },
                { name: "RISCO", value: "A carta doadora será **CONSUMIDA** mesmo em caso de falha.", inline: true },
                { name: "CHANCE BASE", value: `${baseCard.meldChance || 0}%`, inline: true },
            ])
            .setColor(MELD_COLOR)
            .setFooter({ text: `Para confirmar, use: !meld ${baseUid} ${donorUid} confirm` });
        
        return message.reply({ embeds: [embed] });
    }


    try {
      const result = tryMeld(user, baseUid, donorUid);
      
      const embed = new EmbedBuilder()
        .setTitle(`${MELD_EMOJI} Resultado do Meld`)
        .setDescription(result.message)
        .addFields([
            { name: "Carta Base", value: `**${baseCard.name}**`, inline: true },
            { name: "Carta Doadora", value: `CONSUMIDA`, inline: true },
            { name: "Ouro Gasto", value: `${cost}`, inline: true },
        ])
        .setColor(result.success ? "#2ECC71" : "#E74C3C") // Verde para sucesso, Vermelho para falha
        .setTimestamp();
        
      return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });

    } catch (err) {
      return message.reply(`❌ **Erro no Meld:** ${err.message}`);
    }
  }
};
