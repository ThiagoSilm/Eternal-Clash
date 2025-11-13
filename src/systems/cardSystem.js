// src/systems/cardSystem.js

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from 'uuid'; 

// 🚨 IMPORTAÇÕES ESSENCIAIS PARA FUNCIONALIDADE
import { loadUser, saveUserData } from "./userSystem.js";
import { spendGold } from "./economySystem.js"; 
import { levelUpCard } from "./xpSystem.js"; 

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 🔹 PONTO DE CARGA COERENTE COM SEU ARQUIVO DE DADOS
const CARD_DEFINITIONS_PATH = path.join(__dirname, "../../data/cards.json"); 

// 🔹 Carrega definições de cartas (o JSON que contém todas as cartas do jogo)
function loadCardDefinitions() {
  // Se o arquivo não existe, ele o cria como um array vazio para evitar erros
  if (!fs.existsSync(CARD_DEFINITIONS_PATH)) fs.writeFileSync(CARD_DEFINITIONS_PATH, "[]");
  
  // Retorna os dados lidos
  return JSON.parse(fs.readFileSync(CARD_DEFINITIONS_PATH, "utf-8"));
}

// O CACHE: Variável global que armazena todas as cartas disponíveis no jogo.
export const cardDefinitions = loadCardDefinitions(); 

// ------------------------------------
// 🔹 FUNÇÕES DE ACESSO A DEFINIÇÃO
// ------------------------------------

// 🔹 Busca a definição (template/molde) pelo ID
export function getCardTemplate(id) {
  return cardDefinitions.find(c => c.id === id);
}

// 🔹 Retorna a lista completa de definições (para sistemas como Summon)
export function getCardList() {
    return cardDefinitions;
}

// ------------------------------------
// 🔹 GESTÃO DE INSTÂNCIAS (Criação)
// ------------------------------------

// 🔹 Cria uma instância nova de carta pro usuário (cópia mutável do template)
export function giveCardToUser(user, cardId) {
  const base = getCardTemplate(cardId);
  if (!base) return null;
  
  const newCard = {
    // Campos Mutáveis
    uniqueId: uuidv4(), // ID ÚNICO da CÓPIA do jogador
    level: 1, 
    xp: 0,
    unlockedEvolution: false,
    runes: [], 
    meldChance: 0, // Inicializa meld chance
    
    // Campos Imutáveis (do Template)
    id: base.id, // ID da definição (para referência)
    name: base.name,
    rarity: base.rarity,
    hp: base.hp,
    attack: base.attack,
    effects: [...(base.effects || [])], // Cópia dos efeitos base
    evolutionEffectId: base.evolutionEffectId || null, 
    image: base.image || null, 
    type: base.type || "card", 
  };
  
  if (!user.cards) user.cards = [];
  user.cards.push(newCard);
  
  return newCard;
}

// ------------------------------------
// 🔹 FUSÃO (Meld)
// ------------------------------------

// 🔹 Calcula custo de fusão (meld)
export function calculateMeldCost(card) {
  const rarityFactor = Math.pow(card.rarity, 2);
  return Math.round(5000 * rarityFactor); 
}

// 🔹 Faz a fusão de duas cartas
export function tryMeld(userId, baseUniqueId, donorUniqueId) {
  const user = loadUser(userId);
  
  const cardIndex = user.cards.findIndex(c => c.uniqueId === baseUniqueId);
  const donorIndex = user.cards.findIndex(c => c.uniqueId === donorUniqueId);
  
  const card = user.cards[cardIndex];
  const donor = user.cards[donorIndex];
  
  if (!card || !donor) return "❌ Carta base ou doadora inválida.";
  if (!card.unlockedEvolution) return "⚠️ Essa carta ainda não evoluiu.";
  if (baseUniqueId === donorUniqueId) return "❌ Não pode usar a mesma carta como doadora.";
  
  const donorEffectId = getCardTemplate(donor.id)?.evolutionEffectId;
  if (!donorEffectId) return `❌ A carta doadora (${donor.name}) não possui efeito de evolução para meld.`;

  const goldCost = calculateMeldCost(card);
  
  // Usa o EconomySystem para gastar ouro de forma segura
  if (!spendGold(userId, goldCost)) return `❌ Ouro insuficiente. Custo: ${goldCost}.`; 

  // Chance de sucesso e acúmulo
  if (card.meldChance === undefined) card.meldChance = 0;
  const successChance = Math.min(card.meldChance + 20, 100); 
  const success = Math.random() * 100 < successChance;
  
  if (success) {
    // Adiciona o ID do efeito do doador aos efeitos da carta base
    if (!card.effects.includes(donorEffectId)) {
        card.effects.push(donorEffectId); 
    }
    
    // Remove a carta doadora do inventário
    user.cards.splice(donorIndex, 1); 
    
    card.meldChance = 0;
    saveUserData(user);
    return `🔥 Meld bem-sucedido! ${card.name} agora possui o 4º efeito (ID: ${donorEffectId})!`;
  } else {
    card.meldChance = successChance;
    saveUserData(user);
    return `⚡ Meld falhou! Chance aumentada para ${successChance}%.`;
  }
}

// ------------------------------------
// 🔹 GESTÃO DE RUNAS
// ------------------------------------

export function addRune(userId, uniqueId, rune) {
    const user = loadUser(userId);
    const card = user.cards.find(c => c.uniqueId === uniqueId);
    if (!card) return "❌ Carta não encontrada.";
    
    if (!card.runes) card.runes = [];
    if (card.runes.length >= 3) return "❌ Limite de 3 runas por carta.";
    card.runes.push(rune);
    
    saveUserData(user);
    return `🔮 Runa "${rune.name}" adicionada à carta ${card.name}.`;
}

export function removeRune(userId, uniqueId, runeId) {
    const user = loadUser(userId);
    const card = user.cards.find(c => c.uniqueId === uniqueId);
    if (!card) return "❌ Carta não encontrada.";

    if (!card.runes) return "⚠️ Essa carta não tem runas.";
    const index = card.runes.findIndex(r => r.id === runeId);
    if (index === -1) return "❌ Runa não encontrada.";
    
    const removed = card.runes.splice(index, 1)[0];
    
    saveUserData(user);
    return `💀 Runa "${removed.name}" removida da carta ${card.name}.`;
}

// ------------------------------------
// 🔹 HELPER DE EXIBIÇÃO
// ------------------------------------

// 🔹 Helper pra exibir dados da carta (pra usar em comandos ou canva)
export function formatCardInfo(card) {
  const runesText = card.runes?.length ?
    card.runes.map(r => `🔮 ${r.name}`).join(", ") :
    "Sem runas";
  
  const template = getCardTemplate(card.id);
  
  // Lista de IDs de efeitos
  let effectsList = card.effects.map(e => `[${e}]`).join(", ");
  
  // Adiciona o ID do efeito de evolução na exibição se a evolução estiver desbloqueada
  if (card.unlockedEvolution && template?.evolutionEffectId) {
      effectsList += ` (Evolução: [${template.evolutionEffectId}])`;
  }

  return (
    `📜 **${card.name}** (Lv. ${card.level})\n` +
    `⭐ Raridade: ${card.rarity} | Tipo: ${card.type}\n` +
    `❤️ HP: ${card.hp} | ⚔️ ATK: ${card.attack}\n` +
    `✨ Efeitos: ${effectsList}\n` +
    `🔓 Evolução: ${card.unlockedEvolution ? "Ativa" : "Bloqueada"}\n` +
    `🔮 Runas: ${runesText}`
  );
}
