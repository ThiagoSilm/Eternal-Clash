// src/systems/towerSystem.js

// ----------------------------------------------------
// 🔹 CONFIGURAÇÃO DE DIFICULDADE (Andares)
// ----------------------------------------------------

// Define como os inimigos e as recompensas escalam por andar
const TOWER_SCALING = {
    BASE_HP: 100,
    HP_PER_FLOOR: 50,
    BASE_ATTACK: 30,
    ATTACK_PER_FLOOR: 15,
    XP_BASE: 500,
    GOLD_BASE: 300,
    REWARD_MULTIPLIER: 1.15, // Multiplicador de recompensas por andar
    MAX_ATTEMPTS: 3,
};

// ----------------------------------------------------
// 🔹 FUNÇÕES DO SISTEMA
// ----------------------------------------------------

/**
 * Retorna o status formatado da Torre para o usuário.
 * @param {object} user O objeto usuário.
 * @returns {string} O status atual da Torre.
 */
export function getTowerStatus(user) {
    const floor = user.tower.floor;
    const attempts = user.tower.attempts;

    return `
• **Andar Atual:** ${floor}
• **Tentativas Restantes:** ${attempts}/${TOWER_SCALING.MAX_ATTEMPTS}
• **Próximo Inimigo:** [Lv. ${Math.floor(floor / 5) + 1}] Guardião do Andar ${floor}
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
    
    // O inimigo terá 1 carta que representa o chefe do andar
    const enemyCard = { name: `Guardião do Andar ${floor}`, hp, attack, level };

    return {
        id: `TOWER_ENEMY_${floor}`,
        name: `Guardião da Torre (Andar ${floor})`,
        cards: [enemyCard],
        // O poder do guardião inimigo pode ser baseado no andar
        guardianId: Math.floor(floor / 10) + 1 
    };
}

/**
 * Calcula e retorna as recompensas por completar um andar.
 * @param {number} floor O número do andar.
 * @returns {{xp: number, gold: number}} Recompensas.
 */
export function getFloorReward(floor) {
    const xp = Math.floor(TOWER_SCALING.XP_BASE * Math.pow(TOWER_SCALING.REWARD_MULTIPLIER, floor - 1));
    const gold = Math.floor(TOWER_SCALING.GOLD_BASE * Math.pow(TOWER_SCALING.REWARD_MULTIPLIER, floor - 1));

    // Recompensa especial (ex: carta rara) a cada 10 andares
    if (floor % 10 === 0) {
        // Lógica para obter carta rara
    }

    return { xp, gold };
}

/**
 * Diminui o contador de tentativas da Torre do usuário.
 * @param {object} user O objeto usuário.
 */
export function spendTowerAttempt(user) {
    if (user.tower.attempts > 0) {
        user.tower.attempts -= 1;
        // O objeto 'user' é modificado e será salvo pelo middleware.
    }
}
