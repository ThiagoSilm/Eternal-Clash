// src/commands/inventory.js
import { loadUser, saveUser } from "../../src/systems/economySystem.js";
import {
  listInventory,
  filterCards,
  viewDeck,
  addCardToDeck,
  removeCardFromDeck,
  removeAllFromDeck,
  upgradeCard
} from "../../src/systems/inventorySystem.js";
import { getCardTemplate } from "../../src/systems/cardSystem.js";

export default {
  name: "inventory",
  description: "Gerencia suas cartas e decks.",
  async execute(message, args) {
    const userId = message.author.id;
    const user = loadUser(userId);
    
    const subcommand = (args[0] || "list").toLowerCase();
    
    // -------------------- LISTAR cartas --------------------
    if (subcommand === "list") {
      let filters = {};
      for (let i = 1; i < args.length; i += 2) {
        const key = args[i]?.toLowerCase();
        let value = args[i + 1];
        if (!key || !value) continue;
        
        // converte "true"/"false" para boolean
        if (value.toLowerCase() === "true") value = true;
        else if (value.toLowerCase() === "false") value = false;
        else if (!isNaN(value)) value = Number(value);
        
        filters[key] = value;
      }
      
      let cards = Object.values(user.cards || []);
      if (Object.keys(filters).length > 0) cards = filterCards(user, filters);
      if (cards.length === 0) return message.reply("⚠️ Nenhuma carta encontrada com esses filtros.");
      
      const lines = cards.map((c, i) => {
        const template = getCardTemplate(c.id);
        const effects = template.effects
          .map((e, idx) => `${idx + 1}:${e.unlocked ? "✔️" : "❌"} ${e.name}`)
          .join(" | ");
        return `${i + 1}. ${template.name} (${c.rarity}★) Lv.${c.level} ${c.isGuardian ? "[Guardian]" : ""} — Efeitos: ${effects} — Source: ${template.source}`;
      });
      
      return message.reply(`📜 Seu inventário:\n${lines.join("\n")}`);
    }
    
    // -------------------- VISUALIZAR deck --------------------
    if (subcommand === "deck") {
      const deckName = args[1] || "main";
      const deckStr = viewDeck(user, deckName);
      return message.reply(deckStr);
    }
    
    // -------------------- ADICIONAR carta ao deck --------------------
    if (subcommand === "add") {
      const index = parseInt(args[1]);
      const deckName = args[2] || "main";
      if (!index) return message.reply("❌ Informe o número da carta para adicionar.");
      const res = addCardToDeck(user, index, deckName);
      saveUser(user);
      return message.reply(res);
    }
    
    // -------------------- REMOVER carta do deck --------------------
    if (subcommand === "remove") {
      const index = parseInt(args[1]);
      const deckName = args[2] || "main";
      if (!index) return message.reply("❌ Informe o número da carta para remover.");
      const res = removeCardFromDeck(user, index, deckName);
      saveUser(user);
      return message.reply(res);
    }
    
    // -------------------- REMOVER TODAS do deck --------------------
    if (subcommand === "clear") {
      const deckName = args[1] || "main";
      const res = removeAllFromDeck(user, deckName);
      saveUser(user);
      return message.reply(`🗑️ Todas as cartas do deck ${deckName} foram removidas.`);
    }
    
    // -------------------- UPGRADAR carta --------------------
    if (subcommand === "upgrade") {
      const index = parseInt(args[1]);
      if (!index) return message.reply("❌ Informe o número da carta para upar.");
      
      // seleciona cartas para sacrificar, separadas por vírgula
      const sacrificeIndices = args[2]?.split(",").map(i => parseInt(i.trim())).filter(Boolean) || [];
      const result = upgradeCard(user, index, sacrificeIndices);
      
      saveUser(user);
      return message.reply(result.message);
    }
    
    return message.reply("❌ Subcomando inválido. Use: list, deck, add, remove, clear, upgrade.");
  }
};