import { loadUser, saveUser } from "../../src/systems/economySystem.js";
import { summonCard, summonMultiple } from "../../src/systems/summonSystem.js";

export default {
  name: "summon",
  description: "Invoca cartas pelo altar com ouro, cupom ou gemas.",
  async execute(message, args) {
    const userId = message.author.id;
    const user = loadUser(userId);
    
    const validTypes = ["gold", "gem", "coupon"];
    const type = (args[0] || "gold").toLowerCase();
    
    if (!validTypes.includes(type)) {
      await message.reply("❌ Tipo inválido. Use: gold, gem ou coupon.");
      return;
    }
    
    let count = parseInt(args[1]) || 1;
    if (count < 1) count = 1;
    if (count > 10) count = 10; // limite para evitar spam
    
    let result = count > 1 ?
      summonMultiple(user, type, count) :
      summonCard(user, type);
    
    saveUser(user);
    
    await message.reply(result);
  }
};