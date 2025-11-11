// src/commands/summon.js
import { loadUser, saveUser } from "../systems/economySystem.js";
import { summonCard, summonMultiple } from "../systems/summonSystem.js";

export function summonCommand(args) {
  const user = loadUser("Player");
  const type = args[0] || "gold";
  const count = parseInt(args[1]) || 1;
  
  let result;
  if (count > 1) result = summonMultiple(user, type, count);
  else result = summonCard(user, type);
  
  saveUser(user);
  console.log(result);
}