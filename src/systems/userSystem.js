import { loadUserCached, markUserDirty } from "./userCacheSystem.js";

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

export function loadUser(userId) {
    let user = loadUserCached(userId);
    if (!user || !user.id) {
        user = initializeNewUser(userId);
        markUserDirty(userId);
    }
    return user;
}

export function saveUserData(user) {
    if (!user || !user.id) throw new Error("Objeto de usuário inválido.");
    markUserDirty(user.id);
}

export function getUserLevel(userId) {
    const user = loadUser(userId);
    return user.level || 1;
}