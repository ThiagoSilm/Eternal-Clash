import { addCardXp, tryMeld } from "../../src/systems/cardSystem.js";
import { saveUser } from "../../src/systems/userSystem.js"; // ajusta conforme o nome do arquivo que salva os dados

export default {
  name: "cards",
  description: "Comandos de evolução e fusão (meld) de cartas.",
  
  async execute(message, args, user) {
    const sub = args[0];
    let response = "";
    
    switch (sub) {
      // 🔹 Evoluir carta
      case "evoluir": {
        const index = parseInt(args[1]);
        const xp = parseInt(args[2]) || 2000;
        
        if (isNaN(index) || !user.cards[index]) {
          response = "❌ Índice de carta inválido.";
        } else {
          const msg = addCardXp(user.cards[index], xp);
          saveUser(user);
          response = msg || `🧪 ${user.cards[index].name} ganhou ${xp} XP.`;
        }
        break;
      }
      
      // 🔹 Realizar meld (transferência de efeito)
      case "meld": {
        const cardIndex = parseInt(args[1]);
        const donorIndex = parseInt(args[2]);
        
        if (isNaN(cardIndex) || isNaN(donorIndex)) {
          response = "❌ Uso correto: `!cards meld <carta> <doadora>`";
        } else if (!user.cards[cardIndex] || !user.cards[donorIndex]) {
          response = "⚠️ Uma das cartas informadas não existe.";
        } else {
          const msg = tryMeld(user, cardIndex, donorIndex);
          saveUser(user);
          response = msg;
        }
        break;
      }
      
      // 🔹 Ajuda do comando
      default:
        response = "🃏 **Comandos de Cartas:**\n" +
          "`!cards evoluir <índice> [XP]` — Adiciona XP à carta.\n" +
          "`!cards meld <índiceCarta> <índiceDoadora>` — Tenta fundir efeitos entre cartas.";
    }
    
    await message.reply(response);
  }
};