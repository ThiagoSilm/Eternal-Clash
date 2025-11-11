import {
  addCardToDeck,
  removeCardFromDeck,
  viewDeck
} from "../../src/systems/inventorySystem.js";

import { saveUser } from "../../src/systems/userSystem.js";

export default {
  name: "deck",
  description: "Gerencie seu deck de cartas.",
  
  async execute(message, args, user) {
    const action = args[0];
    const index = parseInt(args[1]);
    const deckName = args[2] || "main";
    let response = "";
    
    switch (action) {
      case "add":
        response = addCardToDeck(user, index, deckName);
        break;
        
      case "remove":
        response = removeCardFromDeck(user, index, deckName);
        break;
        
      case "view":
        response = viewDeck(user, deckName);
        break;
        
      default:
        response =
          "📘 **Comandos de Deck:**\n" +
          "`!deck add <índice>` — Adiciona uma carta ao deck\n" +
          "`!deck remove <índice>` — Remove uma carta do deck\n" +
          "`!deck view [nomeDeck]` — Mostra as cartas do deck";
    }
    
    // Garante que as alterações persistam
    saveUser(user);
    
    await message.reply(response);
  }
};