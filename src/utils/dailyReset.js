// src/utils/dailyReset.js
import { loadUser, saveUser } from "../systems/economySystem.js";

export function dailyReset(username) {
  const user = loadUser(username);
  const today = new Date().toDateString();
  
  if (user.lastReset === today) return;
  
  user.lastReset = today;
  if (user.tower) user.tower = { currentFloor: 1, completed: [] };
  saveUser(user);
  console.log("🕛 Reset diário concluído para " + username);
}