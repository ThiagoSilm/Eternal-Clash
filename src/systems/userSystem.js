// userSystem.js
import { loadUserCached, markUserDirty } from "./userCacheSystem.js";

/**
 * Garante que todos os campos obrigatórios do usuário existam e estejam corretos.
 * Usado para corrigir dados quebrados no cache.
 */
function sanitizeUser(user) {
    if (!user || typeof user !== "object") return initializeNewUser("undefined");
    
    return {
        id: user.id ?? "undefined",
        
        level: Number(user.level) > 0 ? Number(user.level) : 1,
        xp: Number(user.xp) >= 0 ? Number(user.xp) : 0,
        
        energy: {
            current: Number(user.energy?.current) >= 0 ? Number(user.energy.current) : 100,
            max: Number(user.energy?.max) > 0 ? Number(user.energy.max) : 100,
        },
        
        gold: Number(user.gold) >= 0 ? Number(user.gold) : 0,
        gems: Number(user.gems) >= 0 ? Number(user.gems) : 0,
        coupons: Number(user.coupons) >= 0 ? Number(user.coupons) : 0,
        
        cards: Array.isArray(user.cards) ? user.cards : [],
        decks: typeof user.decks === "object" ? user.decks : {},
        
        graveyard: Array.isArray(user.graveyard) ? user.graveyard : [],
    };
}

/**
 * Cria um novo usuário com dados padrão.
 */
function initializeNewUser(userId) {
    return {
        id: userId,
        level: 1,
        xp: 0,
        energy: { current: 100, max: 100 },
        gold: 0,
        gems: 0,
        coupons: 0,
        cards: [],
        decks: {},
        graveyard: []
    };
}

/**
 * Carrega o usuário do cache. Se ele não existir ou estiver quebrado,
 * cria um novo e marca para salvar.
 */
export function loadUser(userId) {
    let user = loadUserCached(userId);
    
    if (!user || !user.id) {
        user = initializeNewUser(userId);
        markUserDirty(userId);
        return user;
    }
    
    // Corrige casos onde o user do cache vem quebrado ou incompleto
    const sanitized = sanitizeUser(user);
    
    // Se sanitizado for diferente, salva no próximo ciclo
    if (JSON.stringify(user) !== JSON.stringify(sanitized)) {
        markUserDirty(userId);
    }
    
    return sanitized;
}

/**
 * Marca os dados de usuário para serem salvos.
 * O sistema de cache real é quem persiste no disco.
 */
export function saveUserData(user) {
    if (!user || !user.id) throw new Error("Objeto de usuário inválido.");
    markUserDirty(user.id);
}

/**
 * Retorna o nível atual do usuário.
 */
export function getUserLevel(userId) {
    return loadUser(userId).level;
}

/**
 * Retorna um card pelo uniqueId dentro do user.
 */
export function getCardByUniqueId(user, uniqueId) {
    if (!user || !Array.isArray(user.cards) || !uniqueId) return null;
    return user.cards.find(card => card?.uniqueId === uniqueId) ?? null;
}