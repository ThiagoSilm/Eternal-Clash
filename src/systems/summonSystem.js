// src/systems/summonSystem.js
import { getCardTemplate, giveCardToUser, getCardList } from "./cardSystem.js"; // Assume que CardSystem fornece getCardList
import { saveUser } from "./economySystem.js";
import altars from "../data/altars.json" with { type: "json" };
import boosters from "../data/boosters.json" with { type: "json" };

// Taxas de drop por raridade (em %)
const dropRates = {
  1: 45, // Comum
  2: 30, // Incomum
  3: 15, // Rara
  4: 7,  // Épica
  5: 3   // Lendária
};

// Preços de invocação
const summonCosts = {
  gold: { single: 5000, multi: 22500 },  // ouro
  gems: { single: 150, multi: 675 },     // gemas
  coupons: { single: 1, multi: 5 }       // cupons
};

// Calcula a força do deck do usuário (soma dos ataques base)
function calculateUserDeckForce(user) {
  // Assume que user.decks.main contém objetos de carta com a propriedade attack
  if (!user.decks || !user.decks.main) return 0;
  return user.decks.main.reduce((acc, card) => acc + (card.attack || 0), 0);
}

/**
 * Sorteia a raridade de uma carta baseada na força do deck vs força do maze
 */
function determineRarity(type, user, options = {}) {
  if (type === "mazeBoss") {
    const mapForce = options.mapForce || 1;
    const userForce = calculateUserDeckForce(user);
    // Lógica complexa de chance de raridade alta para Boss (mantida)
    const baseChance = 10 + Math.min(40, ((userForce / mapForce) * 50));
    const roll = Math.random() * 100;
    return roll <= baseChance ? 5 : (roll <= baseChance + 20 ? 4 : 3);
  } else {
    // Sorteio baseado nas taxas de drop padrão (mantido)
    const roll = Math.random() * 100;
    let accumulated = 0;
    for (const [r, rate] of Object.entries(dropRates)) {
      accumulated += rate;
      if (roll <= accumulated) return parseInt(r);
    }
    return 1;
  }
}

/**
 * Filtra cartas disponíveis por raridade e tipo.
 * CORREÇÃO: Assume que o CardSystem pode fornecer a lista completa de DEFINIÇÕES (cards.json)
 */
function getAvailableCardDefinitions(rarity, type, options = {}) {
  // ESTA É A MELHORIA DE EFICIÊNCIA/CONCEITUAL
  // Para que este código funcione corretamente, o CardSystem precisa ter a função getCardList()
  // que retorna todas as definições de cartas do cards.json.
  const allCardDefinitions = getCardList(); 
  
  return allCardDefinitions.filter(card => {
    // A carta deve ter a raridade desejada
    if (card.rarity !== rarity) return false;
    
    // Filtro específico para recompensas de Maze
    if (type === "mazeBoss" && !card.isMazeReward) return false;
    
    // Filtros de Boosters (Se vier de um Booster, esta lógica será tratada separadamente)
    
    return true;
  });
}

/**
 * Invoca cartas (1 ou múltiplas) por tipo
 */
export function summonCard(user, type = "gold", options = {}) {
  const cost = summonCosts[type]?.single;
  if (!cost) return "❌ Tipo de invocação inválido.";

  // Checa recursos
  if (type === "gold" && user.gold < cost) return "💰 Ouro insuficiente.";
  if (type === "gems" && user.gems < cost) return "💎 Gemas insuficientes.";
  if (type === "coupons" && user.coupons < cost) return "🎟️ Cupom insuficiente.";

  // Cobra custo
  if (type === "gold") user.gold -= cost;
  else if (type === "gems") user.gems -= cost;
  else if (type === "coupons") user.coupons -= cost;

  const rarity = determineRarity(type, user, options);
  
  // Usa o novo filtro de definições
  const availableDefinitions = getAvailableCardDefinitions(rarity, type, options);
  
  if (availableDefinitions.length === 0) return "⚠️ Nenhuma definição de carta disponível nessa raridade.";

  // Carta aleatória
  const chosenDefinition = availableDefinitions[Math.floor(Math.random() * availableDefinitions.length)];
  
  // giveCardToUser cria a instância da carta para o inventário
  giveCardToUser(user, chosenDefinition.id); 
  saveUser(user);

  // Mensagem ajustada para clareza
  return `✨ Você invocou **${chosenDefinition.name}** (${rarity}★)!`;
}

/**
 * Invoca múltiplas cartas
 */
export function summonMultiple(user, type = "gold", count = 5, options = {}) {
  const results = [];
  const multiCost = summonCosts[type]?.multi || 0;
  
  // Checagem de custo múltipla (mantida)
  if (multiCost && ((type === "gold" && user.gold < multiCost) || (type === "gems" && user.gems < multiCost) || (type === "coupons" && user.coupons < multiCost))) {
    return `❌ Recursos insuficientes para invocação múltipla de ${type}.`;
  }
  
  // Cobra custo
  if (multiCost) {
    if (type === "gold") user.gold -= multiCost;
    else if (type === "gems") user.gems -= multiCost;
    else if (type === "coupons") user.coupons -= multiCost;
  }

  // Invoca cada carta individualmente
  for (let i = 0; i < count; i++) {
    results.push(summonCard(user, type, options));
  }
  return results.join("\n");
}

/**
 * Invoca um booster
 */
export function summonBooster(user, boosterId) {
  const booster = boosters.find(b => b.id === boosterId);
  if (!booster) return "❌ Booster inválido.";

  // Cobra 675 gemas (assumindo custo fixo do booster)
  if (user.gems < 675) return "💎 Gemas insuficientes.";
  user.gems -= 675;

  const cardInstances = [];
  
  // 1. Garante 1 carta tema de 4-5★
  const themeCardDefinition = getCardTemplate(booster.themeCardId);
  if (themeCardDefinition) {
      // Cria a instância da carta
      cardInstances.push(giveCardToUser(user, themeCardDefinition.id));
  }


  // 2. Sorteia o restante
  // Iteramos sobre os IDs definidos no booster
  for (let id of booster.cardIds) {
    const definition = getCardTemplate(id);
    if (definition) {
        // Cria a instância da carta
        cardInstances.push(giveCardToUser(user, definition.id));
    }
    // Garante que o número total de cartas não exceda o esperado (ex: 5)
    if (cardInstances.length >= 5) break; 
  }

  saveUser(user);
  
  // Retorna os nomes das cartas
  return `🎁 Booster aberto! Você recebeu: ${cardInstances.map(c => c.name).join(", ")}`;
}
