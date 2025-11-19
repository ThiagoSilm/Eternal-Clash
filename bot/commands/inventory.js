// src/commands/inventory.js

import {
  filterCards,
  viewDeck,
  addCardToDeck,
  removeCardFromDeck,
  removeAllFromDeck,
} from "../../src/systems/inventorySystem.js";

import { getCardTemplate } from "../../src/systems/cardSystem.js";
import upgradeCommand from "./upgrade.js";
import { EmbedBuilder } from "discord.js";

export default {
  name: "inventory",
  description: "Gerencia suas cartas e decks.",
  usage: "[list [filtros] | deck [deckName] | add <idx> [deckName] | remove <idx> [deckName] | clear [deckName]]",
  
  async execute(message, args, user) {
    
    if (!user.cards) user.cards = [];
    if (!user.decks) user.decks = {};
    
    const subcommand = (args[0] || "list").toLowerCase();
    
    // ======================================================
    // LIST
    // ======================================================
    if (subcommand === "list") {
      let filters = {};
      
      for (let i = 1; i < args.length; i += 2) {
        const key = args[i]?.toLowerCase();
        let value = args[i + 1];
        if (!key || value === undefined) continue;
        
        const v = String(value).toLowerCase();
        if (v === "true") value = true;
        else if (v === "false") value = false;
        else if (!isNaN(value)) value = Number(value);
        
        filters[key] = value;
      }
      
      let cards = user.cards;
      
      if (Object.keys(filters).length > 0) {
        cards = filterCards(cards, filters);
      }
      
      if (cards.length === 0) {
        return message.reply("⚠️ Nenhuma carta encontrada com os filtros aplicados.");
      }
      
      const embed = new EmbedBuilder()
        .setTitle(`📜 Inventário — ${cards.length} cartas`)
        .setColor("#4a90e2")
        .setDescription(
          cards
          .map((c, i) => {
            const template = getCardTemplate(c.id);
            const effectsStr = (c.effects || []).join(', ') || "Nenhum";
            return `**${i + 1}. ${template.name}** — ${template.rarity}★ — Lv.${c.level}\n*Efeitos:* ${effectsStr}`;
          })
          .join("\n\n")
        );
      
      return message.reply({ embeds: [embed] });
    }
    
    // ======================================================
    // VIEW DECK
    // ======================================================
    if (subcommand === "deck") {
      const deckName = args[1] || "main";
      const deckStr = viewDeck(user, deckName);
      
      const embed = new EmbedBuilder()
        .setTitle(`🃏 Deck — ${deckName}`)
        .setColor("#9b59b6")
        .setDescription(deckStr);
      
      return message.reply({ embeds: [embed] });
    }
    
    // ======================================================
    // ADD
    // ======================================================
    if (subcommand === "add") {
      const index = parseInt(args[1]);
      const deckName = args[2] || "main";
      
      if (!index || index < 1 || index > user.cards.length)
        return message.reply("❌ Índice inválido.");
      
      const res = addCardToDeck(user, index, deckName);
      
      const embed = new EmbedBuilder()
        .setTitle("➕ Carta adicionada ao deck")
        .setColor("#2ecc71")
        .setDescription(res);
      
      return message.reply({ embeds: [embed] });
    }
    
    // ======================================================
    // REMOVE
    // ======================================================
    if (subcommand === "remove") {
      const index = parseInt(args[1]);
      const deckName = args[2] || "main";
      
      if (!index)
        return message.reply("❌ Informe o número da carta para remover.");
      
      const res = removeCardFromDeck(user, index, deckName);
      
      const embed = new EmbedBuilder()
        .setTitle("➖ Carta removida do deck")
        .setColor("#e74c3c")
        .setDescription(res);
      
      return message.reply({ embeds: [embed] });
    }
    
    // ======================================================
    // CLEAR
    // ======================================================
    if (subcommand === "clear") {
      const deckName = args[1] || "main";
      
      removeAllFromDeck(user, deckName);
      
      const embed = new EmbedBuilder()
        .setTitle("🗑️ Deck limpo")
        .setColor("#f1c40f")
        .setDescription(`Deck **${deckName}** foi completamente limpo.`);
      
      return message.reply({ embeds: [embed] });
    }
    
    // ======================================================
    // UPGRADE
    // ======================================================
    if (subcommand === "upgrade") {
      return upgradeCommand.execute(message, args.slice(1), user);
    }
    
    // ======================================================
    // INVALID
    // ======================================================
    const embed = new EmbedBuilder()
      .setTitle("❌ Subcomando inválido")
      .setColor("#e74c3c")
      .setDescription(
        "Use um dos subcomandos válidos:\n`list`, `deck`, `add`, `remove`, `clear`, `upgrade`"
      );
    
    return message.reply({ embeds: [embed] });
  }
};