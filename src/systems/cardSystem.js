import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from 'uuid';
import { markUserDirty } from "./userCacheSystem.js";
import { spendGold } from "./economySystem.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CARD_DEFINITIONS_PATH = path.join(__dirname, "../../data/cards.json");

function loadCardDefinitions() {
  // Garante que o arquivo exista
  if (!fs.existsSync(CARD_DEFINITIONS_PATH)) {
    console.warn(`Card definitions file not found at ${CARD_DEFINITIONS_PATH}. Creating an empty array.`);
    fs.writeFileSync(CARD_DEFINITIONS_PATH, "[]");
  }
  try {
    return JSON.parse(fs.readFileSync(CARD_DEFINITIONS_PATH, "utf-8"));
  } catch (e) {
    console.error("Error loading card definitions:", e);
    return [];
  }
}

// Array principal de definições de cartas
export const cardDefinitions = loadCardDefinitions();

/**
 * Retorna o modelo base de uma carta pelo ID.
 * @param {string} id 
 * @returns {object | undefined}
 */
export function getCardTemplate(id) {
  return cardDefinitions.find(c => c.id === id);
}

/**
 * Retorna a lista completa de definições de cartas.
 * @returns {Array<object>}
 */
export function getCardList() {
  return cardDefinitions;
}

/**
 * Cria uma nova instância de carta para o usuário.
 * @param {object} user - Objeto do usuário.
 * @param {string} cardId - ID do template da carta.
 * @returns {object | null} A nova carta criada ou null se o template não existir.
 */
export function giveCardToUser(user, cardId) {
  const base = getCardTemplate(cardId);
  if (!base) return null;
  
  // Cria uma cópia da carta para o inventário do usuário com estados de jogo
  const newCard = {
    uniqueId: uuidv4(), // ID único de instância
    level: 1,
    xp: 0,
    unlockedEvolution: false, // Se a carta atingiu o nível para meld/evolução
    runes: [], // Runas equipadas
    meldChance: 0, // Chance acumulada de meld (se falhar)
    
    // Propriedades base
    id: base.id,
    name: base.name,
    rarity: base.rarity,
    hp: base.hp,
    attack: base.attack,
    effects: [...(base.effects || [])], // Efeitos iniciais
    evolutionEffectId: base.evolutionEffectId || null, // Efeito que a carta ganha ao evoluir
    image: base.image || null,
    type: base.type || "card"
  };
  
  if (!user.cards) user.cards = [];
  user.cards.push(newCard);
  markUserDirty(user.id);
  return newCard;
}

/**
 * Remove uma carta pelo uniqueId do inventário do usuário.
 * @param {object} user - Objeto do usuário.
 * @param {string} cardUniqueId - ID único da instância da carta.
 * @returns {{ success: boolean, message?: string, removedCard?: object }}
 */
export function removeCardFromUser(user, cardUniqueId) {
  const cardIndex = user.cards.findIndex(c => c.uniqueId === cardUniqueId);
  if (cardIndex === -1) return { success: false, message: "Carta não encontrada." };
  
  const removedCard = user.cards.splice(cardIndex, 1)[0];
  markUserDirty(user.id);
  return { success: true, removedCard };
}

/**
 * Calcula o custo em ouro para a operação de Meld.
 * @param {object} card - A carta base que receberá o efeito.
 * @returns {number} Custo em ouro.
 */
export function calculateMeldCost(card) {
  // Custo baseado na raridade (ex: R1: 5k, R2: 20k, R3: 45k)
  const rarityFactor = Math.pow(card.rarity ?? 1, 2);
  return Math.round(5000 * rarityFactor);
}

/**
 * Tenta fundir o efeito de evolução de uma carta doadora em uma carta base.
 * @param {object} user - Objeto do usuário.
 * @param {string} baseUniqueId - uniqueId da carta base (que recebe o efeito).
 * @param {string} donorUniqueId - uniqueId da carta doadora (que será consumida).
 * @returns {{ success: boolean, message: string }}
 */
export function tryMeld(user, baseUniqueId, donorUniqueId) {
  const card = user.cards.find(c => c.uniqueId === baseUniqueId);
  const donor = user.cards.find(c => c.uniqueId === donorUniqueId);
  
  if (!card || !donor) return { success: false, message: "❌ Carta base ou doadora inválida." };
  if (!card.unlockedEvolution) return { success: false, message: "⚠️ Essa carta ainda não evoluiu (Evolução Bloqueada)." };
  if (baseUniqueId === donorUniqueId) return { success: false, message: "❌ Não pode usar a mesma carta como doadora." };
  
  const donorEffectId = getCardTemplate(donor.id)?.evolutionEffectId;
  if (!donorEffectId) return { success: false, message: `❌ A carta doadora (${donor.name}) não possui efeito de evolução.` };
  if (card.effects.includes(donorEffectId)) return { success: false, message: `✅ ${card.name} já possui este efeito!` };
  
  const goldCost = calculateMeldCost(card);
  if (!spendGold(user, goldCost)) return { success: false, message: `❌ Ouro insuficiente. Custo: ${goldCost}.` };
  
  if (card.meldChance === undefined) card.meldChance = 0;
  const successChance = Math.min(card.meldChance + 20, 100);
  
  const success = Math.random() * 100 < successChance;
  
  // A carta doadora é sempre consumida, independente do sucesso.
  const donorCardRemoved = removeCardFromUser(user, donorUniqueId);
  if (!donorCardRemoved.success) return { success: false, message: "Erro interno: Falha ao remover a carta doadora." };
  
  if (success) {
    card.effects.push(donorEffectId);
    card.meldChance = 0; // Reseta a chance ao ter sucesso
    markUserDirty(user.id);
    return { success: true, message: `🔥 Meld bem-sucedido! ${card.name} agora possui o efeito **(ID: ${donorEffectId})**!` };
  } else {
    card.meldChance = successChance; // Aumenta a chance se falhar
    markUserDirty(user.id);
    return { success: false, message: `⚡ Meld falhou! Chance aumentada para **${successChance}%** no próximo uso.` };
  }
}

/**
 * Adiciona uma runa a uma carta.
 * @param {object} user - Objeto do usuário.
 * @param {string} uniqueId - uniqueId da carta.
 * @param {object} rune - Objeto da runa a ser adicionada.
 * @returns {{ success: boolean, message: string }}
 */
export function addRune(user, uniqueId, rune) {
  const card = user.cards.find(c => c.uniqueId === uniqueId);
  if (!card) return { success: false, message: "❌ Carta não encontrada." };
  if (!card.runes) card.runes = [];
  if (card.runes.length >= 3) return { success: false, message: "❌ Limite de 3 runas por carta." };
  
  // Validação mínima da runa
  if (!rune || !rune.id || !rune.name) return { success: false, message: "❌ Runa inválida." };
  
  card.runes.push(rune);
  markUserDirty(user.id);
  return { success: true, message: `🔮 Runa "${rune.name}" adicionada à carta ${card.name}.` };
}

/**
 * Remove uma runa de uma carta.
 * @param {object} user - Objeto do usuário.
 * @param {string} uniqueId - uniqueId da carta.
 * @param {string} runeId - ID da runa a ser removida.
 * @returns {{ success: boolean, message: string }}
 */
export function removeRune(user, uniqueId, runeId) {
  const card = user.cards.find(c => c.uniqueId === uniqueId);
  if (!card || !card.runes) return { success: false, message: "❌ Carta ou runas não encontradas." };
  
  const index = card.runes.findIndex(r => r.id === runeId);
  if (index === -1) return { success: false, message: "❌ Runa não encontrada." };
  
  const removed = card.runes.splice(index, 1)[0];
  markUserDirty(user.id);
  return { success: true, message: `💀 Runa "${removed.name}" removida da carta ${card.name}.` };
}

/**
 * Formata as informações completas de uma carta para exibição.
 * @param {object} card - A instância de carta.
 * @returns {string} Informação formatada.
 */
export function formatCardInfo(card) {
  const runesText = card.runes?.length ?
    card.runes.map(r => `🔮 ${r.name}`).join(", ") :
    "Sem runas";
  
  const template = getCardTemplate(card.id);
  
  let effectsList = card.effects.map(e => `[${e}]`).join(", ");
  
  if (card.unlockedEvolution && template?.evolutionEffectId) {
    const evolutionEffectDisplay = card.effects.includes(template.evolutionEffectId) ?
      `(Efeito Evoluído Ativo)` :
      `(Evolução Pendente: [${template.evolutionEffectId}])`;
    
    effectsList += ` ${evolutionEffectDisplay}`;
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