// src/systems/cardSystem.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const templatesPath = path.join(__dirname, "../data/cardTemplates.json");

// 🔹 Carrega templates de cartas
function loadTemplates() {
  if (!fs.existsSync(templatesPath)) fs.writeFileSync(templatesPath, "[]");
  return JSON.parse(fs.readFileSync(templatesPath));
}

const templates = loadTemplates();

// 🔹 Busca template pelo ID
export function getCardTemplate(id) {
  return templates.find(c => c.id === id);
}

// 🔹 Cria uma instância nova de carta pro usuário
export function giveCardToUser(user, cardId) {
  const base = getCardTemplate(cardId);
  if (!base) return null;
  
  const newCard = {
    id: base.id,
    name: base.name,
    level: 1,
    xp: 0,
    rarity: base.rarity,
    hp: base.hp,
    attack: base.attack,
    effects: [...(base.effects || [])],
    evolutionEffect: base.evolutionEffect || null,
    unlockedEvolution: false,
    runes: [], // 🔮 Preparado para futuro sistema de runas
    image: base.image || null, // 🖼️ Suporte pra imagem
  };
  
  if (!user.cards) user.cards = [];
  user.cards.push(newCard);
  
  return newCard;
}

// 🔹 Adiciona XP e checa evolução
export function addCardXp(card, amount) {
  card.xp += amount;
  const base = getCardTemplate(card.id);
  const needed = base.xpToLevel || 100;
  
  if (card.xp >= needed && !card.unlockedEvolution) {
    card.unlockedEvolution = true;
    return `🌟 ${card.name} evoluiu e desbloqueou o 4º efeito: ${card.evolutionEffect}!`;
  }
  
  return null;
}

// 🔹 Calcula custo de fusão (meld)
export function calculateMeldCost(card) {
  const rarityFactor = Math.pow(card.rarity, 2);
  return Math.round(5000 * rarityFactor);
}

// 🔹 Faz a fusão de duas cartas
export function tryMeld(user, cardIndex, donorIndex) {
  const card = user.cards[cardIndex];
  const donor = user.cards[donorIndex];
  
  if (!card || !donor) return "❌ Índices inválidos.";
  if (!card.unlockedEvolution) return "⚠️ Essa carta ainda não evoluiu.";
  if (cardIndex === donorIndex) return "❌ Não pode usar a mesma carta como doadora.";
  
  const goldCost = calculateMeldCost(card);
  if (user.gold < goldCost) return "❌ Ouro insuficiente.";
  
  // Chance de sucesso e acúmulo
  if (card.meldChance === undefined) card.meldChance = 0;
  const successChance = card.meldChance + 20;
  const success = Math.random() * 100 < successChance;
  
  user.gold -= goldCost;
  
  if (success) {
    card.effects[3] = donor.evolutionEffect;
    user.cards.splice(donorIndex, 1); // remove carta usada
    card.meldChance = 0;
    return `🔥 Meld bem-sucedido! ${card.name} agora possui o 4º efeito "${donor.evolutionEffect}"!`;
  } else {
    card.meldChance = successChance;
    return `⚡ Meld falhou! Chance aumentada para ${successChance}%.`;
  }
}

// 🔹 Sistema de runas — adicionar / remover (placeholder funcional)
export function addRune(card, rune) {
  if (!card.runes) card.runes = [];
  if (card.runes.length >= 3) return "❌ Limite de 3 runas por carta.";
  card.runes.push(rune);
  return `🔮 Runa "${rune.name}" adicionada à carta ${card.name}.`;
}

export function removeRune(card, runeId) {
  if (!card.runes) return "⚠️ Essa carta não tem runas.";
  const index = card.runes.findIndex(r => r.id === runeId);
  if (index === -1) return "❌ Runa não encontrada.";
  const removed = card.runes.splice(index, 1)[0];
  return `💀 Runa "${removed.name}" removida da carta ${card.name}.`;
}

// 🔹 Helper pra exibir dados da carta (pra usar em comandos ou canva)
export function formatCardInfo(card) {
  const runesText = card.runes?.length ?
    card.runes.map(r => `🔮 ${r.name}`).join(", ") :
    "Sem runas";
  
  return (
    `📜 **${card.name}** (Lv. ${card.level})\n` +
    `⭐ Raridade: ${card.rarity}\n` +
    `❤️ HP: ${card.hp} | ⚔️ ATK: ${card.attack}\n` +
    `✨ Efeitos: ${card.effects.join(", ")}\n` +
    `🔓 Evolução: ${card.unlockedEvolution ? "Ativa" : "Bloqueada"}\n` +
    `🔮 Runas: ${runesText}`
  );
}