// src/systems/towerSystem.js

import { markUserDirty } from "./userCacheSystem.js";
import { addGold, addXP, spendGems } from "./economySystem.js";

// ----------------------------------------------
// 🔧 CONFIG
// ----------------------------------------------
const MAX_FLOOR = 120;
const DAILY_ATTEMPTS = 3;
const REWARD_SCALING_FACTOR = 1.15;

// ----------------------------------------------
// 🔥 ENEMY GENERATION
// ----------------------------------------------
export function getFloorEnemy(floor) {
    const seed = floor % 10;
    const suffix = (seed % 3 === 0) ? "Golem" : (seed % 3 === 1) ? "Dragão" : "Assassino";
    
    const hp = Math.floor((500 + floor * 50) * (1 + seed * 0.05));
    const atk = Math.floor((50 + floor * 10) * (1 + seed * 0.05));
    
    return {
        id: `E_TOWER_${floor}`,
        name: `Guardião do Andar ${floor} (${suffix})`,
        hp,
        attack: atk,
        type: "tower_enemy",
        isPlayer: false,
        deck: []
    };
}

// ----------------------------------------------
// 🎁 REWARD SYSTEM
// ----------------------------------------------
export function getFloorReward(floor) {
    const gold = Math.floor(500 * Math.pow(REWARD_SCALING_FACTOR, floor - 1));
    const xp = Math.floor(200 * Math.pow(REWARD_SCALING_FACTOR, floor - 1));
    
    return { gold, xp };
}

// ----------------------------------------------
// 🧱 USER STATE MANAGEMENT
// ----------------------------------------------
function checkDailyInit(user) {
    if (!user.tower) {
        user.tower = {
            floor: 1,
            attempts: DAILY_ATTEMPTS,
            lastAccess: 0
        };
    }
    
    const now = Date.now();
    const today = new Date(now).toISOString().split("T")[0];
    const last = new Date(user.tower.lastAccess).toISOString().split("T")[0];
    
    let message = null;
    
    if (today !== last) {
        user.tower.attempts = DAILY_ATTEMPTS;
        user.tower.lastAccess = now;
        
        if (user.tower.floor > 1) {
            const prev = user.tower.floor - 1;
            const r = getFloorReward(prev);
            
            addGold(user, r.gold);
            addXP(user, r.xp);
            
            message =
                `🎉 **Bem-vindo de volta à Torre!**\n` +
                `Tentativas resetadas: **${DAILY_ATTEMPTS}**.\n` +
                `Recompensa do Andar ${prev}: +${r.gold} ouro, +${r.xp} XP.`;
        } else {
            message = `🎉 Tentativas resetadas: **${DAILY_ATTEMPTS}**.`;
        }
        
        markUserDirty(user.id);
    }
    
    return message;
}

// ----------------------------------------------
// 🔥 SPEND ATTEMPT
// ----------------------------------------------
export function spendTowerAttempt(user) {
    checkDailyInit(user);
    
    if (user.tower.attempts > 0) {
        user.tower.attempts--;
        user.tower.lastAccess = Date.now();
        markUserDirty(user.id);
        return true;
    }
    return false;
}

// ----------------------------------------------
// 📊 STATUS
// ----------------------------------------------
export function getTowerStatus(user) {
    const dailyMsg = checkDailyInit(user);
    
    const floor = user.tower.floor;
    const attempts = user.tower.attempts;
    
    const enemy = getFloorEnemy(floor);
    const reward = getFloorReward(floor);
    
    let t =
        `**Andar Atual:** ${floor}/${MAX_FLOOR}\n` +
        `**Tentativas:** ${attempts}/${DAILY_ATTEMPTS}\n\n`;
    
    if (floor <= MAX_FLOOR) {
        t +=
            `⚔️ **Próximo Inimigo:** ${enemy.name}\n` +
            `• HP: ${enemy.hp}\n` +
            `• ATK: ${enemy.attack}\n\n` +
            `🎁 **Recompensa:** +${reward.gold} Ouro, +${reward.xp} XP`;
    } else {
        t += `🏆 **VOCÊ CONCLUIU OS ${MAX_FLOOR} ANDARES DA TORRE!**`;
    }
    
    return dailyMsg ? `${dailyMsg}\n\n${t}` : t;
}

// ----------------------------------------------
// 💎 BUY ATTEMPTS
// ----------------------------------------------
export function buyTowerAttempts(user, amount = 1) {
    checkDailyInit(user);
    
    if (amount <= 0) return "❌ Quantidade inválida.";
    
    const cost = amount * 5;
    
    if (!spendGems(user, cost)) {
        return `❌ Você precisa de **${cost} Gemas**.`;
    }
    
    user.tower.attempts += amount;
    markUserDirty(user.id);
    
    return `💎 Você comprou **${amount}** tentativas. Tentativas atuais: ${user.tower.attempts}.`;
}