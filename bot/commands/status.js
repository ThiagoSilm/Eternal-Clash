import { loadUser } from "../../src/systems/economySystem.js";
import { getEnergyStatus } from "../../src/systems/energySystem.js";
import { viewDeck } from "../../src/systems/inventorySystem.js";
import { getDailyStatus } from "../../src/systems/dailySystem.js";

export default {
  name: "status",
  description: "Mostra o status completo do jogador.",
  async execute(message, args) {
    try {
      const userId = message.author.id;
      const user = loadUser(userId);
      
      if (!user) {
        await message.reply("❌ Usuário não encontrado.");
        return;
      }
      
      const username = message.author.username;
      const energyStatus = getEnergyStatus(userId);
      const deckView = viewDeck(userId, "main") || "Nenhuma carta no deck.";
      const dailyStatus = getDailyStatus(userId);
      
      const response = `
📊 **Status de ${username}**

💎 **Nível:** ${user.level || 1}  
⭐ **XP:** ${user.xp || 0}  
💰 **Ouro:** ${user.gold || 0}  
⚡ **Energia:** ${energyStatus}

🃏 **Deck Principal:**  
${deckView}

🎁 **Eventos Diários:**  
${dailyStatus}
`;
      
      await message.reply({ content: response, allowedMentions: { repliedUser: false } });
    } catch (err) {
      console.error("Erro em !status:", err);
      await message.reply("❌ Ocorreu um erro ao tentar exibir seu status.");
    }
  }
};