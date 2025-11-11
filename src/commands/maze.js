// src/commands/maze.js
import { enterMaze, resetMaze } from "../systems/mazeSystem.js";

export function mazeCommand(args) {
  const action = args[0];
  
  switch (action) {
    case "rolar":
      console.log(enterMaze("Player"));
      break;
    case "resetar":
      console.log(resetMaze("Player"));
      break;
    default:
      console.log("🎲 Comandos do Maze:\n!maze rolar → Rolar o dado e explorar\n!maze resetar → Resetar o Maze");
  }
}