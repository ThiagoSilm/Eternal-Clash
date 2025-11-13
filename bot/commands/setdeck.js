// src/commands/setdeck.js

import { saveDeck, loadDeck, listDecks } from "../src/systems/deckSystem.js";

export default {
  name: "setdeck",
  description: "Gerencie e alterne rapidamente entre seus decks salvos.",
  usage: "[save <nome> <idx1> <idx2> <idx3>... | equip <nome> | list]",
  
  async execute(message, args, user) {
    const sub = args[0]?.toLowerCase();
    
    // Garante que o campo de decks exista no usuário
    if (!user.decks) user.decks = {};
    
    try {
      switch (sub) {
        case "save":
          // 1. SALVAR DECK
          const deckName = args[1];
          const cardIndices = args.slice(2).map(n => parseInt(n));

          if (!deckName || cardIndices.length === 0) {
            return message.reply("❌ Use: `!setdeck save <nome> <idx1> <idx2>...`");
          }
          
          // A função saveDeck lida com validação de índices, limites de deck, e salva no user.decks
          const saveResult = saveDeck(user, deckName, cardIndices);
          
          // O objeto 'user' foi modificado por saveDeck. O index.js fará o salvamento.
          return message.reply(`💾 ${saveResult}`);

        case "equip":
        case "load":
          // 2. CARREGAR/EQUIPAR DECK
          const nameToLoad = args[1];
          
          if (!nameToLoad) {
            return message.reply("❌ Use: `!setdeck equip <nome>`");
          }

          // A função loadDeck carrega a configuração salva para o deck ativo do usuário
          const loadResult = loadDeck(user, nameToLoad);
          
          // O objeto 'user' foi modificado por loadDeck. O index.js fará o salvamento.
          return message.reply(`⚔️ ${loadResult}`);
          
        case "list":
          // 3. LISTAR DECKS
          const listResult = listDecks(user);
          return message.reply(listResult);
          
        default:
          return message.reply(
            "📝 **Comandos de Deck:**\n" +
            "`!setdeck save <nome> <idx1>...` — Salva o deck ativo com o nome dado.\n" +
            "`!setdeck equip <nome>` — Carrega um deck salvo para uso imediato.\n" +
            "`!setdeck list` — Lista seus decks salvos."
          );
      }
      
    } catch (err) {
      console.error("❌ Erro no comando setdeck:", err);
      // O sistema deve lançar mensagens amigáveis em caso de erro.
      await message.reply(`⚠️ Ocorreu um erro ao gerenciar seu deck. ${err.message || ''}`);
    }
  }
};
