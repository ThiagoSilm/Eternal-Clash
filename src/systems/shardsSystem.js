import { getCardTemplate } from "./cardSystem.js";
// Assumimos que você tem uma função no inventorySystem.js para adicionar itens
import { addItemToInventory, consumeItem } from "./inventorySystem.js";

// Helper para gerar o ID do Shard baseado no Card ID
function getShardItemId(cardId) {
  return `shard_${cardId}`;
}

/**
 * Adiciona shards de uma carta específica ao inventário do usuário.
 * Esta função substitui 'giveShardToUser' e resolve o ReferenceError.
 * @param {Object} user - O objeto do usuário.
 * @param {string} cardId - O ID do template da carta cujos shards serão adicionados.
 * @param {number} amount - A quantidade de shards a adicionar.
 * @returns {Object} O resultado da operação.
 */
export function addShardsToUser(user, cardId, amount) {
  if (amount <= 0) {
    throw new Error("A quantidade de shards deve ser positiva.");
  }
  const template = getCardTemplate(cardId);
  if (!template) {
    throw new Error(`Template de Carta ${cardId} não encontrado.`);
  }
  
  const shardId = getShardItemId(cardId);
  
  // Adiciona o item (shard) ao inventário.
  addItemToInventory(user, "item", {
    id: shardId,
    qty: amount,
    meta: { name: `Shard de ${template.name}` }
  });
  
  // Retorna dados relevantes
  return {
    cardName: template.name,
    amount,
    shardId
  };
}

/**
 * Consome shards. Usado para fundir ou criar cartas.
 */
export function spendShards(user, cardId, amount) {
  const shardId = getShardItemId(cardId);
  // consumeItem deve retornar true/false se a transação for bem-sucedida
  return consumeItem(user, shardId, amount);
}

// Exportação padrão para compatibilidade
export default {
  addShardsToUser,
  spendShards
};