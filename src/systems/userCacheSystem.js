// src/systems/userCacheSystem.js
import fs from "fs";
import path from "path";

const dataPath = path.join(process.cwd(), "data/users.json");
const tempPath = dataPath + ".tmp";

const cache = new Map();
const dirty = new Set();
let allDiskData = {};

/* ---------------------------------------------------------
   Carregamento inicial do arquivo
--------------------------------------------------------- */
function loadAllDiskData() {
  if (!fs.existsSync(dataPath)) {
    console.warn("[Cache] users.json não existe — será criado.");
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
      throw new Error("Formato inválido");
    }
  } catch (err) {
    console.error("[Cache] ERRO ao ler users.json — recriando arquivo.", err);
    allDiskData = {};
  }
}

loadAllDiskData();

/* ---------------------------------------------------------
   Fallback mínimo (o userSystem fará o saneamento completo)
--------------------------------------------------------- */
function createFallbackUser(userId) {
  return {
    id: userId,
    level: 1,
    xp: 0,
    gold: 0,
    gems: 0,
    coupons: 0,
    energy: { current: 100, max: 100 },
    
    cards: [],
    decks: {},
    graveyard: [],
    
    arena: { attempts: 0, lastAttack: 0, rank: 1 },
    tower: { attempts: 0, floor: 1, shards: 0 },
    guardians: { unlocked: [], equipped: null },
    flags: {},
  };
}

/* ---------------------------------------------------------
   LOAD DO CACHE + AUTO REPAIR MÍNIMO
--------------------------------------------------------- */
export function loadUserCached(userId) {
  if (cache.has(userId)) return cache.get(userId);
  
  let loaded = allDiskData[userId];
  
  if (!loaded || typeof loaded !== "object" || !loaded.id) {
    loaded = createFallbackUser(userId);
    console.log(`[Cache] Novo usuário criado: ${userId}`);
    dirty.add(userId);
  }
  
  cache.set(userId, loaded);
  return loaded;
}

/* ---------------------------------------------------------
   Marca como sujo para salvar futuramente
--------------------------------------------------------- */
export function markUserDirty(userId) {
  if (userId) dirty.add(userId);
}

/* ---------------------------------------------------------
   Salvar TODOS os usuários sujos em modo seguro
--------------------------------------------------------- */
export function flushCache() {
  if (dirty.size === 0) return;
  
  dirty.forEach((userId) => {
    const userObj = cache.get(userId);
    if (!userObj) delete allDiskData[userId];
    else allDiskData[userId] = userObj;
  });
  
  try {
    fs.writeFileSync(tempPath, JSON.stringify(allDiskData, null, 2));
    fs.renameSync(tempPath, dataPath);
    
    console.log(`[Cache] ${dirty.size} usuários salvos.`);
    dirty.clear();
    
  } catch (err) {
    console.error("[Cache] ERRO CRÍTICO AO SALVAR users.json", err);
  }
}

export function flushDirtyUsers() {
  flushCache();
}

/* ---------------------------------------------------------
   NPC Generator usado na Arena
--------------------------------------------------------- */
export function generateOpponentForRank(elo) {
  const level = Math.max(1, Math.floor(elo / 100) + 1);
  const gold = level * 50;
  const gems = Math.floor(level / 5);
  
  return {
    id: `npc_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    name: `NPC_${elo}`,
    level,
    gold,
    gems,
    
    energy: { current: 100, max: 100 },
    
    cards: [],
    decks: {},
    graveyard: [],
  };
}