// src/commands/guardian.js
import { loadUser, saveUser } from "../../src/systems/economySystem.js";
import {
  filterCards,
  viewDeck,
  addCardToDeck,
  removeCardFromDeck
} from "../../src/systems/inventorySystem.js";
import { getCardTemplate } from "../../src/systems/cardSystem.js";

export default {
  name: "guardian",
  description: "Visualize, selecione ou organize seus guardiões.",
  async execute(message, args) {
    const userId = message.author.id;
    const user = loadUser(userId);

    if (!user.cards || user.cards.length === 0)
      return message.reply("📦 Você não possui cartas.");

    const action = args[0]?.toLowerCase();

    // Listar todos os guardiões
    if (!action || action === "list") {
      const guardians = filterCards(user.cards, { isGuardian: true });
      if (guardians.length === 0) return message.reply("⚠️ Nenhum guardião disponível.");
      const list = guardians.map((c, i) => {
        const template = getCardTemplate(c.id);
        return `${i + 1}. ${template.name} - Lv.${c.level} (${template.rarity}★)`;
      }).join("\n");
      return message.reply(`🛡️ Guardiões:\n${list}`);
    }

    // Selecionar guardião
    if (action === "select") {
      const index = parseInt(args[1]) - 1;
      const guardians = filterCards(user.cards, { isGuardian: true });
      const selected = guardians[index];
      if (!selected) return message.reply("❌ Guardião inválido.");
      user.selectedGuardian = selected.uniqueId;
      saveUser(user);
      return message.reply(`✅ Guardião **${getCardTemplate(selected.id).name}** selecionado!`);
    }

    // Visualizar efeitos do guardião
    if (action === "info") {
      const selected = user.cards.find(c => c.uniqueId === user.selectedGuardian);
      if (!selected) return message.reply("⚠️ Nenhum guardião selecionado.");
      const template = getCardTemplate(selected.id);
      let effects = `🎯 Efeitos:\n1. ${template.effect1}`;
      if (selected.level >= 5) effects += `\n2. ${template.effect2}`;
      if (selected.level >= 10) effects += `\n3. ${template.effect3}`;
      if (selected.level >= 15) effects += `\n4. ${template.effect4}`;
      return message.reply(`🛡️ ${template.name} - Lv.${selected.level}\n${effects}`);
    }

    // Adicionar guardião a um deck
    if (action === "deck") {
      const deckName = args[1] || "main";
      const selected = user.cards.find(c => c.uniqueId === user.selectedGuardian);
      if (!selected) return message.reply("⚠️ Nenhum guardião selecionado.");
      const res = addCardToDeck(userId, user.cards.indexOf(selected) + 1, deckName);
      saveUser(user);
      return message.reply(res);
    }

    // Remover guardião do deck
    if (action === "remove") {
      const deckName = args[1] || "main";
      const selected = user.cards.find(c => c.uniqueId === user.selectedGuardian);
      if (!selected) return message.reply("⚠️ Nenhum guardião selecionado.");
      const deck = user.decks[deckName] || [];
      const indexInDeck = deck.findIndex(c => c.uniqueId === selected.uniqueId);
      if (indexInDeck === -1) return message.reply("⚠️ Guardião não está no deck.");
      const res = removeCardFromDeck(userId, indexInDeck + 1, deckName);
      saveUser(user);
      return message.reply(res);
    }

    return message.reply("❌ Comando inválido. Use: list, select [n], info, deck [nome], remove [nome]");
  }
};