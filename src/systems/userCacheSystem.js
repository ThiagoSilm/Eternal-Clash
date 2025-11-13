// src/systems/userCacheSystem.js

import fs from "fs";
import path from "path";

// Define onde o arquivo de dados reside (assume que users.json guarda TODOS os usuários)
const dataPath = path.join(process.cwd(), "data/users.json");
const cache = new Map();
const dirty = new Set();
let allDiskData = {}; // Cache in-memory de todos os dados do disco

// Tenta carregar todos os dados do disco uma única vez na inicialização
function loadAllDiskData() {
    if (fs.existsSync(dataPath)) {
        try {
            const data = fs.readFileSync(dataPath, "utf-8");
            allDiskData = JSON.parse(data);
        } catch (e) {
            console.error("Erro ao ler ou desserializar users.json:", e);
            allDiskData = {};
        }
    }
}

// Carrega os dados do disco na inicialização do sistema
loadAllDiskData();

/**
 * Carrega o objeto do usuário, priorizando o cache in-memory.
 * Se a inicialização for necessária, o sistema chamador (userSystem) deve fazer isso.
 */
export function loadUserCached(userId) {
  // 1. Prioriza o cache in-memory
  if (cache.has(userId)) return cache.get(userId);
  
  // 2. Busca nos dados já lidos do disco
  const userData = allDiskData[userId] || null;

  // IMPORTANTE: Aqui, o objeto user é APENAS o que estava no disco/cache.
  // Se for null/vazio, o sistema chamador (userSystem) deve inicializá-lo.
  
  // Se o usuário existir (no disco ou na memória), armazena no cache local e retorna
  if (userData) {
      cache.set(userId, userData);
      return userData;
  }
  
  // Se o usuário for novo/não existir no disco, retorna um objeto vazio para o userSystem inicializar
  const newUserPlaceholder = { id: userId }; 
  cache.set(userId, newUserPlaceholder);
  return newUserPlaceholder;
}

/**
 * Marca o usuário como modificado, garantindo que seja salvo no próximo flush.
 */
export function markUserDirty(userId) {
  dirty.add(userId);
}

// ❌ FUNÇÃO saveUser REMOVIDA
// O salvamento individual é perigoso e ineficiente; o flushCache lida com isso.

/**
 * Salva todos os usuários marcados como 'dirty' de volta ao disco.
 * Esta deve ser a única função que escreve no users.json.
 */
export function flushCache() {
  if (dirty.size === 0) return;
  
  // Atualiza o cache total em memória com os dados modificados
  dirty.forEach((userId) => {
    const user = cache.get(userId);
    if (user) {
        // Assume que 'allDiskData' contém todos os usuários, incluindo os novos.
        allDiskData[userId] = user; 
    }
  });
  
  try {
    // Escreve o cache in-memory completo de volta para o disco.
    fs.writeFileSync(dataPath, JSON.stringify(allDiskData, null, 2));
    dirty.clear();
    console.log(`💾 Cache limpo. ${dirty.size} usuário(s) salvo(s)`);
  } catch (e) {
    console.error("FATAL ERROR: Falha ao escrever users.json no disco.", e);
  }
}
