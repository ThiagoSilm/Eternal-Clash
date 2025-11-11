// src/systems/inventorySystem.js
import { loadUser, saveUser } from "./economySystem.js";
import { getCardTemplate } from "./cardSystem.js";

export function listInventory(username) {
  const user = loadUser(username);
  if (!user.cards || user.cards.length === 0) return "📦 Você ainda não tem cartas.";

  const lines = user.cards.map((card, i) => {
    const template = getCardTemplate(card.id);
    return `${i + 1}. ${template.name} (${template.rarity}★) — Lv.${card.level}`;
  });

  return `📜 Suas Cartas:\n${lines.join("\n")}`;
}

export function addCardToDeck(username, cardIndex, deckName = "main") {
  const user = loadUser(username);
  const card = user.cards[cardIndex - 1];
  if (!card) return "❌ Carta inexistente.";

  if (!user.decks[deckName]) user.decks[deckName] = [];

  if (user.decks[deckName].length >= 10)
    return "⚠️ O deck já tem o máximo de 10 cartas.";

  // Checar se carta está disponível
  if (card.locked) return "🔒 Essa carta está em uso em outro evento.";

  user.decks[deckName].push(card);
  saveUser(user);
  return `✅ ${getCardTemplate(card.id).name} adicionada ao deck ${deckName}!`;
}

export function removeCardFromDeck(username, cardIndex, deckName = "main") {
  const user = loadUser(username);
  const deck = user.decks[deckName] || [];
  if (deck.length === 0) return "⚠️ O deck está vazio.";

  const removed = deck.splice(cardIndex - 1, 1)[0];
  saveUser(user);
  return `🗑️ ${getCardTemplate(removed.id).name} foi removida do deck ${deckName}.`;
}

export function viewDeck(username, deckName = "main") {
  const user = loadUser(username);
  const deck = user.decks[deckName] || [];

  if (deck.length === 0) return `⚠️ O deck ${deckName} está vazio.`;

  const lines = deck.map(
    (card, i) => `${i + 1}. ${getCardTemplate(card.id).name} (${card.level}⭐)`
  );

  return `⚔️ Deck ${deckName}:\n${lines.join("\n")}`;
}