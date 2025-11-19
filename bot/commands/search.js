// src/commands/search.js
import Fuse from "fuse.js";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ComponentType } from "discord.js";

export default {
  name: "search",
  description: "Busca cartas no seu inventário pelo nome e retorna detalhes e índice.",
  usage: "<nome parcial da carta>",
  
  async execute(message, args, user) {
    if (!user.cards || user.cards.length === 0)
      return message.reply("📦 Seu inventário está vazio.");
    
    const searchTerm = args.join(" ")
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    
    if (!searchTerm)
      return message.reply("❌ Forneça o nome ou parte do nome da carta.");
    
    try {
      // Fuse.js configuração avançada
      const fuse = new Fuse(user.cards.map((card, idx) => ({
        ...card,
        index: idx + 1,
        nameNormalized: card.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
      })), {
        keys: ["nameNormalized"],
        threshold: 0.4,
        ignoreLocation: true
      });
      
      let foundCards = fuse.search(searchTerm).map(res => res.item);
      
      if (!foundCards || foundCards.length === 0) {
        const suggestion = fuse.search(searchTerm, { limit: 1 })[0]?.item.name ?? null;
        return message.reply(`🔍 Nenhuma carta encontrada com "${searchTerm}". Talvez você quis dizer: "${suggestion}"?`);
      }
      
      // Paginação
      const pageSize = 10;
      let page = 0;
      const totalPages = Math.ceil(foundCards.length / pageSize);
      
      // Função para criar embed
      const generateEmbed = (pageIndex) => {
        const start = pageIndex * pageSize;
        const currentCards = foundCards.slice(start, start + pageSize);
        
        const description = currentCards.map(c => {
          // Destacar trecho correspondente
          const regex = new RegExp(`(${searchTerm})`, "i");
          const highlightedName = c.name.replace(regex, "**$1**");
          
          return `[${c.index}] ${highlightedName} (Lv. ${c.level ?? "?"}) - ${c.type ?? "Sem tipo"} - ${c.rarity ?? "Comum"}`;
        }).join("\n");
        
        return new EmbedBuilder()
          .setTitle(`🔍 Resultados da busca por "${searchTerm}"`)
          .setDescription(description)
          .setFooter({ text: `Página ${pageIndex + 1}/${totalPages} | Use !card <index> ou !sell <index>` })
          .setColor("#FFD700");
      };
      
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("prev").setLabel("⬅️ Anterior").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("next").setLabel("Próximo ➡️").setStyle(ButtonStyle.Primary)
      );
      
      const sentMessage = await message.reply({
        embeds: [generateEmbed(page)],
        components: foundCards.length > pageSize ? [row] : [],
        allowedMentions: { repliedUser: false }
      });
      
      if (foundCards.length <= pageSize) return;
      
      const collector = sentMessage.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 180000 // 3 minutos de interação
      });
      
      collector.on("collect", i => {
        if (i.user.id !== message.author.id) return i.reply({ content: "❌ Apenas você pode interagir.", ephemeral: true });
        
        if (i.customId === "prev") page = page > 0 ? page - 1 : totalPages - 1;
        if (i.customId === "next") page = page < totalPages - 1 ? page + 1 : 0;
        
        i.update({ embeds: [generateEmbed(page)] });
      });
      
      collector.on("end", () => {
        sentMessage.edit({ components: [] }); // Remove botões quando acabar
      });
      
    } catch (err) {
      console.error("❌ Erro no comando search:", err);
      await message.reply("⚠️ Ocorreu um erro na busca.");
    }
  }
};