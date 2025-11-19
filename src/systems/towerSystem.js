// src/systems/towerSystem.js

import { markUserDirty } from "./userCacheSystem.js";
import { addGold, addXP, spendGems } from "./economySystem.js";
import { giveShardToUser } from "./cardSystem.js";

// ----------------------------------------------
// 🔧 CONFIGURAÇÃO
// ----------------------------------------------
const MAX_FLOOR = 120;
const DAILY_ATTEMPTS = 3;
const REWARD_SCALING_FACTOR = 1.15;

// ----------------------------------------------
// 🏗 GEMAS TEMPORÁRIAS
// ----------------------------------------------
export function addTemporaryGem(user, gem) {
    if (!user.tower.tempGems) user.tower.tempGems = [];
    user.tower.tempGems.push(gem);
    markUserDirty(user.id);
}

export function clearTemporaryGems(user) {
    user.tower.tempGems = [];
    markUserDirty(user.id);
}

// ----------------------------------------------
// 🔥 INIMIGOS
// ----------------------------------------------
export function getFloorEnemy(floor) {
    const seed = floor % 10;
    const suffix = (seed % 3 === 0) ? "Golem" :
        (seed % 3 === 1) ? "Dragão" : "Assassino";
    
    const hp = Math.floor((500 + floor * 50) * (1 + seed * 0.05));
    const atk = Math.floor((50 + floor * 10) * (1 + seed * 0.05));
    
    const isBoss = floor % 5 === 0;
    return {
        id: `E_TOWER_${floor}`,
        name: isBoss ? `👑 Boss do Andar ${floor} (${suffix})` : `Guardião do Andar ${floor} (${suffix})`,
        hp,
        attack: atk,
        type: "tower_enemy",
        isPlayer: false,
        deck: []
    };
}

// ----------------------------------------------
// 🎁 RECOMPENSAS
// ----------------------------------------------
export function getFloorReward(floor) {
    const gold = Math.floor(500 * Math.pow(REWARD_SCALING_FACTOR, floor - 1));
    const xp = Math.floor(200 * Math.pow(REWARD_SCALING_FACTOR, floor - 1));
    return { gold, xp };
}

// Multiplicador de combo de vitórias
export function applyWinStreakMultiplier(reward, winStreak, floor) {
    const multiplier = 1 + winStreak * 0.1;
    reward.gold = Math.floor(reward.gold * multiplier * (1 + floor * 0.05));
    reward.xp = Math.floor(reward.xp * multiplier * (1 + floor * 0.05));
    return reward;
}

// ----------------------------------------------
// 🏆 TOWER TOKENS
// ----------------------------------------------
export function addTowerTokens(user, amount) {
    if (!user.tower) return;
    if (!user.tower.tokens) user.tower.tokens = 0;
    user.tower.tokens += amount;
    markUserDirty(user.id);
}

export function spendTowerTokens(user, amount) {
    if (!user.tower.tokens || user.tower.tokens < amount) return false;
    user.tower.tokens -= amount;
    markUserDirty(user.id);
    return true;
}

// ----------------------------------------------
// 💎 SHARDS
// ----------------------------------------------
const TOWER_SHARDS = {
    "3": ["golem3", "ninja3", "minotauro3"],
    "4": ["dragao4", "anjo4", "lich4"],
    "5": ["fenix5", "celestial5"]
};

function rand(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function rollShard() {
    const r = Math.random();
    if (r < 0.70) return { rarity: 3, id: rand(TOWER_SHARDS["3"]) };
    if (r < 0.95) return { rarity: 4, id: rand(TOWER_SHARDS["4"]) };
    return { rarity: 5, id: rand(TOWER_SHARDS["5"]) };
}

function makeShopItem(s) {
    return { id: s.id, rarity: s.rarity, cost: s.rarity === 3 ? 30 : s.rarity === 4 ? 60 : 180 };
}

// ----------------------------------------------
// 🏪 LOJA
// ----------------------------------------------
export function initTowerShop(user) {
    if (!user.towerShop) user.towerShop = { lastReset: 0, items: [] };
    
    const now = Date.now();
    const today = new Date(now).toISOString().split("T")[0];
    const last = new Date(user.towerShop.lastReset).toISOString().split("T")[0];
    
    if (today !== last) {
        user.towerShop.lastReset = now;
        user.towerShop.items = [];
        
        for (let i = 0; i < 3; i++) {
            const s = rollShard();
            if (s.rarity === 5) { i--; continue; }
            user.towerShop.items.push(makeShopItem(s));
        }
        
        if (Math.random() < 0.2) user.towerShop.items.push(makeShopItem(rollShard()));
        
        markUserDirty(user.id);
    }
}

export function getTowerShop(user) {
    initTowerShop(user);
    const tt = user.tower.tokens || 0;
    let out = `🏪 **Loja da Torre** — Você tem **${tt} TT**\n\n`;
    user.towerShop.items.forEach((it, i) => {
        out += `**${i + 1}.** ${it.id} (${it.rarity}★) — **${it.cost} TT**\n`;
    });
    return out;
}

export function buyTowerShopItem(user, index) {
    initTowerShop(user);
    const item = user.towerShop.items[index - 1];
    if (!item) return "❌ Item inválido.";
    if (!spendTowerTokens(user, item.cost)) return `❌ Você precisa de **${item.cost} TT**.`;
    giveShardToUser(user, item.id, 1);
    return `✅ Você comprou **1 shard ${item.id} (${item.rarity}★)**!`;
}

// ----------------------------------------------
// 🔮 EVENTOS ALEATÓRIOS
// ----------------------------------------------
export function getRandomTowerEvent(floor) {
    const roll = Math.random();
    if (roll < 0.25) return { type: "buff", value: 0.2, description: "Inimigo enfraquecido pelo andar" };
    if (roll < 0.45) return { type: "debuff", value: 0.2, description: "Inimigo fortalecido pelo andar" };
    if (roll < 0.65) {
        const gems = ["Fúria", "Proteção", "Velocidade", "Crítico"];
        const gem = gems[Math.floor(Math.random() * gems.length)];
        return { type: "gem", gem, description: `Gema temporária concedida: ${gem}` };
    }
    if (roll < 0.85) {
        const stories = [
            "Um vento gelado percorre a Torre.",
            "As paredes sussurram segredos antigos.",
            "Você encontra inscrições de um herói perdido.",
            "Passos misteriosos ecoam pelo andar."
        ];
        return { type: "lore", description: stories[Math.floor(Math.random() * stories.length)] };
    }
    return null;
}

// ----------------------------------------------
// 🧱 RESET DIÁRIO
// ----------------------------------------------
function checkDailyInit(user) {
    if (!user.tower) {
        user.tower = { floor: 1, attempts: DAILY_ATTEMPTS, lastAccess: 0, tokens: 0, tempGems: [], winStreak: 0 };
    }
    
    const now = Date.now();
    const today = new Date(now).toISOString().split("T")[0];
    const last = new Date(user.tower.lastAccess).toISOString().split("T")[0];
    
    let msg = null;
    
    if (today !== last) {
        user.tower.attempts = DAILY_ATTEMPTS;
        user.tower.lastAccess = now;
        clearTemporaryGems(user);
        
        if (user.tower.floor > 1) {
            const prev = user.tower.floor - 1;
            const r = getFloorReward(prev);
            addGold(user, r.gold);
            addXP(user, r.xp);
            msg = `🎉 Bem-vindo de volta! Tentativas resetadas: **${DAILY_ATTEMPTS}**.\nRecompensa do Andar ${prev}: +${r.gold} ouro, +${r.xp} XP.`;
        } else {
            msg = `🎉 Tentativas resetadas: **${DAILY_ATTEMPTS}**.`;
        }
        markUserDirty(user.id);
    }
    
    return msg;
}

// ----------------------------------------------
// 🔥 TENTATIVAS
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

export function buyTowerAttempts(user, amount = 1) {
    checkDailyInit(user);
    if (amount <= 0) return "❌ Quantidade inválida.";
    const cost = amount * 5;
    if (!spendGems(user, cost)) return `❌ Você precisa de **${cost} Gemas**.`;
    user.tower.attempts += amount;
    markUserDirty(user.id);
    return `💎 Você comprou **${amount}** tentativas. Tentativas atuais: ${user.tower.attempts}.`;
}

// ----------------------------------------------
// 📊 STATUS
// ----------------------------------------------
export function getTowerStatus(user) {
    const d = checkDailyInit(user);
    const floor = user.tower.floor;
    const attempts = user.tower.attempts;
    const enemy = getFloorEnemy(floor);
    const reward = getFloorReward(floor);
    
    let t = `**Andar Atual:** ${floor}/${MAX_FLOOR}\n**Tentativas:** ${attempts}/${DAILY_ATTEMPTS}\n**Tower Tokens:** ${user.tower.tokens || 0}\n💪 Combo de vitórias: ${user.tower.winStreak}\n`;
    
    if (user.tower.tempGems?.length > 0) {
        t += `💎 Gemas ativas: ${user.tower.tempGems.join(", ")}\n`;
    }
    
    if (floor <= MAX_FLOOR) {
        t += `\n⚔️ **Próximo Inimigo:** ${enemy.name}\n• HP: ${enemy.hp}\n• ATK: ${enemy.attack}\n\n🎁 **Recompensa:** +${reward.gold} Ouro, +${reward.xp} XP`;
    } else {
        t += `\n🏆 **VOCÊ CONCLUIU OS ${MAX_FLOOR} ANDARES DA TORRE!**`;
    }
    
    return d ? `${d}\n\n${t}` : t;
}

// ----------------------------------------------
// 🏆 RANKINGS SIMPLES
// ----------------------------------------------
export function getTowerRankings() {
    return [
        { username: "Player1", floor: 25 },
        { username: "Player2", floor: 20 },
        { username: "Player3", floor: 18 }
    ];
}