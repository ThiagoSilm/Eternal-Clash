// src/systems/userCacheSystem.js
import fs from "fs";
import path from "path";

// =========================================================
// ⚙️ CONFIGURAÇÃO E ESTADO INTERNO
// =========================================================

const DATA_FILE = "users.json";
const dataPath = path.join(process.cwd(), `data/${DATA_FILE}`);
const tempPath = dataPath + ".tmp";

// Cache em memória: userId -> UserObject
const cache = new Map();

// Set de usuários modificados desde o último salvamento: userId
const dirty = new Set();

// Cópia em memória de todos os dados do disco (para escrita e fallback)
let allDiskData = {};

/**
 * @typedef {object} UserState
 * @property {string} id
 * @property {string} [name]
 * @property {number} [level]
 * // ... outras propriedades de estado, como energy, gold, inventory, etc.
 */


/* ---------------------------------------------------------
   I. CARREGAMENTO INICIAL
--------------------------------------------------------- */

/**
 * Carrega todos os dados do disco (`users.json`) para a memória (`allDiskData`).
 * Chamada apenas na inicialização do módulo.
 */
function loadAllDiskData() {
  if (!fs.existsSync(dataPath)) {
    console.warn(`[Cache] ${DATA_FILE} não existe — inicializando com objeto vazio.`);
    allDiskData = {};
    return;
  }
  
  try {
    const raw = fs.readFileSync(dataPath, "utf8");
    const parsed = JSON.parse(raw);
    
    if (parsed && typeof parsed === "object") {
      allDiskData = parsed;
      console.log(`[Cache] ${Object.keys(parsed).length} usuários carregados.`);
    } else {
      throw new Error("Formato JSON inválido ou vazio.");
    }
  } catch (err) {
    console.error(`[Cache] ERRO ao ler ${DATA_FILE} — recriando dados.`, err.message);
    allDiskData = {};
  }
}

// Executa o carregamento na inicialização do módulo
loadAllDiskData();

/* ---------------------------------------------------------
   II. CRIAÇÃO/FALLBACK
--------------------------------------------------------- */

/**
 * Cria um objeto de usuário mínimo para novos IDs.
 * Outros sistemas (como energySystem, economySystem) devem chamar suas próprias
 * funções `init/ensure` para adicionar e sanear as propriedades necessárias.
 * @param {string} userId
 * @returns {UserState}
 */
function createFallbackUser(userId) {
  return {
    id: userId,
    name: `User_${userId.slice(0, 8)}`,
    level: 1,
    xp: 0,
    gold: 0,
    gems: 0,
    
    // Propriedades mínimas para evitar erros de leitura imediata
    energy: { current: 100, max: 100, lastRegen: Date.now() },
    inventory: {},
    cards: [],
    decks: {},
  };
}

/* ---------------------------------------------------------
   III. FUNÇÕES PÚBLICAS DE CACHE
--------------------------------------------------------- */

/**
 * Carrega e retorna o objeto de usuário, utilizando o cache em memória.
 * Cria um usuário fallback se o ID não for encontrado.
 * @param {string} userId
 * @returns {UserState} O objeto do usuário (mutável).
 */
export function loadUserCached(userId) {
  if (!userId) throw new Error("ID do usuário é obrigatório.");
    
  if (cache.has(userId)) return cache.get(userId);
  
  let loaded = allDiskData[userId];
  
  if (!loaded || typeof loaded !== "object" || loaded.id !== userId) {
    // Falha ao carregar ou objeto corrompido, cria novo
    loaded = createFallbackUser(userId);
    console.log(`[Cache] Novo usuário criado: ${userId}`);
    // Marca como sujo para garantir que o novo usuário seja salvo no próximo flush
    dirty.add(userId); 
  }
  
  cache.set(userId, loaded);
  return loaded;
}

/**
 * Marca um usuário como 'sujo', indicando que seu estado foi modificado
 * e precisa ser salvo no disco no próximo `flushCache`.
 * @param {string} userId
 */
export function markUserDirty(userId) {
  if (userId) dirty.add(userId);
}

/**
 * Salva todos os usuários marcados como sujos (`dirty`) no disco em modo seguro.
 * Utiliza um arquivo temporário (`.tmp`) e renomeia para evitar corrupção de dados.
 */
export function flushCache() {
  if (dirty.size === 0) return;
  
  console.log(`[Cache] Iniciando salvamento de ${dirty.size} usuários...`);
  
  // 1. Atualiza o objeto de dados mestre (`allDiskData`) com as modificações do cache.
  dirty.forEach((userId) => {
    const userObj = cache.get(userId);
    
    if (userObj) {
        // Apenas salva se ainda estiver no cache (usuário ativo)
        allDiskData[userId] = userObj;
    } else {
        // Se saiu do cache e não foi carregado novamente, assumimos que foi excluído
        delete allDiskData[userId]; 
    }
  });
  
  try {
    // 2. Escreve em arquivo temporário (.tmp)
    const jsonString = JSON.stringify(allDiskData, null, 2);
    fs.writeFileSync(tempPath, jsonString, 'utf8');
    
    // 3. Renomeia para arquivo principal (operação atômica em muitos sistemas de arquivos)
    fs.renameSync(tempPath, dataPath);
    
    console.log(`[Cache] Salvamento concluído. ${dirty.size} usuários persistidos.`);
    // 4. Limpa a lista de usuários sujos
    dirty.clear();
    
  } catch (err) {
    // Se a escrita ou a renomeação falhar, os dados antigos persistem.
    console.error("[Cache] ERRO CRÍTICO AO SALVAR users.json. Dados NÃO SALVOS.", err);
    
    // Tenta limpar o arquivo temporário
    if (fs.existsSync(tempPath)) {
        try { fs.unlinkSync(tempPath); } catch (e) { console.error("Falha ao limpar .tmp", e); }
    }
  }
}

/**
 * Alias para flushCache.
 */
export function flushDirtyUsers() {
  flushCache();
}


/* ---------------------------------------------------------
   IV. NPC Generator (Para Arena)
--------------------------------------------------------- */

/**
 * Gera um objeto NPC para uso como oponente na Arena, baseado em um Elo/Rank.
 * Este objeto não é salvo nem gerenciado pelo cache.
 * @param {number} elo - O rating Elo/Rank do oponente desejado.
 * @returns {UserState} Um objeto que simula um UserState para fins de batalha.
 */
export function generateOpponentForRank(elo) {
  const level = Math.max(1, Math.floor(elo / 100) + 1);
  
  // Ajuste de recompensas
  const goldReward = level * 50;
  const gemsReward = Math.floor(level / 5);
  
  // Simula um ID único para o NPC
  const npcId = `npc_${elo}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

  // Retorna um objeto com a estrutura mínima necessária para o battleSystem
  return {
    id: npcId,
    name: `Gladiador Rank ${level}`,
    level: level,
    gold: goldReward, // Simula a recompensa potencial
    gems: gemsReward,
    
    // Configurações de batalha (devem ser definidas pelos sistemas de batalha/deck)
    energy: { current: 100, max: 100 },
    cards: [], // Deck precisa ser gerado separadamente
    decks: {},
    graveyard: [],
    
    // Campos necessários para o battleSystem, mas não para o cache
    isPlayer: false, 
    elo: elo
  };
}
