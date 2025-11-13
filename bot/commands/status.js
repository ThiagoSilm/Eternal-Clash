// src/commands/status.js

// 🚨 CORREÇÃO: Removemos loadUser, pois o objeto 'user' será recebido como argumento.
// Certifique-se de que os sistemas abaixo não dependem de loadUser internamente,
// e sim do objeto 'user' ou do 'userId' passado.
import { getEnergyStatus } from "../src/systems/energySystem.js";
import { viewDeck } from "../src/systems/inventorySystem.js";
import { getDailyStatus } from "../src/systems/dailySystem.js";

export default {
  name: "status",
  description: "Mostra o status completo do jogador.",
  
  // ⚠️ ATENÇÃO: O objeto 'user' é recebido aqui, já carregado e em cache.
  async execute(message, args, user) {
    try {
      // 1. Não precisa de loadUser(userId) e a checagem de !user (o middleware garante o usuário)
      
      const userId = message.author.id;
      const username = message.author.username;
      
      // 2. Chamadas de Status (usando userId ou user, dependendo do design do sistema)
      
      // Assumindo que energySystem e dailySystem precisam apenas do ID:
      const energyStatus = getEnergyStatus(userId); 
      const dailyStatus = getDailyStatus(userId);
      
      // Assumindo que viewDeck é uma função auxiliar que usa o objeto 'user':
      // Se viewDeck precisa do userId para carregamento interno: viewDeck(userId, "main")
      // Se viewDeck opera no objeto user (mais limpo):
      const deckView = viewDeck(user, "main") || "Nenhuma carta no deck."; 
      
      // 3. Montagem da Resposta
      const response = `
📊 **Status de ${username}**

---
💎 **Nível:** ${user.level || 1}  
⭐ **XP:** ${user.xp || 0}  
💰 **Ouro:** ${user.gold || 0}  
⚡ **Energia:** ${energyStatus}

---
🃏 **Deck Principal:** ${deckView}

---
🎁 **Eventos Diários:** ${dailyStatus}
`;
      
      await message.reply({ 
          content: response, 
          // Melhoria: Não menciona o usuário que digitou o comando
          allowedMentions: { repliedUser: false } 
      });

      // Não precisa de markUserDirty, pois este comando é apenas leitura.
      
    } catch (err) {
      console.error("❌ Erro em !status:", err);
      await message.reply("❌ Ocorreu um erro ao tentar exibir seu status.");
    }
  }
};
