// src/systems/shardSystem.js

// Assume que getCardTemplate carrega os dados estáticos da carta
import { getCardTemplate } from "./cardSystem.js"; 
// Assume que estas funções manipulam o inventário do usuário
import { addItemToInventory, consumeItem } from "./inventorySystem.js"; 

// =========================================================
// ⚙️ CONSTANTES & TIPAGEM
// =========================================================

/**
 * @typedef {object} UserState
 * @property {string} id
 * @property {Object.<string, number>} [inventory] - Inventário de itens.
 */

/**
 * @typedef {object} CardTemplate
 * @property {string} id - O ID estático da carta.
 * @property {string} name - Nome da carta.
 * // ...outras propriedades do template
 */

/**
 * Helper para gerar o ID do Shard (item) baseado no Card ID.
 * @param {string} cardId - O ID do template da carta.
 * @returns {string} O ID do item Shard correspondente (ex: 'shard_fireball').
 */
function getShardItemId(cardId) {
  return `shard_${cardId}`;
}

// =========================================================
// 💎 FUNÇÕES DE GESTÃO DE SHARDS
// =========================================================

/**
 * Adiciona shards de uma carta específica ao inventário do usuário.
 *
 * @param {UserState} user - O objeto do usuário (mutável).
 * @param {string} cardId - O ID do template da carta cujos shards serão adicionados.
 * @param {number} amount - A quantidade de shards a adicionar (deve ser > 0).
 * @returns {{cardName: string, amount: number, shardId: string}} Dados da transação.
 * @throws {Error} Se a quantidade for inválida ou o Card ID não existir.
 */
export function addShardsToUser(user, cardId, amount) {
  if (typeof amount !== 'number' || amount <= 0 || !Number.isInteger(amount)) {
    return `A quantidade de shards deve ser um número inteiro positivo. Recebido: ${amount}.`
  }
  
  const template = getCardTemplate(cardId);
  if (!template) {
    return `Template de Carta '${cardId}' não encontrado.`
  }
  
  const shardId = getShardItemId(cardId);
  const shardName = `Shard de ${template.name}`;
  
  // Assumimos que addItemToInventory lida com a soma de quantidades
  // e aceita um objeto item para definição.
  // Aqui, 'item' é o 'type' do inventário, se o inventário for tipado.
  // Vou ajustar para uma chamada mais genérica, assumindo que `addItemToInventory`
  // precisa apenas do ID do item (shardId) e da quantidade.
  
  // Se o inventorySystem for mais complexo, ele deve suportar metadados:
  /*
  addItemToInventory(user, 'material', {
      id: shardId,
      quantity: amount,
      metadata: { name: shardName, type: 'shard' }
  });
  */

  // Chamada simplificada baseada na estrutura de inventário mais comum:
  addItemToInventory(user, shardId, amount); 
  
  // Retorna dados relevantes
  return {
    cardName: template.name,
    amount,
    shardId
  };
}

/**
 * Consome shards. Usado para fundir, criar cartas ou evoluir.
 *
 * @param {UserState} user - O objeto do usuário (mutável).
 * @param {string} cardId - O ID do template da carta cujos shards serão consumidos.
 * @param {number} amount - A quantidade de shards a consumir (deve ser > 0).
 * @returns {boolean} True se o consumo foi bem-sucedido (saldo suficiente), false caso contrário.
 * @throws {Error} Se a quantidade for inválida.
 */
export function spendShards(user, cardId, amount) {
  if (typeof amount !== 'number' || amount <= 0 || !Number.isInteger(amount)) {
    return `A quantidade de shards a consumir deve ser um número inteiro positivo. Recebido: ${amount}.`
  }
    
  const shardId = getShardItemId(cardId);
  
  // assume que consumeItem retorna true/false e lida com a lógica de saldo
  const success = consumeItem(user, shardId, amount);
    
  if (!success) {
      const template = getCardTemplate(cardId);
      return `[ShardSystem] Falha ao gastar ${amount} shards de ${template?.name || cardId}. Saldo insuficiente.`
  }

  return success;
}

// Exportação padrão para compatibilidade (melhor remover a default export em um sistema modular)
/* export default {
  addShardsToUser,
  spendShards
}; */
