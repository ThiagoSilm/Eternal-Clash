// src/commands/guardian.js

// 🚨 CORREÇÃO: Removemos a importação de loadUser/saveUser.
import {
  filterCards,
  addCardToDeck,
  removeCardFromDeck
} from "../../src/systems/inventorySystem.js";
import { getCardTemplate } from "../../src/systems/cardSystem.js";
import { getCardByUniqueId } from "../../src/systems/userSystem.js"; // Supondo que esta função exista para buscar a carta

export default {
  name: "guardian",
  description: "Visualize, selecione ou organize seus guardiões.",
  usage: "[list | select <n> | info | deck [nome] | remove [nome]]",
  
  // ⚠️ ATENÇÃO: Recebe o objeto 'user' do middleware do index.js
  async execute(message, args, user) {
    
    if (!user.cards || user.cards.length === 0)
      return message.reply("📦 Você não possui cartas.");

    const action = args[0]?.toLowerCase();
    
    // -------------------- UTILS --------------------
    const getSelectedGuardian = () => {
        if (!user.selectedGuardian) return null;
        // Busca a instância do guardião pelo uniqueId armazenado
        return user.cards.find(c => c.uniqueId === user.selectedGuardian) || null;
    };
    // -----------------------------------------------

    // -------------------- LISTAR Guardiões --------------------
    if (!action || action === "list") {
      // ⚠️ CORREÇÃO: filterCards deve operar no array de cartas
      const guardians = filterCards(user.cards, { type: "guardian" }); 
      
      if (guardians.length === 0) return message.reply("⚠️ Nenhum guardião disponível.");
      
      const list = guardians.map((c, i) => {
        const template = getCardTemplate(c.id);
        const isSelected = c.uniqueId === user.selectedGuardian ? " (SELECIONADO)" : "";
        
        return `${i + 1}. ${template.name} - Lv.${c.level} (${template.rarity}★)${isSelected}`;
      }).join("\n");
      
      return message.reply(`🛡️ Guardiões (${guardians.length} encontrados):\n${list}`);
    }

    // -------------------- SELECIONAR Guardião --------------------
    if (action === "select") {
      const index = parseInt(args[1]); // Índice visual (1-based)
      if (isNaN(index) || index < 1) return message.reply("❌ Informe o número do guardião para selecionar.");

      const guardians = filterCards(user.cards, { type: "guardian" });
      const selected = guardians[index - 1]; // 0-based
      
      if (!selected) return message.reply("❌ Guardião inválido.");
      
      // Armazena o uniqueId (melhor que o índice, que pode mudar)
      user.selectedGuardian = selected.uniqueId; 
      
      // O salvamento é automático via index.js
      return message.reply(`✅ Guardião **${getCardTemplate(selected.id).name}** selecionado para uso!`);
    }

    // -------------------- VISUALIZAR EFEITOS (info) --------------------
    if (action === "info") {
      const selected = getSelectedGuardian();
      if (!selected) return message.reply("⚠️ Nenhum guardião selecionado. Use `!guardian select [n]`.");
      
      const template = getCardTemplate(selected.id);
      
      // Assume-se que effects é uma array de IDs no template/card
      // O exemplo usava template.effect1, template.effect2... Vou usar a forma mais flexível.
      
      const effectsList = (template.effects || []).map(id => {
          // Aqui você buscaria a descrição detalhada do efeito (e.g., de um effectSystem.js)
          return `- [${id}] - Descrição do efeito (Lv. ${selected.level} / Max.)`;
      }).join('\n');


      let infoMessage = `🛡️ **${template.name}** - Lv.${selected.level} (${selected.rarity}★)\n`;
      infoMessage += `❤️ HP: ${selected.hp || 'N/A'} | ⚔️ ATK: ${selected.attack || 'N/A'}\n`;
      infoMessage += `\n🎯 **Efeitos Ativos:**\n${effectsList || 'Nenhum efeito base.'}`;
      
      // Se houver um efeito de evolução/especial do guardião
      if (template.evolutionEffectId) {
          infoMessage += `\n\n💥 **Habilidade Especial:** [${template.evolutionEffectId}] (Desbloqueada no Lv. X)`;
      }

      return message.reply(infoMessage);
    }

    // -------------------- ADICIONAR ao deck (deck) --------------------
    if (action === "deck") {
      const deckName = args[1] || "main";
      const selected = getSelectedGuardian();
      if (!selected) return message.reply("⚠️ Nenhum guardião selecionado.");
      
      // O comando addCardToDeck provavelmente espera o índice da carta no inventário (1-based)
      const indexInInventory = user.cards.findIndex(c => c.uniqueId === selected.uniqueId) + 1;
      
      // ⚠️ CORREÇÃO: addCardToDeck deve aceitar o objeto user
      const res = addCardToDeck(user, indexInInventory, deckName);
      
      // O salvamento é automático via index.js
      return message.reply(res);
    }

    // -------------------- REMOVER do deck (remove) --------------------
    if (action === "remove") {
      const deckName = args[1] || "main";
      const selected = getSelectedGuardian();
      if (!selected) return message.reply("⚠️ Nenhum guardião selecionado.");
      
      // removeCardFromDeck é mais complexo, pois ele precisa do índice NO DECK (não no inventário)
      // Assumindo que o removeCardFromDeck consegue remover por uniqueId OU por índice no deck.
      
      // Se a função usa índice no deck:
      const deck = user.decks[deckName] || [];
      const indexInDeck = deck.findIndex(c => c.uniqueId === selected.uniqueId);
      
      if (indexInDeck === -1) return message.reply("⚠️ O guardião não está no deck.");
      
      // ⚠️ CORREÇÃO: removeCardFromDeck deve aceitar o objeto user
      const res = removeCardFromDeck(user, indexInDeck + 1, deckName);
      
      // O salvamento é automático via index.js
      return message.reply(res);
    }

    return message.reply("❌ Comando inválido. Use: `list`, `select [n]`, `info`, `deck [nome]`, `remove [nome]`");
  }
};
