// src/commands/setdeck.js

import { saveDeck, loadDeck, listDecks } from "../../src/systems/deckSystem.js";

export default {
  name: "setdeck",
  description: "Gerencie seus decks: salve, equipe e liste decks personalizados.",
  usage: "[save <nome> <idx1> <idx2>... | equip <nome> | list]",
  
  async execute(message, args, user) {
    const sub = (args[0] || "").toLowerCase();
    
    // Garantia de estrutura
    if (!user.decks) user.decks = {};
    if (!user.deck) user.deck = [];
    
    try {
      // -------------------------------------------------------
      // SALVAR DECK
      // -------------------------------------------------------
      if (sub === "save" || sub === "salvar") {
        const name = args[1];
        const indices = args.slice(2).map(n => parseInt(n));
        
        if (!name || indices.length === 0) {
          return message.reply(
            "❌ Uso correto: `!setdeck save <nome> <idx1> <idx2> ...`"
          );
        }
        
        if (name.length < 2 || name.length > 20) {
          return message.reply("❌ O nome do deck deve ter entre 2 e 20 caracteres.");
        }
        
        const result = saveDeck(user, name, indices);
        
        return message.reply({
          content: `💾 **${result}**`,
          allowedMentions: { repliedUser: false }
        });
      }
      
      // -------------------------------------------------------
      // EQUIPAR DECK
      // -------------------------------------------------------
      if (sub === "equip" || sub === "load" || sub === "usar") {
        const name = args[1];
        
        if (!name) {
          return message.reply("❌ Uso correto: `!setdeck equip <nome>`");
        }
        
        const result = loadDeck(user, name);
        
        return message.reply({
          content: `⚔️ ${result}`,
          allowedMentions: { repliedUser: false }
        });
      }
      
      // -------------------------------------------------------
      // LISTAR DECKS
      // -------------------------------------------------------
      if (sub === "list" || sub === "listar" || sub === "ls") {
        const result = listDecks(user);
        
        return message.reply({
          content: result,
          allowedMentions: { repliedUser: false }
        });
      }
      
      // -------------------------------------------------------
      // AJUDA
      // -------------------------------------------------------
      const help =
        "🗂️ **Comandos de Deck:**\n" +
        "`!setdeck save <nome> <idx1> ...` — Salva um deck com o nome especificado.\n" +
        "`!setdeck equip <nome>` — Equipa um deck salvo.\n" +
        "`!setdeck list` — Lista seus decks armazenados.";
      
      return message.reply({
        content: help,
        allowedMentions: { repliedUser: false }
      });
      
    } catch (err) {
      console.error("❌ Erro no comando setdeck:", err);
      
      const safeMsg =
        err?.message && typeof err.message === "string" ?
        err.message :
        "Ocorreu um erro ao gerenciar seus decks.";
      
      return message.reply({
        content: `⚠️ ${safeMsg}`,
        allowedMentions: { repliedUser: false }
      });
    }
  }
};