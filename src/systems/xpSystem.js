// src/systems/xpSystem.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const economyPath = path.join(__dirname, "../../data/economy.json");

/**
 * Carrega o arquivo de economia e retorna como objeto.
 */
function loadEconomy() {
  if (!fs.existsSync(economyPath)) {
    fs.writeFileSync(economyPath, JSON.stringify({ levelXP: {} }, null, 2));
  }
  return JSON.parse(fs.readFileSync(economyPath, "utf-8"));
}

const economy = loadEconomy();

/**
 * Retorna o XP necessário para o próximo nível.
 */
export function getNextLevelXP(level) {
  return economy.levelXP[level] || 999999;
}

/**
 * Queima (remove) uma carta repetida para gerar XP.
 */
export function burnCardForXP(card) {
  const xp = getCardXpValue(card.rarity, card.level || 1);
  return xp;
}

/**
 * Faz o level up de uma carta se tiver XP suficiente.
 */
export function levelUpCard(user, cardId) {
  const card = user.cards.find(c => c.uniqueId === cardId);
  if (!card) return { success: false, message: "❌ Carta não encontrada." };
  
  const requiredXP = getNextLevelXP(card.level || 1);
  if ((card.xp || 0) < requiredXP)
    return { success: false, message: "⚠️ XP insuficiente para subir de nível." };
  
  // Sobe nível
  card.xp -= requiredXP;
  card.level = (card.level || 1) + 1;
  
  // Aumenta atributos
  card.hp = Math.round(card.hp * 1.12);
  card.attack = Math.round(card.attack * 1.10);
  
  let msg = `⭐ ${card.name} subiu para o nível ${card.level}!`;
  
  // Evolui se atingir o nível 5
  if (card.level >= 5 && !card.evolved) {
    card.evolved = true;
    msg += ` 🌟 Evoluiu e desbloqueou o 4º efeito (${card.evolutionEffect})!`;
  }
  
  return { success: true, message: msg };
}

/**
 * Funde uma carta sacrificando outra para transferir XP.
 */
export function fuseCards(user, baseCardId, sacrificeCardId) {
  const base = user.cards.find(c => c.uniqueId === baseCardId);
  const sacrifice = user.cards.find(c => c.uniqueId === sacrificeCardId);
  
  if (!base || !sacrifice)
    return { success: false, message: "❌ Cartas inválidas." };
  if (base.uniqueId === sacrifice.uniqueId)
    return { success: false, message: "⚠️ Não pode fundir a mesma carta." };
  
  // Calcula o XP ganho pela fusão
  const xpGain = burnCardForXP(sacrifice);
  
  // Remove a carta sacrificada
  user.cards = user.cards.filter(c => c.uniqueId !== sacrifice.uniqueId);
  
  // Adiciona XP à carta base
  base.xp = (base.xp || 0) + xpGain;
  
  return { success: true, message: `💥 ${base.name} recebeu ${xpGain} XP da fusão!` };
}