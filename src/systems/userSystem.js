// src/systems/userSystem.js
import { loadUserCached, markUserDirty } from "./userCacheSystem.js";

/* ---------------------------------------------
   CAMPOS PADRÃO DO USUÁRIO
------------------------------------------------*/
const USER_TEMPLATE = {
    id: "",
    level: 1,
    xp: 0,
    
    energy: { current: 100, max: 100 },
    
    gold: 0,
    gems: 0,
    coupons: 0,
    
    cards: [],
    decks: {},
    graveyard: [],
    
    // ✔ Suporte futuro automático
    arena: {
        attempts: 0,
        lastAttack: 0,
        rank: 1,
    },
    
    tower: {
        attempts: 0,
        floor: 1,
        shards: 0,
    },
    
    guardians: {
        unlocked: [],
        equipped: null,
    },
    
    flags: {}, // sempre útil
};

/* ---------------------------------------------
   CRIAR NOVO USUÁRIO
------------------------------------------------*/
function initializeNewUser(userId) {
    const base = structuredClone(USER_TEMPLATE);
    base.id = userId;
    return base;
}

/* ---------------------------------------------
   SANEAMENTO COMPLETO (blindado)
------------------------------------------------*/
function sanitizeUser(user) {
    if (!user || typeof user !== "object") return initializeNewUser("undefined");
    
    const clean = structuredClone(USER_TEMPLATE);
    
    for (const key of Object.keys(clean)) {
        const value = user[key];
        
        if (value === undefined || value === null) continue;
        
        // Energia
        if (key === "energy") {
            clean.energy.current = Number(value.current) >= 0 ? Number(value.current) : clean.energy.current;
            clean.energy.max = Number(value.max) > 0 ? Number(value.max) : clean.energy.max;
            continue;
        }
        
        // Numéricos
        if (typeof clean[key] === "number") {
            clean[key] = Number(value) >= 0 ? Number(value) : clean[key];
            continue;
        }
        
        // Listas
        if (Array.isArray(clean[key])) {
            clean[key] = Array.isArray(value) ? value : clean[key];
            continue;
        }
        
        // Objetos
        if (typeof clean[key] === "object") {
            clean[key] = typeof value === "object" ? { ...clean[key], ...value } : clean[key];
            continue;
        }
        
        // Strings
        clean[key] = value;
    }
    
    return clean;
}

/* ---------------------------------------------
   LOAD + SANEAMENTO + AUTO-REPAIR
------------------------------------------------*/
export function loadUser(userId) {
    let user = loadUserCached(userId);
    
    if (!user || !user.id) {
        const fresh = initializeNewUser(userId);
        markUserDirty(userId);
        return fresh;
    }
    
    const sanitized = sanitizeUser(user);
    
    if (JSON.stringify(user) !== JSON.stringify(sanitized)) {
        markUserDirty(userId);
    }
    
    return sanitized;
}

/* ---------------------------------------------
   SAVE
------------------------------------------------*/
export function saveUserData(user) {
    if (!user || !user.id) throw new Error("saveUserData: usuário inválido.");
    markUserDirty(user.id);
}

/* ---------------------------------------------
   GET LEVEL
------------------------------------------------*/
export function getUserLevel(userId) {
    return loadUser(userId).level;
}

/* ---------------------------------------------
   GET CARD BY UNIQUE ID
------------------------------------------------*/
export function getCardByUniqueId(user, uniqueId) {
    if (!user || !Array.isArray(user.cards)) return null;
    return user.cards.find(c => c?.uniqueId === uniqueId) || null;
}