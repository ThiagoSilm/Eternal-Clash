// src/commands/maze.js
import { loadUser, saveUser } from "../../src/systems/economySystem.js";
import { rollMaze, useGoldDice, resetMaze } from "../../src/systems/mazeSystem.js";

export default {
  name: "maze",
  description: "Jogue no Maze, role o dado, use Gold Dice ou resete o mapa.",
  async execute(message, args) {
    const userId = message.author.id;
    const user = loadUser(userId);
    
    const subcommand = (args[0] || "roll").toLowerCase();
    const mapId = parseInt(args[1]) || 2;
    
    if (subcommand === "roll") {
      const result = rollMaze(user, mapId);
      saveUser(user);
      return message.reply(result);
    }
    
    if (subcommand === "gold") {
      const targetHouse = parseInt(args[2]);
      if (!targetHouse) return message.reply("❌ Informe a casa alvo para usar o Gold Dice.");
      const result = useGoldDice(user, mapId, targetHouse);
      saveUser(user);
      return message.reply(result);
    }
    
    if (subcommand === "reset") {
      const result = resetMaze(user, mapId);
      saveUser(user);
      return message.reply(result);
    }
    
    return message.reply("❌ Subcomando inválido. Use: roll, gold, reset.");
  }
};