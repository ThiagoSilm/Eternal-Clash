// src/systems/towerSystem.js

// Importação necessária para marcar o usuário como modificado, se houver alteração
import { markUserDirty } from "./userCacheSystem.js";

// ----------------------------------------------------
// 🔹 CONFIGURAÇÃO DE DIFICULDADE (Andares)
// ----------------------------------------------------

const TOWER_SCALING = {
    BASE_HP: 100,
    HP_PER_FLOOR: 50,
    BASE_ATTACK: 30,
    ATTACK_PER_FLOOR: 15,
    XP_BASE: 500,
    GOLD_BASE: 300,
    REWARD_MULTIPLIER: 1.15, // Multiplicador de recompensas por andar
    MAX_ATTEMPTS: 3,
    RESET_COOLDOWN_MS: 24 * 60 * 60 * 1000, // 24 horas em milissegundos
};

// ----------------------------------------------------
// 🔹 FUNÇÕES DO SISTEMA
// ----------------------------------------------------

/**
 * Checa e reseta as tentativas diárias do usuário se o cooldown expirou.
 * Deve ser chamada no início de todo comando de torre.
 * @param {object} user O objeto usuário.
 */
export function checkAndResetAttempts(user) {
    const now = Date.now();
    
    // Garantir que a estrutura exista e tenha o campo lastReset
    if (!user.tower.lastAttemptReset) {
        user.tower.lastAttemptReset = 0;
    }

    if (now - user.tower.lastAttemptReset >= TOWER_SCALING.RESET_COOLDOWN_MS) {
        user.tower.attempts = TOWER_SCALING.MAX_ATTEMPTS;
        user.tower.lastAttemptReset = now;
        
        // Marca o usuário como dirty, pois houve uma alteração
        markUserDirty(user.id);
        
        return true; // Tentativas resetadas
    }
    return false; // Não houve reset
}


/**
 * Retorna o status formatado da Torre para o usuário.
 * @param {object} user O objeto usuário.
 * @returns {string} O status atual da Torre.
 */
export function getTowerStatus(user) {
    // Garante que o reset seja verificado antes de mostrar o status
    checkAndResetAttempts(user); 

    const floor = user.tower.floor;
    const attempts = user.tower.attempts;
    const nextResetTime = user.tower.lastAttemptReset + TOWER_SCALING.RESET_COOLDOWN_MS;
    const msRemaining = nextResetTime - Date.now();
    const timeRemaining = msRemaining > 0 ? (msRemaining / 3600000).toFixed(1) + 'h' : 'Pronto';

    return `
• **Andar Atual:** ${floor}
• **Tentativas Restantes:** ${attempts}/${TOWER_SCALING.MAX_ATTEMPTS}
• **Próximo Inimigo:** [Lv. ${Math.floor(floor / 5) + 1}] Guardião do Andar ${floor}
• **Reset de Tentativas:** ${timeRemaining}
`;
}

/**
 * Define e retorna o objeto inimigo para o andar atual.
 * @param {number} floor O número do andar.
 * @returns {object} O objeto inimigo formatado para o battleSystem.
 */
export function getFloorEnemy(floor) {
    const level = Math.floor(floor / 5) + 1; // Inimigo ganha níveis a cada 5 andares
    const hp = TOWER_SCALING.BASE_HP + (floor * TOWER_SCALING.HP_PER_FLOOR);
    const attack = TOWER_SCALING.BASE_ATTACK + (floor * TOWER_SCALING.ATTACK_PER_FLOOR);
    
    const enemyCard = { 
        id: `CARD_TOWER_${floor}`, 
        name: `Guardião do Andar ${floor}`, 
        hp, 
        attack, 
        level 
    };

    return {
        id: `TOWER_ENEMY_${floor}`,
        name: `Guardião da Torre (Andar ${floor})`,
        // O inimigo tem um "deck" de apenas uma carta (o chefe)
        cards: [enemyCard], 
        guardianId: Math.floor(floor / 10) + 1 
    };
}

/**
 * Calcula e retorna as recompensas por completar um andar.
 * @param {number} floor O número do andar.
 * @returns {{xp: number, gold: number, items: Array<Object>}} Recompensas.
 */
export function getFloorReward(floor) {
    const xp = Math.floor(TOWER_SCALING.XP_BASE * Math.pow(TOWER_SCALING.REWARD_MULTIPLIER, floor - 1));
    const gold = Math.floor(TOWER_SCALING.GOLD_BASE * Math.pow(TOWER_SCALING.REWARD_MULTIPLIER, floor - 1));
    
    const rewards = { xp, gold, items: [] };

    // Recompensa especial (ex: carta rara) a cada 10 andares
    if (floor % 10 === 0) {
        // Ex: Dando 1 Cupom Raro de Invocação
        rewards.items.push({ id: 'coupon_rare', quantity: 1, type: 'item' });
    }

    return rewards;
}

/**
 * Diminui o contador de tentativas da Torre do usuário.
 * @param {object} user O objeto usuário.
 * @returns {boolean} True se a tentativa foi gasta, false se já esgotada.
 */
export function spendTowerAttempt(user) {
    if (user.tower.attempts > 0) {
        user.tower.attempts -= 1;
        // Já confiamos no middleware para salvar, mas markUserDirty é uma camada extra de segurança
        // caso esta função seja chamada fora de um comando padrão.
        markUserDirty(user.id); 
        return true;
    }
    return false;
}

/**
 * Move o usuário para o próximo andar após uma vitória.
 * @param {object} user O objeto usuário.
 */
export function advanceFloor(user) {
    user.tower.floor += 1;
    markUserDirty(user.id);
}
