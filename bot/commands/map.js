// src/commands/mapa.js

import { visualizeMap, enterScene, getNextAvailableScenes } from "../../src/systems/mapSystem.js";

export default {
  name: "mapa",
  description: "Visualize o mapa ou entre em batalhas.",
  usage: "[visualizar | entrar <ID>]",

  async execute(message, args, user) {
    if (!user) {
      return message.reply("⚠️ Usuário não encontrado no sistema.");
    }

    const sub = (args[0] || "").toLowerCase();
    const sceneId = args[1];

    try {
      let reply;

      switch (sub) {
        // ----------------------------------------------------
        // VISUALIZAR MAPA
        // ----------------------------------------------------
        case "visualizar": {
          reply = visualizeMap(user);
          break;
        }

        // ----------------------------------------------------
        // ENTRAR EM BATALHA
        // ----------------------------------------------------
        case "entrar": {
          if (!sceneId) {
            return message.reply("❌ Informe o ID da cena que deseja entrar (ex: 1-1).");
          }

          const available = getNextAvailableScenes(user);
          if (!available.find(s => s.id === sceneId)) {
            return message.reply(
              "⚠️ Você ainda não pode acessar essa cena. Complete as anteriores primeiro."
            );
          }

          reply = await enterScene(user, sceneId);
          break;
        }

        // ----------------------------------------------------
        // DEFAULT / AJUDA
        // ----------------------------------------------------
        default: {
          reply =
            "🗺 **Comandos do Mapa**\n" +
            "━━━━━━━━━━━━━━\n" +
            "`!mapa visualizar` — Mostra o mapa atual com progresso.\n" +
            "`!mapa entrar <ID>` — Entra em batalha na cena especificada (ex: 1-1).\n";
        }
      }

      return message.reply({ content: reply, allowedMentions: { repliedUser: false } });
    } catch (err) {
      console.error(`❌ Erro no comando !mapa (${sub})`, err);
      const msg = err instanceof Error ? `⚠️ ${err.message}` : "⚠️ Erro interno ao processar o mapa.";
      return message.reply({ content: msg, allowedMentions: { repliedUser: false } });
    }
  }
};