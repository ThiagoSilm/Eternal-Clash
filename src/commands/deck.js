// src/commands/deck.js
import { addCardToDeck, removeCardFromDeck, viewDeck } from "../systems/inventorySystem.js";

export function deckCommand(args) {
  const action = args[0];
  const index = parseInt(args[1]);
  const deckName = args[2] || "main";

  switch (action) {
    case "add":
      console.log(addCardToDeck("Player", index, deckName));
      break;
    case "remove":
      console.log(removeCardFromDeck("Player", index, deckName));
      break;
    case "view":
      console.log(viewDeck("Player", deckName));
      break;
    default:
      console.log("📘 Comandos disponíveis: !deck add <n> | remove <n> | view");
      break;
  }
}