// src/commands/cards.js
import { loadUser, saveUser } from "../systems/economySystem.js";
import { addCardXp, tryMeld } from "../systems/cardSystem.js";

export function evoluirCommand(args) {
  const user = loadUser("Player");
  const index = parseInt(args[0]);
  const xp = parseInt(args[1]) || 2000;

  if (isNaN(index) || !user.cards[index]) return console.log("❌ Índice de carta inválido.");

  const msg = addCardXp(user.cards[index], xp);
  saveUser(user);
  console.log(msg || `🧪 ${user.cards[index].name} ganhou ${xp} XP.`);
}

export function meldCommand(args) {
  const user = loadUser("Player");
  const cardIndex = parseInt(args[0]);
  const donorIndex = parseInt(args[1]);
  if (isNaN(cardIndex) || isNaN(donorIndex)) return console.log("❌ Use: !meld <carta> <doadora>");

  const msg = tryMeld(user, cardIndex, donorIndex);
  saveUser(user);
  console.log(msg);
}