// src/commands/status.js

import { getEnergyStatus } from "../systems/energySystem.js";
import { viewDeck } from "../systems/inventorySystem.js";
import { getDailyStatus } from "../systems/dailySystem.js";

export default {
  name: "status",
  description: "Mostra o status completo do jogador.",
  usage: "[status]",
  
  async execute(message, args, user) {
    try {
      const userId = message.author.id;
      const username = message.author.username;
      
      // ---------------------------------------
      // 1. STATUS DE ENERGIA
      // ---------------------------------------
      let energyStatus = "⚠️ Sistema de energia indisponível.";
      try {
        energyStatus = getEnergyStatus(userId) ?? "⚠️ (indefinido)";
      } catch {
        /* Evita crash se o sistema não existir */
      }
      
      // ---------------------------------------
      // 2. STATUS DIÁRIO
      // ---------------------------------------
      let dailyStatus = "⚠️ Sistema diário indisponível.";
      try {
        dailyStatus = getDailyStatus(userId) ?? "⚠️ (indefinido)";
      } catch {
        /* idem */
      }
      
      // ---------------------------------------
      // 3. DECK
      // ---------------------------------------
      let deckStatus = "Nenhuma carta no deck.";
      try {
        const deck = viewDeck(user, "main");
        deckStatus = deck || "Nenhuma carta no deck.";
      } catch {
        /* se der erro, não crasha */
      }
      
      // ---------------------------------------
      // 4. MONTA MENSAGEM
      // ---------------------------------------
      const response =
        `📊 **Status de ${username}**

**📈 Nível:** ${user.level ?? 1}  
**⭐ XP:** ${user.xp ?? 0}  
**💰 Ouro:** ${user.gold ?? 0}  
**⚡ Energia:** ${energyStatus}

---

🃏 **Deck Principal:**  
${deckStatus}

---

🎁 **Status Diário:**  
${dailyStatus}
`;
      
      await message.reply({
        content: response,
        allowedMentions: { repliedUser: false }
      });
      
    } catch (err) {
      console.error("❌ Erro no comando !status:", err);
      await message.reply("❌ Ocorreu um erro ao exibir seu status.");
    }
  }
};