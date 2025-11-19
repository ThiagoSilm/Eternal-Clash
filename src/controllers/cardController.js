// src/systems/CardController.js
import { getCardTemplate } from "./cardSystem.js";
import { rng } from "./rngSystem.js";

/*  
=====================================================================
 CARD CONTROLLER – Sistema seguro de controle de cartas
 Só o battleSystem deve usar.
 Protege deck do usuário e do inimigo contra manipulação externa.
=====================================================================
*/

function cloneDeck(rawDeck) {
  if (!Array.isArray(rawDeck)) return [];
  return rawDeck.map(card => ({ ...card }));
}

/**
 * Resolve um deck inteiro, convertendo IDs em templates
 * e clonando cartas para evitar manipulação externa.
 */
function resolveDeck(deck) {
  const cloned = cloneDeck(deck);
  return cloned.map(c => getCardTemplate(c) || c);
}

/**
 * Embaralhamento Fisher–Yates seguro.
 */
function shuffle(deck) {
  const arr = [...deck];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rng(0, i);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Monta o pacote completo das cartas de cada lado:
 * - deck inicial
 * - mão inicial vazia
 * - discard separado
 * - cartas resolvidas
 */
function buildCardPackage(rawDeck) {
  const resolved = resolveDeck(rawDeck);
  return {
    deck: shuffle(resolved),
    hand: [],
    discard: []
  };
}

/**
 * Aplica o cardPackage final no entity (player/enemy).
 */
function attachCardPackage(entity, pkg) {
  entity.deck = pkg.deck;
  entity.hand = pkg.hand;
  entity.discard = pkg.discard;
}

/**
 * Controlador principal: recebe player e enemy
 * e devolve versões preparadas para o battleSystem.
 */
export function prepareBattleCardPackages(player, enemy) {
  const pPack = buildCardPackage(player.deck || []);
  const ePack = buildCardPackage(enemy.deck || []);
  
  return {
    playerCards: pPack,
    enemyCards: ePack,
    applyToEntities: () => {
      attachCardPackage(player, pPack);
      attachCardPackage(enemy, ePack);
    }
  };
}

/**
 * API pública protegida
 */
export const CardController = {
  prepareBattleCardPackages,
  resolveDeck,
  buildCardPackage,
  shuffle
};