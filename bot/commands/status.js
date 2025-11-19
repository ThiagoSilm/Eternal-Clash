import { getEnergyStatus } from "../../src/systems/energySystem.js";
import { viewDeck } from "../../src/systems/inventorySystem.js";
import { getDailyStatus } from "../../src/systems/dailySystem.js";
import { EmbedBuilder } from "discord.js";

// Simplifica a barra de XP com cores mais legíveis
function createSimpleXPBar(current, max, size = 10) {
  const ratio = Math.min(current / max, 1);
  const filled = Math.round(ratio * size);
  const empty = size - filled;
  
  const filledChar = "🟦";
  const emptyChar = "⬜";
  
  return filledChar.repeat(filled) + emptyChar.repeat(empty);
}

// Simplifica a barra de energia
function createSimplifiedEnergyBar(current = 0, max = 10, size = 10) {
  current = Number(current) || 0;
  max = Number(max) || 1;
  
  const ratio = Math.min(current / max, 1);
  const filled = Math.round(ratio * size);
  const empty = size - filled;
  
  const filledChar = "⚡";
  const emptyChar = "⚪";
  
  const bar = filledChar.repeat(filled) + emptyChar.repeat(empty);
  return bar + ` (${current}/${max})`;
}

// Formata o deck para um resumo mais limpo, focando no Guardião
function formatDeckSummary(deck) {
  // O check inicial aqui já é suficiente se garantirmos que 'deck' é um array no 'execute'
  if (!deck || deck.length === 0) return "Nenhuma carta equipada.";
  
  const totalCards = deck.length;
  // Esta linha (deck.find) era a fonte do erro se deck não fosse um array
  const guardian = deck.find(c => c.type === 'guardian' || c.id.startsWith('g')); 
  
  const guardianInfo = guardian 
    ? `🛡️ **${guardian.name}** (Lvl ${guardian.level} - ${guardian.rarity}★)`
    : "❌ Nenhum Guardião Ativo";
    
  return `${guardianInfo}\n*Total de Cartas na Equipe: ${totalCards}*`;
}


export default {
  name: "status",
  description: "Mostra HUD de RPG interativo do jogador.",
  usage: "[status]",
  
  async execute(message, args, user) {
    try {
      const userId = message.author.id;
      const username = message.author.username;
      
      // -----------------------
      // Obter Dados Com Resiliência
      // -----------------------
      const maxEnergy = 10;
      const energy = getEnergyStatus(userId) ?? 0;
      const energyStatus = createSimplifiedEnergyBar(energy, maxEnergy);
      
      let dailyStatus = "⚠️ Erro ao obter status diário.";
      try {
        dailyStatus = getDailyStatus(userId) ?? "⚠️ (indefinido)";
      } catch {}
      
      // CORREÇÃO CRÍTICA APLICADA AQUI: Verifica explicitamente se o retorno é um Array.
      let deck = [];
      try {
        const result = viewDeck(user, "main");
        // Somente atribui o resultado se for um array válido
        if (Array.isArray(result)) {
            deck = result;
        }
      } catch (e) {
        console.error("Erro ao carregar o deck (Fallback para []):", e);
        // Deck permanece como []
      }
      const deckSummary = formatDeckSummary(deck);
      
      const level = Number(user.level) || 1;
      const currentXP = Number(user.xp) || 0;
      const xpForNext = 100 * level; 
      const xpBar = createSimpleXPBar(currentXP, xpForNext);
      
      // -----------------------
      // Embed profissional (HUD V2)
      // -----------------------
      const embed = new EmbedBuilder()
        .setTitle(`✨ Status de RPG de ${username}`)
        .setDescription(`**${level > 5 ? "👑 Herói" : "⚔️ Aventureiro"} de Nível ${level}**\n\n`)
        .addFields(
          // --- PROGRESSÃO ---
          { 
            name: "📈 Nível e XP", 
            value: `${xpBar}\n**XP:** ${currentXP}/${xpForNext}`, 
            inline: false 
          },
          // --- RECURSOS ---
          { 
            name: "💰 ECONOMIA", 
            value: `**Ouro:** ${user.gold?.toLocaleString() ?? 0}\n**Gemas:** ${user.gems?.toLocaleString() ?? 0}`,
            inline: true 
          },
          { 
            name: "⚡ RECURSOS ATUAIS", 
            value: `**Energia:** ${energyStatus}\n**Diário:** ${dailyStatus}`,
            inline: true 
          },
          // --- GUARDIÃO E DECK ---
          { 
            name: "🛡️ EQUIPE PRINCIPAL", 
            value: deckSummary, 
            inline: false 
          }
        )
        .setColor("#3498DB")
        .setFooter({ text: `Próximo Nível em ${xpForNext - currentXP} XP | Use !inventario para detalhes.` })
        .setTimestamp();
      
      await message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
      
    } catch (err) {
      console.error("❌ Erro fatal no comando !status:", err);
      await message.reply("❌ Ocorreu um erro fatal ao exibir seu status.");
    }
  }
};
