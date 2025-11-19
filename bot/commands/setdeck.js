// setDeck.js
// Comando para gerenciar e configurar os decks de cartas do usuário.
// -----------------------------------------------------------------
import { EmbedBuilder } from "discord.js";
import { 
  viewDeck,
  addCardToDeck,
  removeCardFromDeck,
  removeAllFromDeck
} from "../../src/systems/inventorySystem.js"; 

// A interface Deck é deck1, deck2, deck3, etc.
const MAX_DECKS = 5;

// --- Helper para identificar o deck ---
function getDeckId(arg) {
    const deckNum = parseInt(arg);
    if (!isNaN(deckNum) && deckNum >= 1 && deckNum <= MAX_DECKS) {
        return `deck${deckNum}`;
    }
    // Retorna o primeiro deck como padrão se não for especificado ou for inválido
    return 'deck1';
}


export default {
  name: "setdeck",
  description: "Configura as cartas em um deck específico para batalhas.",
  usage: "<view [deck#] | add <Index do Inventário> [deck#] | remove <Index do Deck> [deck#] | clear [deck#]>",
  aliases: ["deck"],
  
  async execute(message, args, user) { 
    const action = args[0]?.toLowerCase();
    const username = message.author.username;
    
    // --- Comandos de Ação ---
    
    // 1. VIEW / VISUALIZAR (Padrão)
    if (action === 'view' || !action) {
        const deckId = getDeckId(args[1] || '1');
        
        const deckView = viewDeck(user, deckId);
        
        const embed = new EmbedBuilder()
            .setTitle(`🃏 Deck Configurado: ${deckId.toUpperCase()}`)
            .setDescription(`**Cartas Atuais:**\n${deckView}`)
            .setColor("#F39C12") // Laranja
            .setFooter({ text: "Capacidade máxima: 5 cartas." });
            
        return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
    }
    
    // 2. ADD / ADICIONAR
    if (action === 'add') {
        const inventoryIndex = parseInt(args[1]);
        const deckId = getDeckId(args[2] || '1');

        if (isNaN(inventoryIndex) || inventoryIndex < 1) {
            return message.reply("❌ Forneça o **Índice do Inventário** da carta que deseja adicionar (veja em `!inv`).");
        }

        try {
            const result = addCardToDeck(user, inventoryIndex, deckId);
            return message.reply(result.includes('✅') ? `${result} no Deck **${deckId.toUpperCase()}**!` : result);
        } catch (err) {
            return message.reply(`❌ Erro ao adicionar carta: ${err.message}`);
        }
    }
    
    // 3. REMOVE / REMOVER
    if (action === 'remove') {
        const deckIndex = parseInt(args[1]);
        const deckId = getDeckId(args[2] || '1');

        if (isNaN(deckIndex) || deckIndex < 1) {
            return message.reply("❌ Forneça o **Índice do Deck** (1-5) da carta que deseja remover (veja em `!deck view`).");
        }

        try {
            const result = removeCardFromDeck(user, deckIndex, deckId);
            return message.reply(result.includes('🗑️') ? `${result} do Deck **${deckId.toUpperCase()}**!` : result);
        } catch (err) {
            return message.reply(`❌ Erro ao remover carta: ${err.message}`);
        }
    }
    
    // 4. CLEAR / LIMPAR
    if (action === 'clear') {
        const deckId = getDeckId(args[1] || '1');

        const result = removeAllFromDeck(user, deckId);
        return message.reply(`${result} do Deck **${deckId.toUpperCase()}**!`);
    }

    // --- Ajuda ---
    return message.reply(`Comando inválido. Uso correto: \`!deck ${this.usage}\`. Decks disponíveis: 1 a ${MAX_DECKS}.`);
  }
};
