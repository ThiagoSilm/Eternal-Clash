// src/commands/shop.js
import { spendCurrency, getBalance, updateLastShopVisit } from "../../src/systems/economySystem.js";
import { getShopCatalog, processPurchase, getDynamicPrice } from "../../src/systems/shopSystem.js";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from "discord.js";

const ITEMS_PER_PAGE = 5;
const RARITY_COLORS = {
  comum: 0x808080,
  rara: 0x00BFFF,
  épica: 0x8A2BE2,
  lendária: 0xFFD700
};

const formatRemainingTime = (until) => {
  const ms = new Date(until) - Date.now();
  if (ms <= 0) return "⏰ Expirado";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${h}h ${m}m ${s}s`;
};

export default {
  name: "shop",
  description: "Loja com itens temporários, promoções e alertas de novidades.",
  usage: "[list | buy <id> [quantidade] | list <categoria>]",
  
  async execute(message, args, user) {
    const sub = (args[0] || "").toLowerCase();
    
    try {
      let catalog = getShopCatalog() || [];
      if (catalog.length === 0) return message.reply("🛒 A loja está vazia.");
      
      const now = new Date();
      
      // Filtrar itens disponíveis
      catalog = catalog.filter(item => {
        const from = item.availableFrom ? new Date(item.availableFrom) : null;
        const until = item.availableUntil ? new Date(item.availableUntil) : null;
        return (!from || from <= now) && (!until || until >= now);
      });
      
      if (catalog.length === 0) return message.reply("🛒 Nenhum item disponível no momento.");
      
      // ----------------------------
      // Filtrar por categoria
      // ----------------------------
      let filterCategory = null;
      if (sub === "list" && args[1]) filterCategory = args[1].toLowerCase();
      
      if (filterCategory) {
        catalog = catalog.filter(i => i.category && i.category.toLowerCase() === filterCategory);
        if (catalog.length === 0) return message.reply(`❌ Nenhum item encontrado na categoria: ${filterCategory}`);
      }
      
      // ----------------------------
      // Listar itens com destaque de novidades
      // ----------------------------
      if (sub === "" || sub === "list" || sub === "loja") {
        let page = 0;
        const pages = Math.ceil(catalog.length / ITEMS_PER_PAGE);
        
        const lastVisit = user.lastShopVisit || 0;
        
        const generateEmbed = (page) => {
          const slice = catalog.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);
          return {
            title: "🛒 Loja de Eventos",
            description: filterCategory ? `Categoria: ${filterCategory}` : "Itens disponíveis temporariamente",
            color: 0xFFD700,
            fields: slice.map(item => {
              const dynamicPrice = getDynamicPrice(item);
              const remaining = item.availableUntil ? formatRemainingTime(item.availableUntil) : "∞";
              const isNew = new Date(item.availableFrom || 0) > lastVisit;
              return {
                name: `[${item.id}] ${item.name} ${item.rarity ? `⭐ ${item.rarity}` : ""} ${isNew ? "🆕" : ""} — ${dynamicPrice} ${item.currency.toUpperCase()}`,
                value: `${item.description}\n📦 Estoque: ${item.stock != null ? item.stock : "∞"}\n⏰ Disponível por: ${remaining}` +
                  (item.discount ? `\n💰 Promoção: ${item.discount}% off!` : ""),
                inline: false
              };
            }),
            footer: { text: `Página ${page + 1}/${pages} • Use !shop buy <id> [qnt] para comprar.` }
          };
        };
        
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("prev").setLabel("⬅️").setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId("next").setLabel("➡️").setStyle(ButtonStyle.Primary)
        );
        
        const reply = await message.reply({ embeds: [generateEmbed(page)], components: pages > 1 ? [row] : [] });
        if (pages > 1) {
          const collector = reply.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });
          collector.on("collect", i => {
            if (i.user.id !== message.author.id) return i.reply({ content: "⛔ Apenas o autor pode usar os botões.", ephemeral: true });
            if (i.customId === "next") page = (page + 1) % pages;
            if (i.customId === "prev") page = (page - 1 + pages) % pages;
            i.update({ embeds: [generateEmbed(page)] });
          });
        }
        
        // Atualiza a última visita do usuário
        await updateLastShopVisit(user, now);
        
        return;
      }
      
      // ----------------------------
      // Comprar item
      // ----------------------------
      if (sub === "buy" || sub === "comprar") {
        const itemId = args[1];
        const quantity = Math.max(1, parseInt(args[2]) || 1);
        if (!itemId) return message.reply("❌ Use: `!shop buy <id> [quantidade]`");
        
        const item = catalog.find(i => i.id.toString() === itemId);
        if (!item) return message.reply("❌ Item não encontrado ou não disponível.");
        
        if (item.stock != null && item.stock < quantity) {
          return message.reply(`❌ Estoque insuficiente: disponível ${item.stock}, você tentou comprar ${quantity}.`);
        }
        
        const dynamicPrice = getDynamicPrice(item) * quantity;
        const balance = getBalance(user, item.currency);
        if (balance < dynamicPrice) return message.reply(`❌ Saldo insuficiente: precisa de ${dynamicPrice} ${item.currency.toUpperCase()}, mas tem ${balance}.`);
        
        const result = await processPurchase(user, itemId, quantity);
        
        return message.reply({
          content: `✅ Compra concluída!\n**Item:** ${item.name}\n**Quantidade:** ${quantity}\n**Custo:** ${dynamicPrice} ${item.currency.toUpperCase()}\n` +
            `**Saldo restante:** ${balance - dynamicPrice}\n${item.stock != null ? `📦 Estoque restante: ${item.stock - quantity}\n` : ""}${result}`
        });
      }
      
      // ----------------------------
      // Ajuda
      // ----------------------------
      const help =
        "🛍️ **Comandos da Loja de Eventos:**\n" +
        "`!shop` — Ver lista de itens.\n" +
        "`!shop list` — Ver tudo que está à venda.\n" +
        "`!shop list <categoria>` — Filtrar itens por categoria.\n" +
        "`!shop buy <id> [quantidade]` — Comprar um item.\n" +
        "Exemplos:\n" +
        "`!shop buy 101`\n" +
        "`!shop buy 102 3`\n" +
        "`!shop list cartas`";
      
      return message.reply(help);
      
    } catch (err) {
      console.error("❌ Erro no comando shop:", err);
      const msg = typeof err === "string" ? `⚠️ ${err}` : "⚠️ Ocorreu um erro ao processar a Loja.";
      return message.reply(msg);
    }
  }
};