// src/systems/summonSystem.js

import { getCardTemplate, giveCardToUser, getCardList } from "./cardSystem.js"; 
// 🎯 CORREÇÃO: Importa a função centralizada para gestão de recursos (spendCurrency)
import { spendCurrency } from "./economySystem.js"; 

// Importações de dados
import altars from "../../data/altars.json" with { type: "json" };
import boosters from "../../data/boosters.json" with { type: "json" };

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

// ... (Funções auxiliares inalteradas) ...
function calculateUserDeckForce(user) { /* ... */ }
function determineRarity(type, user, options = {}) { /* ... */ }
function getAvailableCardDefinitions(rarity, type, options = {}) { /* ... */ }


// ----------------------------------------------------
// 🔹 FUNÇÃO PRINCIPAL DE INVOCAÇÃO
// ----------------------------------------------------

/**
 * Invoca uma carta (singular) por tipo, cobrando o custo.
 * @param {object} user - Objeto do usuário
 * @param {string} type - Tipo de invocação (gold, gems, coupons, mazeBoss, guardian)
 * @param {object} options - Opções adicionais
 * @returns {string} Mensagem de sucesso/erro
 * @throws {Error} Se recursos forem insuficientes.
 */
export function summonCard(user, type = "gold", options = {}) {
  const cost = summonCosts[type]?.single;
  
  if (!cost && type !== 'mazeBoss' && type !== 'guardian') 
    throw new Error("Tipo de invocação inválido ou sem custo definido.");
  
  // 🎯 CORREÇÃO: Delega a checagem e cobrança de custo para o economySystem.
  // O spendCurrency deve lançar um erro se for insuficiente.
  if (cost > 0) {
      const currencyType = type; // (gold, gems, coupons)
      // Se o custo for cobrado com sucesso, os recursos são deduzidos do objeto 'user'
      spendCurrency(user, currencyType, cost);
  }

  // Se o custo for cobrado com sucesso (ou se não houver custo), continua:
  const rarity = determineRarity(type, user, options);
  
  const availableDefinitions = getAvailableCardDefinitions(rarity, type, options);
  
  if (availableDefinitions.length === 0) 
      return "⚠️ Nenhuma definição de carta disponível nessa raridade.";

  const chosenDefinition = availableDefinitions[Math.floor(Math.random() * availableDefinitions.length)];
  
  // giveCardToUser cria a instância da carta para o inventário (modifica user.cards)
  giveCardToUser(user, chosenDefinition.id); 
  
  // ❌ saveUser(user); REMOVIDO: Confiamos no Middleware/markUserDirty

  return `✨ Você invocou **${chosenDefinition.name}** (${rarity}★)!`;
}


// ----------------------------------------------------
// 🔹 FUNÇÃO DE INVOCAÇÃO MÚLTIPLA
// ----------------------------------------------------

/**
 * Invoca múltiplas cartas (ex: 5x)
 * @param {object} user - Objeto do usuário
 * @param {string} type - Tipo de invocação (gold, gems, coupons)
 * @param {number} count - Quantidade a ser invocada
 * @param {object} options - Opções adicionais
 * @returns {string} Resultados concatenados
 * @throws {Error} Se recursos forem insuficientes.
 */
export function summonMultiple(user, type = "gold", count = 5, options = {}) {
  const results = [];
  const singleCost = summonCosts[type]?.single || 0;
  
  // Calcula o custo total (usando 'multi' se existir, senão 'single' * count)
  const multiCost = summonCosts[type]?.multi;
  const totalCost = multiCost || singleCost * count;
  
  // 🎯 CORREÇÃO: Checa e cobra o custo TOTAL de uma só vez
  if (totalCost > 0) {
      spendCurrency(user, type, totalCost);
  }

  // Invoca cada carta individualmente
  for (let i = 0; i < count; i++) {
    // Agora summonCard NÃO irá cobrar, pois o custo já foi coberto acima.
    results.push(summonCard(user, type, options)); 
  }
  
  return results.join("\n");
}


// ----------------------------------------------------
// 🔹 FUNÇÃO DE BOOSTER
// ----------------------------------------------------

/**
 * Invoca um booster
 * @param {object} user - Objeto do usuário
 * @param {string} boosterId - ID do booster (ex: "booster_gem_1")
 * @returns {string} Mensagem com as cartas recebidas
 * @throws {Error} Se gemas insuficientes ou booster inválido.
 */
export function summonBooster(user, boosterId) {
  const booster = boosters.find(b => b.id === boosterId);
  if (!booster) throw new Error("Booster inválido.");

  // 🎯 CORREÇÃO: Cobrar custo via spendCurrency, assumindo custo de 675 gemas como padrão do booster.
  const BOOSTER_COST = 675;
  const currencyType = "gems";

  // Lança erro se gemas insuficientes
  spendCurrency(user, currencyType, BOOSTER_COST); 

  const cardInstances = [];
  
  // 1. Garante 1 carta tema de 4-5★
  const themeCardDefinition = getCardTemplate(booster.themeCardId);
  if (themeCardDefinition) {
      cardInstances.push(giveCardToUser(user, themeCardDefinition.id));
  }

  // 2. Sorteia o restante
  for (let id of booster.cardIds) {
    const definition = getCardTemplate(id);
    if (definition) {
        cardInstances.push(giveCardToUser(user, definition.id));
    }
    if (cardInstances.length >= 5) break; 
  }

  // Retorna os nomes das cartas
  const receivedNames = cardInstances.map(c => getCardTemplate(c.id).name);
  return `🎁 Booster aberto! Você recebeu: ${receivedNames.join(", ")}`;
}
