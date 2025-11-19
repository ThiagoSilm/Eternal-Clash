// shop.js
// Comando para listar o catálogo da loja e realizar compras.
// -----------------------------------------------------------------
import { EmbedBuilder } from "discord.js";
import { getShopCatalog, processPurchase, getDynamicPrice } from "../../src/systems/shopSystem.js"; 
import { getBalance } from "../../src/systems/economySystem.js";

// --- Constantes de Emojis e Cores ---
const SHOP_EMOJI = "🏪";
const PURCHASE_EMOJI = "🛒";
const CURRENCY_EMOJIS = {
    gem: "💎",
    gold: "💰"
};
const SHOP_COLOR = "#E67E22"; // Laranja

export default {
  name: "shop",
  description: "Lista os itens disponíveis na Loja ou realiza uma compra.",
  usage: "[view | buy <ID do Item> [Quantidade]]",
  aliases: ["loja"],
  
  async execute(message, args, user) { 
    const subcommand = args[0]?.toLowerCase() || 'view';
    const username = message.author.username;
    
    // --- Helper para formatar a linha de item ---
    function formatItemLine(item) {
        const currencyIcon = CURRENCY_EMOJIS[item.currency] || "❓";
        const price = getDynamicPrice(user, item);
        return `\`${item.id}\` | **${item.name}**\n   - ${item.description}\n   - Preço: ${price} ${currencyIcon}`;
    }

    // --- 1. VIEW / LISTAR CATÁLOGO (Padrão) ---
    if (subcommand === 'view' || subcommand === 'list') {
        const catalog = getShopCatalog(user);
        
        let dailyOfferText = "";
        let generalItemsText = "";
        
        const balances = [
            `💰 Ouro: ${getBalance(user, 'gold')}`,
            `💎 Gemas: ${getBalance(user, 'gem')}`
        ].join(' | ');

        for (const item of catalog) {
            if (item.id === "daily_offer") {
                dailyOfferText = formatItemLine(item);
            } else {
                generalItemsText += formatItemLine(item) + "\n\n";
            }
        }

        const embed = new EmbedBuilder()
            .setTitle(`${SHOP_EMOJI} Loja Universal de ${username}`)
            .setDescription(`**Seu Saldo:** ${balances}`)
            .addFields([
                { name: "✨ OFERTA DIÁRIA", value: dailyOfferText, inline: false },
                { name: "📦 CATÁLOGO PRINCIPAL", value: generalItemsText, inline: false }
            ])
            .setColor(SHOP_COLOR)
            .setFooter({ text: "Use !shop buy <ID> [Qtde] para comprar." });

        return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
    }
    
    // --- 2. BUY / COMPRAR ITEM ---
    if (subcommand === 'buy' || subcommand === 'comprar') {
        const itemId = args[1]?.toLowerCase();
        const qty = parseInt(args[2]) || 1;
        
        if (!itemId) return message.reply("❌ Forneça o ID do item que deseja comprar (ex: `energy_potion`).");
        if (isNaN(qty) || qty < 1) return message.reply("❌ Quantidade inválida.");

        try {
            const result = processPurchase(user, itemId, qty);
            
            const embed = new EmbedBuilder()
                .setTitle(`${PURCHASE_EMOJI} Transação Concluída!`)
                .setDescription(result)
                .setColor(VICTORY_COLOR)
                .setTimestamp();
                
            return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });

        } catch (err) {
            // Trata erros específicos de saldo/item inexistente
            if (err.message.includes("Saldo insuficiente") || err.message.includes("Item inexistente")) {
                return message.reply(`❌ **Falha na Compra:** ${err.message}`);
            }
            console.error(`Erro em !shop buy:`, err);
            return message.reply(`❌ Ocorreu um erro desconhecido ao processar sua compra.`);
        }
    }

    // --- Ajuda ---
    return message.reply(`Comando inválido. Uso correto: \`!shop ${this.usage}\`.`);
  }
};
