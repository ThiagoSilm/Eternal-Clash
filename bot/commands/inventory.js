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

export default {
  name: "inventory",
  description: "Gerencia suas cartas e decks.",
  usage: "[list [filtros] | deck [deckName] | add <idx> [deckName] | remove <idx> [deckName] | clear [deckName]]",
  
  async execute(message, args, user) {
    
    if (!user.cards) user.cards = [];
    if (!user.decks) user.decks = {};
    
    const subcommand = (args[0] || "list").toLowerCase();
    
    // ----------------------------------------------------------------------
    // LIST
    // ----------------------------------------------------------------------
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
      
      const lines = cards.map((c, i) => {
        const template = getCardTemplate(c.id);
        const effectsStr = (c.effects || []).join(', ');
        
        return `${i + 1}. ${template.name} (${template.rarity}★) Lv.${c.level} ${template.type === "guardian" ? "[Guardian]" : ""} — Efeitos: ${effectsStr || 'Nenhum'}`;
      });
      
      return message.reply(`📜 Seu inventário (${cards.length} cartas):\n${lines.join("\n")}`);
    }
    
    // ----------------------------------------------------------------------
    // VIEW DECK
    // ----------------------------------------------------------------------
    if (subcommand === "deck") {
      const deckName = args[1] || "main";
      const deckStr = viewDeck(user, deckName);
      return message.reply(deckStr);
    }
    
    // ----------------------------------------------------------------------
    // ADD
    // ----------------------------------------------------------------------
    if (subcommand === "add") {
      const index = parseInt(args[1]);
      const deckName = args[2] || "main";
      
      if (!index || index < 1 || index > user.cards.length)
        return message.reply("❌ Índice inválido.");
      
      const res = addCardToDeck(user, index, deckName);
      return message.reply(res);
    }
    
    // ----------------------------------------------------------------------
    // REMOVE
    // ----------------------------------------------------------------------
    if (subcommand === "remove") {
      const index = parseInt(args[1]);
      const deckName = args[2] || "main";
      
      if (!index)
        return message.reply("❌ Informe o número da carta para remover.");
      
      const res = removeCardFromDeck(user, index, deckName);
      return message.reply(res);
    }
    
    // ----------------------------------------------------------------------
    // CLEAR
    // ----------------------------------------------------------------------
    if (subcommand === "clear") {
      const deckName = args[1] || "main";
      
      removeAllFromDeck(user, deckName);
      return message.reply(`🗑️ Deck **${deckName}** limpo com sucesso.`);
    }
    
    // ----------------------------------------------------------------------
    // UPGRADE 
    // ----------------------------------------------------------------------
    if (subcommand === "upgrade") {
      return upgradeCommand.execute(message, args.slice(1), user);
    }
    
    // ----------------------------------------------------------------------
    // INVALID
    // ----------------------------------------------------------------------
    return message.reply("❌ Subcomando inválido. Use: list, deck, add, remove, clear.");
  }
};