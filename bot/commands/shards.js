// shards.js
// Comando para visualizar e fundir Shards de Guardiões.
// -----------------------------------------------------------------
import { EmbedBuilder } from "discord.js";
// Assumindo que estas funções estão disponíveis nos sistemas
import { getCardTemplate } from "../../src/systems/cardSystem.js"; 
import { craftCardFromShards } from "../../src/systems/inventorySystem.js"; 

// --- Constantes de Emojis e Cores ---
const SHARD_EMOJI = "✨";
const SUCCESS_COLOR = "#3498DB"; // Azul

export default {
  name: "shards",
  description: "Exibe seus Shards de Guardiões ou os funde em cartas.",
  usage: "[view | craft <ID da Carta> [Quantidade]]",
  aliases: ["fragmentos", "shard"],
  
  async execute(message, args, user) { 
    const subcommand = args[0]?.toLowerCase() || 'view';
    const username = message.author.username;

    // Garante que o objeto de shards exista para evitar erros.
    if (!user.guardianShards) {
        user.guardianShards = {};
    }

    // --- 1. VIEW / VISUALIZAR (Padrão) ---
    if (subcommand === 'view' || subcommand === 'list') {
        const shards = user.guardianShards;
        // Filtra apenas shards com contagem maior que zero
        const shardKeys = Object.keys(shards).filter(id => shards[id] > 0);

        if (shardKeys.length === 0) {
            return message.reply(`Você não possui nenhum Shard de Guardião. Consiga-os na **Torre** ou em eventos.`);
        }

        const shardList = shardKeys.map(id => {
            const template = getCardTemplate(id); // Obtém dados da carta (nome, custo)
            const needed = template.shardsToCraft;
            const progress = shards[id] >= needed ? "✅ Pronto para fundir" : `${shards[id]}/${needed}`;
            return `**${template.name}** (${template.rarity}★) - **${shards[id]}** Shards (Progressão: ${progress})`;
        }).join('\n');

        const embed = new EmbedBuilder()
            .setTitle(`${SHARD_EMOJI} Seus Shards de Guardiões`)
            .setDescription(`Estes são os fragmentos que você coletou para fundir novas cartas.`)
            .addFields([
                { name: "Fragmentos Disponíveis", value: shardList.length > 1024 ? shardList.substring(0, 1020) + "..." : shardList }
            ])
            .setColor(SUCCESS_COLOR)
            .setFooter({ text: "Use !shards craft <ID> para fundir uma carta." })
            .setTimestamp();
            
        return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
    }
    
    // --- 2. CRAFT / FUNDIR ---
    if (subcommand === 'craft' || subcommand === 'fundir') {
        const cardId = args[1]?.toLowerCase();
        const amount = parseInt(args[2]) || 1;
        
        if (!cardId) {
            return message.reply("❌ Forneça o **ID da Carta** que deseja fundir. (Ex: `fenix5`).");
        }
        if (isNaN(amount) || amount < 1) {
            return message.reply("❌ Quantidade inválida. Deve ser 1 ou mais.");
        }

        try {
            // A função `craftCardFromShards` lida com a lógica de custo e entrega
            const result = craftCardFromShards(user, cardId, amount);
            
            const embed = new EmbedBuilder()
                .setTitle(`🧪 Fusão de Shards Completa!`)
                .setDescription(`Você fundiu **${result.craftedAmount}x ${result.cardName}** com sucesso!`)
                .addFields([
                    { name: "Shards Usados", value: `-${result.shardsSpent}`, inline: true },
                    { name: "Shards Restantes", value: `${user.guardianShards[cardId] || 0}`, inline: true },
                ])
                .setColor("#27AE60") // Verde
                .setFooter({ text: `A carta foi adicionada ao seu inventário!` })
                .setTimestamp();
            
            return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });

        } catch (err) {
            // Captura erros de saldo insuficiente ou ID inválido
            return message.reply(`❌ **Falha na Fusão:** ${err.message}`);
        }
    }

    // --- Ajuda ---
    return message.reply(`Comando inválido. Uso correto: \`!shards ${this.usage}\`.`);
  }
};
