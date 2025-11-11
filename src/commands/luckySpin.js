import { spinLucky } from "../systems/luckySpinSystem.js";

export function luckySpinCommand(args) {
  const username = "Player"; // substituir pelo bot real
  console.log(spinLucky(username));
}