// src/systems/userSystem.js (RESTRUTURADO PARA GERENCIAR O OBJETO CENTRAL)

import { loadUserCached, markUserDirty, saveUser as saveUserToCache } from "./userCacheSystem.js";

// --- FUNÇÃO DE INICIALIZAÇÃO DE DADOS BÁSICOS ---

function initializeNewUser(userId) {
    return {
        id: userId,
        // Stats de progressão
        level: 1,
        xp: 0,
        energy: 100, // Exemplo de recurso de jogo
        // Recursos
        gold: 0,
        gems: 0,
        coupons: 0,
        // Inventário
        cards: [],
        decks: {}, // Ex: { "main": [c1, c2], "arena": [c3, c4] }
        graveyard: []
        // Adicionar outros campos iniciais, como tutorialStatus, etc.
    };
}

// --- FUNÇÕES DE CICLO DE VIDA ---

/**
 * Carrega o usuário do cache. Se não existir, inicializa um novo.
 * Este é o ponto de entrada canônico para obter o objeto do usuário.
 */
export function loadUser(userId) {
  let user = loadUserCached(userId);
  
  // Se o usuário for novo ou precisar de inicialização
  if (!user || user.level === undefined) { 
    user = initializeNewUser(userId);
    // Marca como dirty para garantir que o objeto recém-criado seja salvo.
    markUserDirty(userId); 
  }
  
  return user;
}

/**
 * Salva o estado atual do usuário no cache/disco.
 * (Envolve a função saveUserToCache ou markUserDirty do userCacheSystem)
 * Outros módulos devem usar esta função se modificarem o objeto 'user' diretamente.
 */
export function saveUserData(user) {
    const userId = user.id;
    if (!userId) {
        console.error("Erro: Objeto de usuário sem ID. Não foi possível salvar.");
        return;
    }
    // Usa a função de cache para garantir que as mudanças sejam persistidas
    markUserDirty(userId); 
}

// --- FUNÇÕES DE ACESSO AO ESTADO (SIMPLES) ---

/**
 * Retorna o nível de um usuário (exemplo de getter simples).
 */
export function getUserLevel(userId) {
    const user = loadUser(userId);
    return user.level;
}