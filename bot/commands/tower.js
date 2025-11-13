// src/commands/tower.js
import { loadUser, saveUser } from "../../src/systems/economySystem.js";
import { climbTower } from "../../src/systems/towerSystem.js";

export default {
  name: "tower",
  description: "Suba a torre: batalhe e ganhe recompensas.",
  async execute(message, args) {
    const userId = message.author.id;
    const user = loadUser(userId);
    
    const subcommand = (args[0] || "climb").toLowerCase();
    
    if (subcommand === "climb") {
      const result = climbTower(user);
      saveUser(user);
      return message.reply(result);
    } else if (subcommand === "status") {
      const floor = user.tower?.currentFloor || 1;
      const attempts = user.tower?.attempts || 3;
      return message.reply(`🏰 Torre atual: andar ${floor}/120 | Tentativas restantes: ${attempts}`);
    } else {
      return message.reply("❌ Subcomando inválido. Use: climb, status.");
    }
  }
};