import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import {
  visualizeMap,
  enterScene,
  getNextAvailableScenes,
  MAP_PHASES,
  initUserMapProgress,
  openChest
} from "../../src/systems/mapSystem.js";

const BUTTONS_PER_ROW = 5;

export default {
  name: "mapa",
  description: "Visualize o mapa ou entre em fases de forma interativa.",
  
  async execute(message, args, user) {
    if (!user) return message.reply("⚠️ Usuário não encontrado no sistema.");
    initUserMapProgress(user);
    
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
    
    const embed = new EmbedBuilder()
      .setTitle(`🗺 Mapa — Página ${page + 1}`)
      .setDescription(visualizeMap(user))
      .setColor("#00FF00")
      .setFooter({ text: "🎯 Disponível | ✅ Completo | ⭐ Estrelas | 🗝 Baú disponível | ❔ Não descoberto" });
    
    // Paginação de fases
    const start = page * BUTTONS_PER_ROW;
    const end = start + BUTTONS_PER_ROW;
    const slice = availableScenes.slice(start, end);
    
    const rows = [];
    if (slice.length) {
      const row = new ActionRowBuilder();
      slice.forEach(scene => {
        const stars = user.mapProgress.stars[scene.id] || 0;
        row.addComponents(
          new ButtonBuilder()
          .setCustomId(`enter_scene_${scene.id}`)
          .setLabel(`${scene.id} ${stars ? "⭐".repeat(stars) : ""}`)
          .setStyle(ButtonStyle.Primary)
        );
      });
      rows.push(row);
    }
    
    // Botões de baú
    MAP_PHASES.forEach(phase => {
      const opened = user.mapProgress.openedChests[phase.id] || 0;
      if (opened < 3) {
        const row = new ActionRowBuilder();
        row.addComponents(
          new ButtonBuilder()
          .setCustomId(`open_chest_${phase.id}`)
          .setLabel(`🗝 Baú Fase ${phase.id} (${opened}/3)`)
          .setStyle(ButtonStyle.Success)
        );
        rows.push(row);
      }
    });
    
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
    
    // Entrar em uma fase
    if (cid.startsWith("enter_scene_")) {
      const stageId = cid.replace("enter_scene_", "");
      const result = await enterScene(user, stageId);
      await this.sendMapPage(interaction, user, 0);
      return interaction.followUp({ content: result, ephemeral: true });
    }
    
    // Abrir baú
    if (cid.startsWith("open_chest_")) {
      const phaseId = parseInt(cid.replace("open_chest_", ""));
      const result = openChest(user, phaseId);
      await this.sendMapPage(interaction, user, 0);
      return interaction.followUp({ content: result, ephemeral: true });
    }
    
    // Paginação
    if (cid.startsWith("map_next_") || cid.startsWith("map_prev_")) {
      const page = parseInt(cid.split("_")[2]);
      await this.sendMapPage(interaction, user, page);
    }
  }
};