// card.js
// Comando para gerenciar Cartas, Guardiões, Runas e Fragmentos
// -----------------------------------------------------------------
import { EmbedBuilder } from "discord.js";
import { 
  formatCardInfo, 
  tryMeld, 
  evolveCard, 
  findUserCardByUnique, // findUserCardByUnique(user, uid)
  calculateMeldCost,
  addRune, // Novo
  removeRune, // Novo
  giveCardToUser // Novo (para fins de teste/utilidade)
} from "../../src/systems/cardSystem.js"; 

// --- Helpers para a UI ---
// OBS: Você precisará de uma função para formatar a lista de cartas, 
// pois ela não foi exposta no sistema, vou criar uma simplificada.
function formatInventoryList(cards, page = 1, pageSize = 10) {
    if (!cards || cards.length === 0) return "Seu inventário de cartas está vazio.";
    
    const start = (page - 1) * pageSize;
    const end = page * pageSize;
    
    const list = cards.slice(start, end);

    const formattedList = list.map((card, i) => {
        const index = start + i + 1;
        const uid = card.uniqueId ? card.uniqueId.slice(0, 8) : 'N/A';
        const typeIcon = card.type === 'guardian' ? '🛡️' : (card.type === 'shard' ? '🧩' : '📜');
        const levelInfo = card.type !== 'shard' ? `(Lv ${card.level})` : `(${card.quantity}x)`;

        return `\`${index}.\` ${typeIcon} **${card.name}** ${levelInfo} \`ID: ${uid}\``;
    }).join('\n');

    const totalPages = Math.ceil(cards.length / pageSize);
    
    return `${formattedList}\n\n*Página ${page}/${totalPages}. Total de itens: ${cards.length}*`;
}


export default {
  name: "card",
  description: "Gerencia Cartas, Guardiões, Runas e Fragmentos no inventário.",
  usage: "<view <ID único> | inv [página] | meld <ID base> <ID doador> | evolve <ID único> | equip <ID> <slot> <runa> | unequip <ID> <slot>>",
  
  async execute(message, args, user) {
    const subcommand = args[0]?.toLowerCase();
    const userId = message.author.id;
    const username = message.author.username;
    const [_, uid1, uid2, uid3] = args; // uid1: cardId | uid2: donorId/slot | uid3: runeId

    // --- 0. INVENTORY (Listagem) ---
    if (subcommand === 'inv' || subcommand === 'inventory') {
        const page = parseInt(uid1) || 1;
        const allCards = user.cards || [];
        
        const embed = new EmbedBuilder()
            .setTitle(`🎒 Inventário de Cartas de ${username}`)
            .setDescription(formatInventoryList(allCards, page, 10))
            .setColor("#3498DB");

        return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
    }

    // --- 1. VIEW (Visualizar Detalhes) ---
    if (subcommand === 'view') {
      if (!uid1) return message.reply("❌ Forneça o ID Único para visualização.");
      
      const card = findUserCardByUnique(user, uid1);
      if (!card) return message.reply(`❌ Carta ou Guardião com ID \`${uid1}\` não encontrado.`);

      try {
        const infoText = formatCardInfo(card);
        
        const embed = new EmbedBuilder()
          .setTitle(`📜 Detalhes de ${card.name} [${card.uniqueId?.slice(0, 8) || 'SHARD'}]`)
          .setDescription(infoText)
          .setColor(card.type === 'guardian' ? "#9B59B6" : (card.type === 'shard' ? "#F1C40F" : "#3498DB"))
          .setFooter({ text: `Tipo: ${card.type} | Grade: ${card.grade}` })
          .setTimestamp();

        return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });

      } catch (err) {
        console.error(`Erro em !card view para ${userId}:`, err);
        return message.reply("❌ Erro ao exibir os detalhes da carta.");
      }
    }

    // --- 2. MELD (Fusão/Melhoria de Efeito) ---
    if (subcommand === 'meld') {
      if (!uid1 || !uid2) return message.reply("❌ Sintaxe incorreta. Use: `!card meld <ID base> <ID doador>`");
      
      const baseCard = findUserCardByUnique(user, uid1);
      if (!baseCard || baseCard.type !== "card") return message.reply(`❌ ID base (\`${uid1}\`) inválido ou não é uma carta normal.`);
      
      const cost = calculateMeldCost(baseCard);
      
      try {
        const result = tryMeld(user, uid1, uid2);
        
        if (result.success) {
          const embed = new EmbedBuilder()
            .setTitle(`✨ Fusão (Meld) Bem-Sucedida!`)
            .setDescription(`**${baseCard.name}** recebeu um novo efeito!\n\n${result.message}`)
            .setColor("#2ECC71")
            .setFooter({ text: `Custo: ${cost} Ouro` });
            
          return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
        } else {
          return message.reply(`⚠️ Falha na Fusão: ${result.message}`);
        }
      } catch (err) {
        console.error(`Erro em !card meld para ${userId}:`, err);
        return message.reply(`❌ Erro ao tentar fusão: ${err.message}`);
      }
    }
    
    // --- 3. EVOLVE (Evolução por Etapas) ---
    if (subcommand === 'evolve') {
      if (!uid1) return message.reply("❌ Forneça o ID Único da Carta a ser evoluída.");
      
      const card = findUserCardByUnique(user, uid1);
      if (!card) return message.reply(`❌ Carta com ID \`${uid1}\` não encontrada.`);
      if (card.type === "guardian") return message.reply("❌ Guardiões não usam este comando. Use o sistema de Ascensão de Guardião.");

      try {
        const result = evolveCard(user, uid1);
        
        if (result.success) {
          const embed = new EmbedBuilder()
            .setTitle(`⬆️ Evolução Concluída!`)
            .setDescription(`**${card.name}** subiu de nível/status!\n${result.message}`)
            .setColor("#F39C12");

          return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
        } else {
          return message.reply(`⚠️ Falha na Evolução: ${result.message}`);
        }
      } catch (err) {
        console.error(`Erro em !card evolve para ${userId}:`, err);
        return message.reply(`❌ Erro ao tentar evoluir: ${err.message}`);
      }
    }
    
    // --- 4. EQUIP RUNE (Equipar Runa) ---
    if (subcommand === 'equip') {
        // uid1 = cardId, uid2 = slot, uid3 = runeId (assumindo que runeId é um ID de runa no inventário)
        if (!uid1 || !uid2 || !uid3) return message.reply("❌ Sintaxe incorreta. Use: `!card equip <ID carta> <slot> <ID runa>`.");

        // OBS: Aqui, RuneId (uid3) deve ser mapeado para um objeto de runa real.
        // Como o sistema não expõe o inventário de runas, vamos simular uma runa para teste/demonstração.
        const RUNE_EXAMPLE = { name: `Runa Mágica-${uid3}`, slot: uid2, modifiers: [{ type: 'flatAtk', value: 10, scalePerLevel: 5 }], level: 1 };
        
        try {
            const result = addRune(user, uid1, RUNE_EXAMPLE);
            if (result.success) {
                return message.reply(`✅ **Runa** ${RUNE_EXAMPLE.name} equipada no slot **${uid2}** em ${findUserCardByUnique(user, uid1)?.name || 'sua carta'}.`);
            } else {
                return message.reply(`⚠️ Falha ao equipar runa: ${result.message}`);
            }
        } catch (err) {
            console.error(`Erro em !card equip para ${userId}:`, err);
            return message.reply(`❌ Erro ao tentar equipar runa: ${err.message}`);
        }
    }
    
    // --- 5. UNEQUIP RUNE (Remover Runa) ---
    if (subcommand === 'unequip') {
        // uid1 = cardId, uid2 = slot
        if (!uid1 || !uid2) return message.reply("❌ Sintaxe incorreta. Use: `!card unequip <ID carta> <slot>`.");

        try {
            const result = removeRune(user, uid1, uid2);
            if (result.success) {
                return message.reply(`✅ Runa **${result.removedRune.name}** removida do slot **${uid2}** de ${findUserCardByUnique(user, uid1)?.name || 'sua carta'}.`);
            } else {
                return message.reply(`⚠️ Falha ao remover runa: ${result.message}`);
            }
        } catch (err) {
            console.error(`Erro em !card unequip para ${userId}:`, err);
            return message.reply(`❌ Erro ao tentar remover runa: ${err.message}`);
        }
    }

    // --- Padrão / Ajuda ---
    message.reply(`Comando inválido. Use: \`!card ${this.usage}\``);
  }
};
