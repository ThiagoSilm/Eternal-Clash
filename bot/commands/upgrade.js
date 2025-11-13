// src/commands/upgrade.js
import { loadUser, saveUser } from "../../src/systems/economySystem.js";
import { getCardTemplate } from "../../src/systems/cardSystem.js";
import { levelUpCard, burnCardForXP } from "../../src/systems/xpSystem.js";
import {
  filterCards,
} from "../../src/systems/inventorySystem.js";

export default {
  name: "upgrade",
  description: "Upa cartas usando outras cartas e ouro.",
  async execute(message, args) {
    const userId = message.author.id;
    const user = loadUser(userId);
    
    if (!args[0]) return message.reply("❌ Informe o número da carta que deseja upar.");
    
    const mainIndex = parseInt(args[0]);
    const mainCard = user.cards[mainIndex - 1];
    if (!mainCard) return message.reply("❌ Carta principal inválida.");
    
    if (mainCard.isGuardian) return message.reply("⚠️ Guardiões não podem ser upados.");
    
    // Cartas para sacrificar
    const sacrificeIndexes = args.slice(1).map(n => parseInt(n) - 1);
    if (sacrificeIndexes.includes(mainIndex - 1)) return message.reply("⚠️ Não pode usar a própria carta para upgrade.");
    
    const sacrifices = sacrificeIndexes
      .map(i => user.cards[i])
      .filter(c => c && !c.isGuardian);
    
    if (sacrifices.length === 0) return message.reply("⚠️ Nenhuma carta válida para usar como XP.");
    
    let totalXP = 0;
    let totalGold = 0;
    
    // Calcula XP e ouro
    for (const card of sacrifices) {
      totalXP += burnCardForXP(card);
      totalGold += Math.floor(card.level * 100); // custo gradual, exemplo: 100 ouro por nível da carta sacrificada
    }
    
    if (user.gold < totalGold) return message.reply(`💰 Ouro insuficiente. Precisa de ${totalGold} ouro.`);
    
    // Remove ouro e cartas sacrificadas
    user.gold -= totalGold;
    user.cards = user.cards.filter(c => !sacrifices.includes(c));
    
    // Adiciona XP à carta principal
    mainCard.xp = (mainCard.xp || 0) + totalXP;
    
    // Tenta upar a carta
    const result = levelUpCard(user, mainCard.uniqueId);
    
    saveUser(user);
    return message.reply(`✨ Upgrade concluído! ${result.message}\n💰 Ouro gasto: ${totalGold}`);
  }
};