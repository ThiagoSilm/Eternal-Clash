// userCacheSystem.js
import fs from "fs";
import path from "path";

const dataPath = path.join(process.cwd(), "data/users.json");
const tempPath = dataPath + ".tmp";

const cache = new Map(); // usuários carregados
const dirty = new Set(); // usuários alterados
let allDiskData = {}; // conteúdo original do users.json no disco

// ------------------------------------------------------------
// Carregamento inicial do arquivo users.json
// ------------------------------------------------------------

function loadAllDiskData() {
  if (!fs.existsSync(dataPath)) {
    console.warn("[Cache] users.json não encontrado. Será criado depois.");
    allDiskData = {};
    return;
  }
  
  try {
    const raw = fs.readFileSync(dataPath, "utf-8");
    const parsed = JSON.parse(raw);
    
    if (parsed && typeof parsed === "object") {
      allDiskData = parsed;
      console.log(`[Cache] Carregado ${Object.keys(allDiskData).length} usuários.`);
    } else {
      throw new Error("JSON inválido");
    }
    
  } catch (err) {
    console.error("[Cache] Erro ao carregar users.json. Criando novo.", err);
    allDiskData = {};
  }
}

loadAllDiskData();

// ------------------------------------------------------------
// Funções de apoio internas
// ------------------------------------------------------------

/**
 * Cria um novo usuário base para fallback, alinhado ao userSystem.js
 */
function createFallbackUser(userId) {
  return {
    id: userId,
    username: `Player_${userId.slice(0, 4)}`,
    level: 1,
    xp: 0,
    gold: 0,
    gems: 0,
    coupons: 0,
    energy: { current: 100, max: 100, lastRegen: Date.now() },
    cards: [],
    decks: {},
    graveyard: [],
    dailyBonusReceived: {},
    lastEnergyRegen: Date.now(),
  };
}

// ------------------------------------------------------------
// Funções Exportadas
// ------------------------------------------------------------

/**
 * Carrega um usuário do cache. Se não existir, carrega do disco ou cria novo.
 */
export function loadUserCached(userId) {
  if (cache.has(userId)) {
    return cache.get(userId);
  }
  
  let user = allDiskData[userId];
  
  if (!user || typeof user !== "object" || !user.id) {
    user = createFallbackUser(userId);
    console.log(`[Cache] Novo usuário inicializado: ${userId}`);
    dirty.add(userId);
  }
  
  cache.set(userId, user);
  return user;
}

/**
 * Marca um usuário como alterado para ser salvo posteriormente.
 */
export function markUserDirty(userId) {
  if (!userId) return;
  dirty.add(userId);
}

/**
 * Escreve todos os usuários 'sujos' no disco de forma segura.
 * Usa escrita atômica -> nunca corrompe usuários.json.
 */
export function flushCache() {
  if (dirty.size === 0) return;
  
  dirty.forEach((userId) => {
    const userObj = cache.get(userId);
    if (!userObj) {
      delete allDiskData[userId];
    } else {
      allDiskData[userId] = userObj;
    }
  });
  
  try {
    // escrita atômica (evita perder tudo em caso de falha)
    fs.writeFileSync(tempPath, JSON.stringify(allDiskData, null, 2));
    fs.renameSync(tempPath, dataPath);
    
    console.log(`[Cache] ${dirty.size} usuários salvos.`);
    dirty.clear();
  } catch (err) {
    console.error("[Cache] ERRO CRÍTICO ao salvar users.json", err);
  }
}

/**
 * Alias para compatibilidade com sistemas antigos.
 */
export function flushDirtyUsers() {
  flushCache();
}