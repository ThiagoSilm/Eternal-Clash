// src/commands/mapa.js
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { visualizeMap, enterScene, getNextAvailableScenes, mapScenes } from "../../src/systems/mapSystem.js";

const BUTTONS_PER_ROW = 5;
const ROWS_PER_PAGE = 2;

export default {
  name: "mapa",
  description: "Visualize o mapa ou entre em batalhas de forma interativa.",
  usage: "[visualizar]",
  
  async execute(message, args, user) {
    if (!user) return message.reply("⚠️ Usuário não encontrado no sistema.");
    
    try {
      await this.sendMapPage(message, user, 0);
    } catch (err) {
      console.error("❌ Erro no comando !mapa", err);
      return message.reply({ content: err instanceof Error ? `⚠️ ${err.message}` : "⚠️ Erro interno." });
    }
  },
  
  // -----------------------------
  // Envia uma página do mapa
  // -----------------------------
  async sendMapPage(messageOrInteraction, user, page) {
    const availableScenes = getNextAvailableScenes(user);
    const mapData = mapScenes; // usa todos os cenários para o embed
    
    // Criar embed
    const embed = new EmbedBuilder()
      .setTitle(`🗺 Mapa — Página ${page + 1}`)
      .setDescription(
        mapData
        .map(scene => {
          const id = scene.id;
          if (!user.mapProgress.discovered.includes(id)) return "❔";
          if (user.mapProgress.completed.includes(id)) return "✅";
          if (availableScenes.some(x => x.id === id)) return "🎯";
          return scene.type === "elite" ? "🔥" : scene.type === "boss" ? "💀" : "⬜";
        })
        .join(" ")
      )
      .setColor("#00FF00")
      .setFooter({ text: "🎯 Disponível | 🔥 Elite | 💀 Boss | ❔ Não descoberto | ✅ Concluído" });
    
    // Cria botões paginados
    const start = page * BUTTONS_PER_ROW * ROWS_PER_PAGE;
    const end = start + BUTTONS_PER_ROW * ROWS_PER_PAGE;
    const slice = availableScenes.slice(start, end);
    
    const rows = [];
    for (let i = 0; i < slice.length; i += BUTTONS_PER_ROW) {
      const row = new ActionRowBuilder();
      slice.slice(i, i + BUTTONS_PER_ROW).forEach(scene => {
        row.addComponents(
          new ButtonBuilder()
          .setCustomId(`enter_scene_${scene.id}`)
          .setLabel(scene.id)
          .setStyle(ButtonStyle.Primary)
        );
      });
      rows.push(row);
    }
    
    // Botões de navegação
    if (availableScenes.length > end) {
      rows.push(new ActionRowBuilder().addComponents(
        new ButtonBuilder()
        .setCustomId(`map_next_${page + 1}`)
        .setLabel("➡ Próxima")
        .setStyle(ButtonStyle.Secondary)
      ));
    }
    if (page > 0) {
      rows.push(new ActionRowBuilder().addComponents(
        new ButtonBuilder()
        .setCustomId(`map_prev_${page - 1}`)
        .setLabel("⬅ Anterior")
        .setStyle(ButtonStyle.Secondary)
      ));
    }
    
    if (messageOrInteraction.replied || messageOrInteraction.deferred) {
      await messageOrInteraction.edit({ embeds: [embed], components: rows });
    } else {
      await messageOrInteraction.reply({ embeds: [embed], components: rows });
    }
  },
  
  // -----------------------------
  // Handler de interações
  // -----------------------------
  async handleInteraction(interaction, user) {
    if (!interaction.isButton()) return;
    const cid = interaction.customId;
    
    // Entrar na cena
    if (cid.startsWith("enter_scene_")) {
      const sceneId = cid.replace("enter_scene_", "");
      const available = getNextAvailableScenes(user);
      
      if (!available.find(s => s.id === sceneId)) {
        return interaction.reply({ content: "⚠️ Cena não disponível.", ephemeral: true });
      }
      
      const result = await enterScene(user, sceneId);
      await this.sendMapPage(interaction, user, 0); // atualiza mapa
      return interaction.followUp({ content: result, ephemeral: true });
    }
    
    // Paginação
    if (cid.startsWith("map_next_") || cid.startsWith("map_prev_")) {
      const page = parseInt(cid.split("_")[2]);
      await this.sendMapPage(interaction, user, page);
    }
  }
};