// src/commands/guardian.js

import {
  filterCards,
  addCardToDeck,
  removeCardFromDeck
} from "../../src/systems/inventorySystem.js";

import { getCardTemplate } from "../../src/systems/cardSystem.js";
import { getCardByUniqueId } from "../../src/systems/userSystem.js";

export default {
  name: "guardian",
  description: "Visualize, selecione ou organize seus guardiões.",
  usage: "[list | select <n> | info | deck [nome] | remove [nome]]",
  
  async execute(message, args, user) {
    
    if (!user.cards || user.cards.length === 0)
      return message.reply("📦 Você não possui cartas.");
    
    const action = args[0]?.toLowerCase();
    
    // ---------------- UTILS ----------------
    const getSelectedGuardian = () => {
      if (!user.selectedGuardian) return null;
      return user.cards.find(c => c.uniqueId === user.selectedGuardian) || null;
    };
    // ---------------------------------------
    
    // ---------------- LIST -----------------
    if (!action || action === "list") {
      
      const guardians = filterCards(user.cards, { type: "guardian" });
      
      if (guardians.length === 0)
        return message.reply("⚠️ Nenhum guardião disponível.");
      
      const list = guardians.map((c, i) => {
        const template = getCardTemplate(c.id);
        const selected = (c.uniqueId === user.selectedGuardian) ? " (SELECIONADO)" : "";
        return `${i + 1}. ${template.name} — Lv.${c.level} (${template.rarity}★)${selected}`;
      }).join("\n");
      
      return message.reply(`🛡️ Guardiões (${guardians.length} encontrados):\n${list}`);
    }
    
    // --------------- SELECT ----------------
    if (action === "select") {
      const index = parseInt(args[1]);
      if (isNaN(index) || index < 1)
        return message.reply("❌ Informe o número do guardião para selecionar.");
      
      const guardians = filterCards(user.cards, { type: "guardian" });
      const selected = guardians[index - 1];
      
      if (!selected)
        return message.reply("❌ Guardião inválido.");
      
      user.selectedGuardian = selected.uniqueId;
      
      return message.reply(`✅ Guardião **${getCardTemplate(selected.id).name}** selecionado!`);
    }
    
    // ---------------- INFO -----------------
    if (action === "info") {
      const selected = getSelectedGuardian();
      if (!selected)
        return message.reply("⚠️ Nenhum guardião selecionado. Use `!guardian select [n]`.");
      
      const template = getCardTemplate(selected.id);
      
      // Usa efeitos da carta, senão do template
      const effectList = (selected.effects?.length ? selected.effects : template.effects)
        ?.map(e => `- [${e}] — descrição do efeito`)
        .join("\n") || "Nenhum efeito base.";
      
      let msg =
        `🛡️ **${template.name}** — Lv.${selected.level} (${template.rarity}★)\n` +
        `❤️ HP: ${selected.hp || template.hp || "N/A"}\n\n` +
        `🎯 **Efeitos:**\n${effectList}`;
      
      if (template.evolutionEffectId) {
        msg += `\n\n💥 **Evolução:** [${template.evolutionEffectId}]`;
      }
      
      return message.reply(msg);
    }
    
    // ---------------- DECK -----------------
    if (action === "deck") {
      const deckName = args[1] || "main";
      const selected = getSelectedGuardian();
      
      if (!selected) return message.reply("⚠️ Nenhum guardião selecionado.");
      
      const idx = user.cards.findIndex(c => c.uniqueId === selected.uniqueId) + 1;
      
      const res = addCardToDeck(user, idx, deckName);
      return message.reply(res);
    }
    
    // --------------- REMOVE ----------------
    if (action === "remove") {
      const deckName = args[1] || "main";
      const selected = getSelectedGuardian();
      
      if (!selected) return message.reply("⚠️ Nenhum guardião selecionado.");
      
      const deck = user.decks?.[deckName];
      if (!deck || deck.length === 0)
        return message.reply("⚠️ O deck está vazio.");
      
      // Suporte universal: uniqueId ou objeto
      const indexInDeck = deck.findIndex(slot =>
        slot?.uniqueId === selected.uniqueId || slot === selected.uniqueId
      );
      
      if (indexInDeck === -1)
        return message.reply("⚠️ O guardião não está no deck.");
      
      const res = removeCardFromDeck(user, indexInDeck + 1, deckName);
      return message.reply(res);
    }
    
    return message.reply("❌ Comando inválido. Use: `list`, `select [n]`, `info`, `deck [nome]`, `remove [nome]`");
  }
};