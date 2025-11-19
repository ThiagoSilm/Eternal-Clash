// src/systems/userSystem.js

import { loadUserCached, markUserDirty } from "./userCacheSystem.js";

// =========================================================
// ⚙️ TIPAGEM E TEMPLATE DE ESTADO
// =========================================================

/**
 * @typedef {object} EnergyState
 * @property {number} current
 * @property {number} max
 * @property {number} [lastRegen] - Timestamp do último tick de regeneração.
 */

/**
 * @typedef {object} ArenaState
 * @property {number} attempts
 * @property {number} lastAttack
 * @property {number} rank
 */

/**
 * @typedef {object} TowerState
 * @property {number} floor
 * @property {number} attempts
 * @property {number} [lastAccess]
 * @property {number} [tokens]
 */

/**
 * @typedef {object} GuardianState
 * @property {string[]} unlocked
 * @property {string | null} equipped
 */

/**
 * @typedef {object} UserState
 * @property {string} id
 * @property {string} [name]
 * @property {number} level
 * @property {number} xp
 * @property {EnergyState} energy
 * @property {number} gold
 * @property {number} gems
 * @property {number} [coupons]
 * @property {object[]} cards - Cartas possuídas (com uniqueId).
 * @property {object} decks - Definições de decks.
 * @property {object[]} graveyard - Cartas descartadas/destruídas.
 * @property {ArenaState} arena
 * @property {TowerState} tower
 * @property {GuardianState} guardians
 * @property {object} flags
 * @property {object} [inventory] - Inventário de itens genéricos (adicionado para consistência).
 */

/** @type {UserState} */
const USER_TEMPLATE = Object.freeze({
    id: "",
    name: "", // Adicionado nome padrão para clareza
    level: 1,
    xp: 0,
    
    energy: { current: 100, max: 100, lastRegen: Date.now() },
    
    gold: 0,
    gems: 0,
    coupons: 0, // Moeda/Recurso genérico
    inventory: {}, // Item/Material storage
    
    cards: [],
    decks: {},
    graveyard: [],
    
    arena: { attempts: 0, lastAttack: 0, rank: 1 },
    tower: { attempts: 0, floor: 1, tokens: 0, lastAccess: 0 },
    
    guardians: { unlocked: [], equipped: null },
    flags: {},
});

// =========================================================
// 🔄 FUNÇÕES DE SANEAMENTO E INICIALIZAÇÃO
// =========================================================

/**
 * Cria um objeto de usuário limpo, preenchendo os campos padrão.
 * @param {string} userId
 * @returns {UserState}
 */
function initializeNewUser(userId) {
    // Usa structuredClone para garantir uma cópia profunda, limpa e mutável.
    const base = structuredClone(USER_TEMPLATE);
    base.id = userId;
    base.name = `Player_${userId.slice(0, 6)}`;
    return base;
}

/**
 * Aplica o saneamento e o auto-repair em um objeto de usuário carregado do disco.
 * * 1. Garante que todos os campos de USER_TEMPLATE existam.
 * 2. Verifica a validade dos tipos (números > 0, arrays, etc.).
 * 3. Preserva dados válidos existentes.
 * * @param {object} rawUser - O objeto de usuário carregado.
 * @returns {UserState} O objeto saneado.
 */
function sanitizeUser(rawUser) {
    if (!rawUser || typeof rawUser !== "object") {
        console.warn("[Sanitize] Usuário bruto inválido. Criando fallback.");
        return initializeNewUser("undefined_user");
    }
    
    // Objeto final que conterá os dados saneados
    const sanitizedUser = { ...rawUser }; // Começa com os dados existentes
    let isDirty = false;

    // Itera sobre o template para garantir que todos os campos existam e sejam válidos
    for (const key in USER_TEMPLATE) {
        if (!USER_TEMPLATE.hasOwnProperty(key)) continue;

        const templateValue = USER_TEMPLATE[key];
        const currentValue = rawUser[key];
        
        // 1. Campo ausente no objeto carregado
        if (currentValue === undefined || currentValue === null) {
            sanitizedUser[key] = structuredClone(templateValue);
            isDirty = true;
            continue;
        }

        // 2. Saneamento de Tipos Específicos

        // Sub-objetos (e.g., energy, arena, tower): Aplica saneamento recursivo/específico
        if (typeof templateValue === 'object' && !Array.isArray(templateValue)) {
            if (typeof currentValue !== 'object') {
                sanitizedUser[key] = structuredClone(templateValue);
                isDirty = true;
                continue;
            }
            
            // Saneamento detalhado para os campos complexos
            if (key === 'energy') {
                const e = currentValue;
                const templateE = templateValue;
                
                sanitizedUser.energy = {
                    current: Math.max(0, Number(e.current) || templateE.current),
                    max: Math.max(1, Number(e.max) || templateE.max),
                    lastRegen: Number(e.lastRegen) || templateE.lastRegen,
                };
                if (sanitizedUser.energy.current > sanitizedUser.energy.max) {
                    sanitizedUser.energy.current = sanitizedUser.energy.max;
                }
                // Não marcamos como dirty a menos que a validação falhe.
                continue;
            }
            
            // Para outros objetos (decks, flags, arena, tower, guardians):
            // Garante que todas as sub-propriedades do template existam, sem perder dados extras
            let subDirty = false;
            for (const subKey in templateValue) {
                if (currentValue[subKey] === undefined) {
                    currentValue[subKey] = structuredClone(templateValue[subKey]);
                    subDirty = true;
                }
            }
            if (subDirty) isDirty = true;
            
        } 
        
        // Numéricos (Certifica-se que sejam números e não negativos, exceto level/xp que podem ser 0)
        else if (typeof templateValue === 'number') {
             const cleanValue = Number(currentValue);
             if (isNaN(cleanValue) || cleanValue < 0) {
                 sanitizedUser[key] = templateValue;
                 isDirty = true;
             }
        } 
        
        // Arrays (Garante que é um array, senão usa o template vazio)
        else if (Array.isArray(templateValue)) {
            if (!Array.isArray(currentValue)) {
                sanitizedUser[key] = [];
                isDirty = true;
            }
        }
        
        // Strings (Garante que é uma string)
        else if (typeof templateValue === 'string') {
            if (typeof currentValue !== 'string') {
                sanitizedUser[key] = templateValue;
                isDirty = true;
            }
        }
    }
    
    // Se o saneamento alterou o objeto, retornamos a nova cópia e marcamos para salvar.
    if (isDirty) {
        markUserDirty(sanitizedUser.id);
        return sanitizedUser;
    }
    
    // Se não houve alteração, retornamos o objeto original (rawUser) se ele já foi limpo anteriormente.
    // Retornar 'rawUser' preserva a referência no cache, otimizando o desempenho.
    return rawUser;
}

// =========================================================
// 🗃️ FUNÇÕES PÚBLICAS (API)
// =========================================================

/**
 * Carrega o estado do usuário do cache ou disco e aplica saneamento completo.
 * Este deve ser o único ponto de entrada para obter o estado do usuário.
 * @param {string} userId
 * @returns {UserState} O objeto de usuário saneado (mutável, referenciado pelo cache).
 */
export function loadUser(userId) {
    if (!userId) throw new Error("ID do usuário é obrigatório.");
    
    // loadUserCached faz o carregamento, fallback mínimo e cache.
    const user = loadUserCached(userId);
    
    // Aplica saneamento para garantir que o objeto seja válido e completo.
    // sanitizeUser retorna o objeto original se nenhuma mudança for necessária,
    // ou uma nova cópia se houver alterações, marcando-o como sujo.
    const sanitizedUser = sanitizeUser(user);
    
    // Nota: Se sanitizedUser for diferente de user, userCacheSystem.js deve 
    // garantir que a nova referência (sanitizedUser) seja atualizada no cache 
    // ou que o sistema que chama loadUser use a referência retornada.
    return sanitizedUser;
}

/**
 * Sinaliza que o estado do usuário foi modificado e precisa ser salvo.
 * @param {UserState} user
 * @throws {Error} Se o objeto de usuário for inválido.
 */
export function saveUserData(user) {
    if (!user || !user.id) throw new Error("saveUserData: usuário inválido.");
    // A função markUserDirty do cache faz a persistência eventual.
    markUserDirty(user.id);
}

/**
 * Retorna o nível de um usuário.
 * @param {string} userId
 * @returns {number} O nível do usuário.
 */
export function getUserLevel(userId) {
    return loadUser(userId).level;
}

/**
 * Localiza e retorna uma carta específica do inventário do usuário pelo seu ID único.
 * @param {UserState} user - Objeto do usuário.
 * @param {string} uniqueId - O ID único da carta.
 * @returns {object | null} A carta encontrada ou null.
 */
export function getCardByUniqueId(user, uniqueId) {
    if (!user || !Array.isArray(user.cards)) return null;
    
    // Assume que a estrutura da carta tem uma propriedade 'uniqueId'
    return user.cards.find(c => c?.uniqueId === uniqueId) || null;
}
