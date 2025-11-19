// inventory.js
// Comando para gerenciar o inventário de Cartas, Itens e Guardiões
// -----------------------------------------------------------------
import { EmbedBuilder } from "discord.js";
import { 
  listInventory,
  viewCardDetails,
  lockCard,
  unlockCard,
  markFavorite,
  sellCards,
  fuseCards,
  getDuplicates,
  viewDeck,
  addCardToDeck,
  removeCardFromDeck,
  listItems,
  listGuardians,
  autoSortInventory
} from "../../src/systems/inventorySystem.js";

// Tamanho padrão de página para visualização no Discord
const INVENTORY_PAGE_SIZE = 10;

export default {
  name: "inventory",
  description: "Gerencia o inventário de cartas, decks e itens.",
  usage: "<list [página] | view <ID único/Index> | lock <ID> | unlock <ID> | fav <ID> | sell <índices> | fuse <IDs> | deck <add/remove/view/clear>>",
  aliases: ["inv"],
  
  async execute(message, args, user) {
    const subcommand = args[0]?.toLowerCase() || 'list';
    const username = message.author.username;
    
    // --- Helper para enviar Embeds ---
    async function replyInEmbed(title, description, color = "#3498DB") {
        const embed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(description)
            .setColor(color);
        await message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
    }

    // --- Tratamento de Subcomandos ---

    // 1. LIST (Padrão)
    if (subcommand === 'list') {
        const page = parseInt(args[1]) || 1;
        
        // Exemplo: !inv list level_desc
        const sortCriteria = args[2] || "rarity_desc"; 

        try {
            const listResult = listInventory(user, {}, { page, pageSize: INVENTORY_PAGE_SIZE, order: sortCriteria });

            if (listResult === "📦 Inventory is empty.") {
                return message.reply(listResult);
            }
            
            const listText = listResult.text;
            const meta = listResult.meta;
            
            const embed = new EmbedBuilder()
                .setTitle(`📜 Inventário de Cartas de ${username}`)
                .setDescription("```\n" + listText + "\n```")
                .setColor("#3498DB")
                .setFooter({ text: `Use !inv view <Index> para detalhes. | Classificação: ${sortCriteria}` });

            return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });

        } catch (err) {
            console.error(`Erro em !inv list:`, err);
            return message.reply("❌ Erro ao listar o inventário.");
        }
    }
    
    // 2. VIEW DETALHES
    if (subcommand === 'view') {
        const identifier = args[1];
        if (!identifier) return message.reply("❌ Forneça o ID Único ou o Índice para visualização.");
        
        try {
            // Tenta tratar como índice primeiro, depois como ID único
            const parsedIdentifier = isNaN(Number(identifier)) ? identifier : Number(identifier);
            const infoText = viewCardDetails(user, parsedIdentifier);
            
            if (infoText === "Card not found.") {
                return message.reply(`❌ Carta com ID/Índice \`${identifier}\` não encontrada.`);
            }
            
            // Assume que formatCardInfo do cardSystem retorna um texto formatado.
            return replyInEmbed(`🔎 Detalhes da Carta`, infoText, "#1ABC9C"); 

        } catch (err) {
            console.error(`Erro em !inv view:`, err);
            return message.reply(`❌ Erro ao exibir os detalhes da carta: ${err.message}`);
        }
    }

    // 3. LOCK / UNLOCK
    if (subcommand === 'lock' || subcommand === 'unlock') {
        const uniqueId = args[1];
        if (!uniqueId) return message.reply(`❌ Forneça o ID Único da carta para ${subcommand}.`);

        try {
            const result = subcommand === 'lock' ? lockCard(user, uniqueId) : unlockCard(user, uniqueId);
            return replyInEmbed(
                subcommand === 'lock' ? "🔒 Carta Bloqueada" : "🔓 Carta Desbloqueada",
                result, 
                subcommand === 'lock' ? "#E74C3C" : "#2ECC71"
            );
        } catch (err) {
            console.error(`Erro em !inv ${subcommand}:`, err);
            return message.reply(`❌ Erro ao tentar ${subcommand} a carta: ${err.message}`);
        }
    }

    // 4. FAVORITE
    if (subcommand === 'fav') {
        const uniqueId = args[1];
        if (!uniqueId) return message.reply("❌ Forneça o ID Único da carta para favoritar.");
        
        try {
            const result = markFavorite(user, uniqueId, true); // Sempre marca como favorito
            return replyInEmbed("⭐ Favoritos", result, "#F1C40F");
        } catch (err) {
            console.error(`Erro em !inv fav:`, err);
            return message.reply(`❌ Erro ao tentar favoritar a carta: ${err.message}`);
        }
    }

    // 5. SELL (Vender)
    if (subcommand === 'sell') {
        const indices = args.slice(1).map(Number).filter(n => n > 0);
        if (indices.length === 0) return message.reply("❌ Forneça os índices das cartas a serem vendidas (ex: !inv sell 1 3 5).");
        
        try {
            const result = sellCards(user, indices);
            return replyInEmbed(
                "💰 Venda de Cartas Concluída",
                `Foram vendidas **${result.count}** cartas, totalizando **${result.goldGained} Ouro**!`,
                "#16A085"
            );
        } catch (err) {
            return message.reply(`❌ Falha na Venda: ${err.message}`);
        }
    }

    // 6. FUSE (Fusão / XP)
    if (subcommand === 'fuse') {
        const uniqueIds = args.slice(1);
        if (uniqueIds.length < 2) return message.reply("❌ A fusão requer o ID Único da carta principal seguido dos IDs Únicos dos doadores (mínimo 2 IDs no total).");

        try {
            const result = fuseCards(user, uniqueIds);
            const targetId = uniqueIds[0];
            return replyInEmbed(
                "✨ Fusão de Cartas (XP)",
                `A carta \`${targetId}\` subiu para o **Nível ${result.newLevel}** ao consumir ${uniqueIds.length - 1} cartas.`,
                "#9B59B6"
            );
        } catch (err) {
            return message.reply(`❌ Falha na Fusão: ${err.message}`);
        }
    }
    
    // 7. DUPLICATES (Mostrar Duplicatas)
    if (subcommand === 'dupes' || subcommand === 'duplicates') {
        const duplicates = getDuplicates(user);
        
        if (!duplicates.length) return message.reply("✅ Nenhuma duplicata encontrada.");

        const list = duplicates.slice(0, 10).map(group => {
            const template = getCardTemplate(group.id);
            const name = template?.name || group.id;
            // Exibe apenas 4 IDs de exemplo, se houver mais
            const samples = group.samples.slice(0, 4).join(', '); 
            return `📜 ${name} (Lv.${group.key.split('_lv')[1] || 1}): **${group.count}x** | IDs: ${samples}...`;
        }).join('\n');

        return replyInEmbed("👥 Duplicatas Encontradas", list, "#7F8C8D");
    }


    // 8. DECK MANAGEMENT
    if (subcommand === 'deck') {
        const deckAction = args[1]?.toLowerCase();
        const deckName = args[4] || "deck1"; // Assume deck1 por padrão
        
        if (deckAction === 'view') {
            const deckView = viewDeck(user, deckName);
            return replyInEmbed(`🃏 Deck: ${deckName}`, deckView, "#F39C12");
        }
        
        const indexOrId = args[2];
        if (!indexOrId) return message.reply("❌ Forneça o índice do inventário ou do deck para a ação.");

        if (deckAction === 'add') {
            const result = addCardToDeck(user, indexOrId, deckName); // indexOrId é o índice do inventário
            return message.reply(result);
        }

        if (deckAction === 'remove') {
            const result = removeCardFromDeck(user, indexOrId, deckName); // indexOrId é o índice dentro do deck
            return message.reply(result);
        }
        
        if (deckAction === 'clear') {
            const result = removeAllFromDeck(user, deckName);
            return message.reply(result);
        }
        
        return message.reply("❌ Ação de deck inválida. Use `!inv deck <view/add/remove/clear>`.");
    }
    
    // 9. ITEMS (Recursos)
    if (subcommand === 'items' || subcommand === 'recursos') {
        const itemList = listItems(user);
        const guardianList = listGuardians(user);

        const embed = new EmbedBuilder()
            .setTitle(`📦 Itens e Recursos de ${username}`)
            .setDescription(`**Guardianos Desbloqueados:**\n${guardianList || "Nenhum"}\n\n**Itens Diversos:**\n${itemList || "Nenhum"}`)
            .setColor("#D35400");
            
        return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
    }

    // --- Padrão / Ajuda ---
    message.reply(`Comando inválido. Use: \`!inv ${this.usage}\``);
  }
};
