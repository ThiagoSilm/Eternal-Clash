import { spinLucky } from "../../src/systems/luckySpinSystem.js";

export default {
  name: "luckyspin",
  description: "Gire a roda da sorte gastando gemas.",
  async execute(message) {
    try {
      const userId = message.author.id;
      const response = spinLucky(userId);
      
      if (!response || typeof response !== "string") {
        await message.reply("⚠️ Ocorreu um erro ao girar a roda. Tente novamente em alguns segundos.");
        return;
      }
      
      await message.reply({
        content: response,
        allowedMentions: { repliedUser: false }
      });
    } catch (err) {
      console.error("Erro em luckyspin:", err);
      await message.reply("❌ Houve um problema ao executar o comando `!luckyspin`.");
    }
  }
};