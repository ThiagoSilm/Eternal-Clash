// src/systems/towerSystem.js

import { markUserDirty } from "./userCacheSystem.js";
import { addGold, addXP } from "./economySystem.js";
import { giveShardToUser } from "./cardSystem.js";
import { initBattle, runTurn } from "./battleSystem.js";

// ----------------------------------------------
// 🔧 CONFIGURAÇÃO
// ----------------------------------------------
const MAX_FLOOR = 120;
const DAILY_ATTEMPTS = 3;
const REWARD_SCALING_FACTOR = 1.15;
const SHARD_TIERS = {
    3: ["golem3", "ninja3", "minotauro3"],
    4: ["dragao4", "anjo4", "lich4"],
    5: ["fenix5", "celestial5"]
};
const GEMS = ["Fúria", "Proteção", "Velocidade", "Crítico"];

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
    const suffix = (seed % 3 === 0) ? "Golem" : (seed % 3 === 1) ? "Dragão" : "Assassino";
    const hp = Math.floor((500 + floor * 50) * (1 + seed * 0.05));
    const atk = Math.floor((50 + floor * 10) * (1 + seed * 0.05));
    const isBoss = floor % 5 === 0;
    
    return {
        id: `E_TOWER_${floor}`,
        name: isBoss ? `👑 Boss do Andar ${floor} (${suffix})` : `Guardião do Andar ${floor} (${suffix})`,
        hp,
        maxHp: hp,
        attack: atk,
        deck: generateEnemyDeck(floor, isBoss),
        type: "tower_enemy",
        isPlayer: false,
    };
}

function generateEnemyDeck(floor, isBoss) {
    const base = isBoss ? 8 : 5;
    const deck = [];
    for (let i = 0; i < base; i++) {
        deck.push({ id: `atk${floor}_${i}`, type: "attack", value: 50 + floor * 5 });
        deck.push({ id: `def${floor}_${i}`, type: "defense", value: 20 + floor * 2 });
    }
    return deck;
}

// ----------------------------------------------
// 🔮 EVENTOS ALEATÓRIOS
// ----------------------------------------------
export function getRandomTowerEvent(floor) {
    const roll = Math.random();
    if (roll < 0.25) return { type: "buff", value: 0.2, description: "Inimigo enfraquecido pelo andar" };
    if (roll < 0.45) return { type: "debuff", value: 0.2, description: "Inimigo fortalecido pelo andar" };
    if (roll < 0.65) {
        const gem = GEMS[Math.floor(Math.random() * GEMS.length)];
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
// 🎁 RECOMPENSAS
// ----------------------------------------------
export function getFloorReward(floor) {
    const gold = Math.floor(500 * Math.pow(REWARD_SCALING_FACTOR, floor - 1));
    const xp = Math.floor(200 * Math.pow(REWARD_SCALING_FACTOR, floor - 1));
    const shards = (floor % 5 === 0) ? [rollShard()] : [];
    return { gold, xp, shards };
}

function rollShard() {
    const r = Math.random();
    if (r < 0.70) return { rarity: 3, id: rand(SHARD_TIERS[3]) };
    if (r < 0.95) return { rarity: 4, id: rand(SHARD_TIERS[4]) };
    return { rarity: 5, id: rand(SHARD_TIERS[5]) };
}

function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// ----------------------------------------------
// 🏗 TOWER PROGRESSÃO
// ----------------------------------------------
export function initTower(user) {
    if (!user.tower) {
        user.tower = {
            floor: 1,
            attempts: DAILY_ATTEMPTS,
            lastAccess: 0,
            winStreak: 0,
            tempGems: []
        };
    }
    markUserDirty(user.id);
}

// ----------------------------------------------
// 🔥 EXECUTAR ANDAR
// ----------------------------------------------
export function climbFloor(user) {
    initTower(user);
    if (user.tower.attempts <= 0) return { success: false, msg: "❌ Sem tentativas restantes." };
    
    user.tower.attempts--;
    const enemy = getFloorEnemy(user.tower.floor);
    const event = getRandomTowerEvent(user.tower.floor);
    
    let logEvent = "";
    if (event) {
        if (event.type === "gem") addTemporaryGem(user, event.gem);
        logEvent = event.description;
    }
    
    const state = initBattle(user, enemy, { auto: true });
    
    let turn = 0;
    while (state.player.hp > 0 && state.enemy.hp > 0 && turn < 60) {
        runTurn(state);
        turn++;
    }
    
    const win = state.enemy.hp <= 0;
    let rewardMsg = "";
    
    if (win) {
        user.tower.floor++;
        user.tower.winStreak++;
        const reward = getFloorReward(user.tower.floor - 1);
        addGold(user, reward.gold);
        addXP(user, reward.xp);
        reward.shards.forEach(s => giveShardToUser(user, s.id, 1));
        rewardMsg = `🎁 Recompensa: +${reward.gold} Ouro, +${reward.xp} XP`;
        if (reward.shards.length) rewardMsg += `, +${reward.shards.map(s => `${s.id} (${s.rarity}★)`).join(", ")}`;
    } else {
        user.tower.winStreak = 0;
        rewardMsg = "❌ Você foi derrotado!";
    }
    
    markUserDirty(user.id);
    return { success: win, log: state.log, event: logEvent, rewardMsg };
}

// ----------------------------------------------
// 🔮 RESET DIÁRIO
// ----------------------------------------------
export function resetDaily(user) {
    initTower(user);
    const now = Date.now();
    const today = new Date(now).toISOString().split("T")[0];
    const last = new Date(user.tower.lastAccess).toISOString().split("T")[0];
    if (today !== last) {
        user.tower.attempts = DAILY_ATTEMPTS;
        user.tower.lastAccess = now;
        clearTemporaryGems(user);
        markUserDirty(user.id);
        return `✅ Tentativas resetadas: ${DAILY_ATTEMPTS}`;
    }
    return null;
}

// ----------------------------------------------
// 🏪 LOJA SIMPLES DE SHARDS
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
            user.towerShop.items.push({ id: s.id, rarity: s.rarity, cost: s.rarity * 30 });
        }
        markUserDirty(user.id);
    }
}

export function buyTowerShopItem(user, index) {
    initTowerShop(user);
    const item = user.towerShop.items[index - 1];
    if (!item) return "❌ Item inválido.";
    if (!user.tower.tokens || user.tower.tokens < item.cost) return `❌ Você precisa de ${item.cost} TT.`;
    user.tower.tokens -= item.cost;
    giveShardToUser(user, item.id, 1);
    markUserDirty(user.id);
    return `✅ Comprou shard ${item.id} (${item.rarity}★)`;
}

// ----------------------------------------------
// 📊 STATUS
// ----------------------------------------------
export function getTowerStatus(user) {
    initTower(user);
    const floor = user.tower.floor;
    const attempts = user.tower.attempts;
    const gems = user.tower.tempGems.length ? `💎 Gemas ativas: ${user.tower.tempGems.join(", ")}` : "";
    return `🗼 Torre - Andar ${floor}/${MAX_FLOOR}\nTentativas: ${attempts}/${DAILY_ATTEMPTS}\nWin Streak: ${user.tower.winStreak}\n${gems}`;
}