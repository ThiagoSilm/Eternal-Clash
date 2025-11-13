import { markUserDirty } from "./userCacheSystem.js";

const TOWER_SCALING = {
    BASE_HP: 100,
    HP_PER_FLOOR: 50,
    BASE_ATTACK: 30,
    ATTACK_PER_FLOOR: 15,
    XP_BASE: 500,
    GOLD_BASE: 300,
    REWARD_MULTIPLIER: 1.15,
    MAX_ATTEMPTS: 3,
    RESET_COOLDOWN_MS: 24 * 60 * 60 * 1000,
};

export function initializeTower(user) {
    if (!user.tower) {
        user.tower = {
            floor: 1,
            attempts: TOWER_SCALING.MAX_ATTEMPTS,
            lastAttemptReset: 0,
        };
        markUserDirty(user.id);
    }
}

export function checkAndResetAttempts(user) {
    initializeTower(user);
    const now = Date.now();
    if (now - user.tower.lastAttemptReset >= TOWER_SCALING.RESET_COOLDOWN_MS) {
        user.tower.attempts = TOWER_SCALING.MAX_ATTEMPTS;
        user.tower.lastAttemptReset = now;
        markUserDirty(user.id);
        return true;
    }
    return false;
}

export function getTowerStatus(user) {
    checkAndResetAttempts(user);
    const floor = user.tower.floor;
    const attempts = user.tower.attempts;
    const nextResetTime = user.tower.lastAttemptReset + TOWER_SCALING.RESET_COOLDOWN_MS;
    const msRemaining = nextResetTime - Date.now();
    const timeRemaining = msRemaining > 0 ? (msRemaining / 3600000).toFixed(1) + "h" : "Pronto";
    return `
• Andar Atual: ${floor}
• Tentativas Restantes: ${attempts}/${TOWER_SCALING.MAX_ATTEMPTS}
• Próximo Inimigo: [Lv. ${Math.max(1, Math.floor(floor / 5) + 1)}] Guardião do Andar ${floor}
• Reset de Tentativas: ${timeRemaining}
`;
}

export function getFloorEnemy(floor) {
    const level = Math.max(1, Math.floor(floor / 5) + 1);
    const hp = TOWER_SCALING.BASE_HP + floor * TOWER_SCALING.HP_PER_FLOOR;
    const attack = TOWER_SCALING.BASE_ATTACK + floor * TOWER_SCALING.ATTACK_PER_FLOOR;
    const enemyCard = {
        id: `CARD_TOWER_${floor}`,
        name: `Guardião do Andar ${floor}`,
        hp,
        attack,
        level,
    };
    return {
        id: `TOWER_ENEMY_${floor}`,
        name: `Guardião da Torre (Andar ${floor})`,
        cards: [enemyCard],
        guardianId: Math.max(1, Math.floor(floor / 10) + 1),
    };
}

export function getFloorReward(floor) {
    const xp = Math.floor(TOWER_SCALING.XP_BASE * Math.pow(TOWER_SCALING.REWARD_MULTIPLIER, floor - 1));
    const gold = Math.floor(TOWER_SCALING.GOLD_BASE * Math.pow(TOWER_SCALING.REWARD_MULTIPLIER, floor - 1));
    const rewards = { xp, gold, items: [] };
    if (floor % 10 === 0) {
        rewards.items.push({ id: "coupon_rare", quantity: 1, type: "item" });
    }
    return rewards;
}

export function spendTowerAttempt(user) {
    initializeTower(user);
    if (user.tower.attempts > 0) {
        user.tower.attempts -= 1;
        markUserDirty(user.id);
        return true;
    }
    return false;
}

export function advanceFloor(user) {
    initializeTower(user);
    user.tower.floor += 1;
    markUserDirty(user.id);
}