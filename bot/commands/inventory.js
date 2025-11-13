// src/commands/inventory.js

// 🚨 CORREÇÃO: Removemos a importação de loadUser/saveUser.
import {
  listInventory, // (Provavelmente não é necessária, pois a lógica está aqui)
  filterCards,
  viewDeck,
  addCardToDeck,
  removeCardFromDeck,
  removeAllFromDeck,
  // upgradeCard, // Usar o comando !upgrade dedicado é melhor
} from "../../src/systems/inventorySystem.js";
import { getCardTemplate } from "../../src/systems/cardSystem.js";
// Importa o comando de upgrade dedicado (se você quiser chamá-lo de dentro)
import upgradeCommand from "./upgrade.js"; 

export default {
  name: "inventory",
  description: "Gerencia suas cartas e decks.",
  usage: "[list [filtros] | deck [deckName] | add <idx> [deckName] | remove <idx> [deckName] | clear [deckName]]",
  
  // ⚠️ ATENÇÃO: Recebe o objeto 'user' do middleware do index.js
  async execute(message, args, user) {
    
    // Inicializa cards se não existir
    if (!user.cards) user.cards = [];
    
    const subcommand = (args[0] || "list").toLowerCase();
    
    // -------------------- LISTAR cartas (list) --------------------
    if (subcommand === "list") {
      let filters = {};
      
      // Itera sobre args para extrair filtros (ex: !inventory list rarity 5 level 10)
      for (let i = 1; i < args.length; i += 2) {
        const key = args[i]?.toLowerCase();
        let value = args[i + 1];
        if (!key || !value) continue;
        
        if (value.toLowerCase() === "true") value = true;
        else if (value.toLowerCase() === "false") value = false;
        else if (!isNaN(value)) value = Number(value);
        
        filters[key] = value;
      }
      
      let cards = user.cards; // Começa com todas as cartas
      
      if (Object.keys(filters).length > 0) {
        // ⚠️ CORREÇÃO: Passa o array de cartas e os filtros para a função
        cards = filterCards(cards, filters); 
      }

      if (cards.length === 0) {
          const filterKeys = Object.keys(filters).join(', ');
          return message.reply(`⚠️ Nenhuma carta encontrada${filterKeys ? ` com os filtros: ${filterKeys}` : ''}.`);
      }
      
      // Mapeia e formata a saída
      const lines = cards.map((c, i) => {
        const template = getCardTemplate(c.id);
        
        // Note: A lógica para formatar os efeitos está complexa e pode estar errada,
        // pois você está lendo effects do TEMPLATE (template.effects) e não da CARTA (c.effects).
        // Se a carta só tiver o array de IDs de efeitos (c.effects), a formatação é mais simples:
        const effectsStr = (c.effects || []).join(', '); 
        
        return `${i + 1}. ${c.name} (${c.rarity}★) Lv.${c.level} ${c.type === "guardian" ? "[Guardian]" : ""} — Efeitos: ${effectsStr || 'Nenhum'}`;
      });
      
      // Usa uma função helper para quebrar a mensagem em pedaços se for muito longa
      const inventoryList = `📜 Seu inventário (${cards.length} cartas):\n` + lines.join("\n");
      
      // Esta função de quebra de mensagem (splitMessage) não está definida, mas é uma boa prática
      // return splitMessage(message, inventoryList); 
      
      return message.reply(inventoryList); 
    }
    
    // -------------------- VISUALIZAR deck (deck) --------------------
    if (subcommand === "deck") {
      const deckName = args[1] || "main";
      // ⚠️ CORREÇÃO: viewDeck deve receber o objeto user
      const deckStr = viewDeck(user, deckName); 
      return message.reply(deckStr);
    }
    
    // -------------------- ADICIONAR carta ao deck (add) --------------------
    if (subcommand === "add") {
      const index = parseInt(args[1]);
      const deckName = args[2] || "main";
      if (!index || index < 1 || index > user.cards.length) return message.reply("❌ Índice de carta inválido.");
      
      // ⚠️ CORREÇÃO: addCardToDeck deve modificar o objeto user
      const res = addCardToDeck(user, index, deckName); 
      
      // O salvamento é automático via index.js
      return message.reply(res);
    }
    
    // -------------------- REMOVER carta do deck (remove) --------------------
    if (subcommand === "remove") {
      const index = parseInt(args[1]);
      const deckName = args[2] || "main";
      if (!index) return message.reply("❌ Informe o número da carta para remover.");
      
      // ⚠️ CORREÇÃO: removeCardFromDeck deve modificar o objeto user
      const res = removeCardFromDeck(user, index, deckName); 
      
      // O salvamento é automático via index.js
      return message.reply(res);
    }
    
    // -------------------- REMOVER TODAS do deck (clear) --------------------
    if (subcommand === "clear") {
      const deckName = args[1] || "main";
      // ⚠️ CORREÇÃO: removeAllFromDeck deve modificar o objeto user
      removeAllFromDeck(user, deckName); 
      
      // O salvamento é automático via index.js
      return message.reply(`🗑️ Todas as cartas do deck ${deckName} foram removidas.`);
    }
    
    // -------------------- UPGRADAR carta (upgrade) --------------------
    if (subcommand === "upgrade") {
        // Melhoria: Chamar o comando !upgrade dedicado
        return upgradeCommand.execute(message, args.slice(1), user);
        
        /* // Alternativamente, se você insistir na lógica interna:
        const index = parseInt(args[1]);
        if (!index) return message.reply("❌ Informe o número da carta para upar.");
        
        const sacrificeIndices = args[2]?.split(",").map(i => parseInt(i.trim())).filter(Boolean) || [];
        const result = upgradeCard(user, index, sacrificeIndices);
        
        // O salvamento é automático via index.js
        return message.reply(result.message); 
        */
    }
    
    return message.reply("❌ Subcomando inválido. Use: list, deck, add, remove, clear.");
  }
};
