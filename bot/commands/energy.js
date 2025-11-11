import { getEnergyStatus } from "../../src/systems/energySystem.js";
import { getOrCreateUser } from "../../src/systems/userSystem.js"; // garante que o user exista

export default {
  name: "energy",
  description: "Verifique o status atual da sua energia.",
  async execute(message) {
    const userId = message.author.id;
    
    // garante que o usuário exista antes de consultar energia
    const user = getOrCreateUser(userId);
    
    try {
      const response = getEnergyStatus(user);
      await message.reply(response);
    } catch (err) {
      console.error("Erro ao checar energia:", err);
      await message.reply("⚠️ Ocorreu um erro ao verificar sua energia.");
    }
  }
};