// src/systems/towerSystem.js

import { markUserDirty } from "./userCacheSystem.js";
import { addGold, addXP } from "./economySystem.js";
import { giveCardToUser, giveShardToUser, addShardsToUser } from "./cardSystem.js";
import { initBattle, runBattle } from "./battleSystem.js";

/* ---------------------------------------------------------
   CONFIG
--------------------------------------------------------- */
const MAX_FLOOR = 120;
const DAILY_ATTEMPTS = 3;
const REWARD_SCALING_FACTOR = 1.15;
const SHARD_TIERS = {
    3: ["golem3", "ninja3", "minotauro3"],
    4: ["dragao4", "anjo4", "lich4"],
    5: ["fenix5", "celestial5"]
};
const GEMS = ["Fúria", "Proteção", "Velocidade", "Crítico"];

/* ---------------------------------------------------------
   FAILSAFE - sempre garantir estrutura mínima
--------------------------------------------------------- */
function sanitizeTower(user) {
    if (!user.tower || typeof user.tower !== "object") {
        user.tower = {
            floor: 1,
            attempts: DAILY_ATTEMPTS,
            lastAccess: 0,
            winStreak: 0,
            tempGems: [],
            tokens: 0
        };
        markUserDirty(user.id);
        return;
    }

    const t = user.tower;

    t.floor = Number(t.floor) > 0 ? Number(t.floor) : 1;
    t.attempts = Number(t.attempts) >= 0 ? Number(t.attempts) : DAILY_ATTEMPTS;
    t.lastAccess = Number(t.lastAccess) >= 0 ? Number(t.lastAccess) : 0;
    t.winStreak = Number(t.winStreak) >= 0 ? Number(t.winStreak) : 0;

    if (!Array.isArray(t.tempGems)) t.tempGems = [];
    if (typeof t.tokens !== "number" || t.tokens < 0) t.tokens = 0;

    markUserDirty(user.id);
}

function sanitizeTowerShop(user) {
    if (!user.towerShop || typeof user.towerShop !== "object") {
        user.towerShop = { lastReset: 0, items: [] };
        markUserDirty(user.id);
        return;
    }

    if (!Array.isArray(user.towerShop.items)) user.towerShop.items = [];
}

function sanitizeGuardianShards(user) {
    if (!user.guardianShards || typeof user.guardianShards !== "object") {
        user.guardianShards = {};
        markUserDirty(user.id);
    }
}

/* ---------------------------------------------------------
   GEMS TEMPORÁRIAS
--------------------------------------------------------- */
export function addTemporaryGem(user, gem) {
    sanitizeTower(user);
    user.tower.tempGems.push(gem);
    markUserDirty(user.id);
}

export function clearTemporaryGems(user) {
    sanitizeTower(user);
    user.tower.tempGems = [];
    markUserDirty(user.id);
}

/* ---------------------------------------------------------
   ENEMIES
--------------------------------------------------------- */
export function getFloorEnemy(floor) {
    const seed = floor % 10;
    const suffix = seed % 3 === 0 ? "Golem" : seed % 3 === 1 ? "Dragão" : "Assassino";
    const hp = Math.floor((500 + floor * 50) * (1 + seed * 0.05));
    const atk = Math.floor((50 + floor * 10) * (1 + seed * 0.05));
    const isBoss = floor % 5 === 0;

    return {
        id: `E_TOWER_${floor}`,
        name: isBoss ? `👑 Boss do Andar ${floor} (${suffix})` : `Guardião ${floor} (${suffix})`,
        hp,
        maxHp: hp,
        attack: atk,
        deck: generateEnemyDeck(floor, isBoss),
        type: "tower_enemy",
        isPlayer: false
    };
}

function generateEnemyDeck(floor, isBoss) {
    const amount = isBoss ? 8 : 5;
    const deck = [];
    for (let i = 0; i < amount; i++) {
        deck.push({ id: `atk${floor}_${i}`, type: "attack", value: 50 + floor * 5 });
        deck.push({ id: `def${floor}_${i}`, type: "defense", value: 20 + floor * 2 });
    }
    return deck;
}

/* ---------------------------------------------------------
   RANDOM EVENTS
--------------------------------------------------------- */
export function getRandomTowerEvent(floor) {
    const roll = Math.random();

    if (roll < 0.25) return { type: "buff", value: 0.2, description: "Inimigo enfraquecido" };
    if (roll < 0.45) return { type: "debuff", value: 0.2, description: "Inimigo fortalecido" };
    if (roll < 0.65) {
        const gem = GEMS[Math.floor(Math.random() * GEMS.length)];
        return { type: "gem", gem, description: `Gema temporária recebida: ${gem}` };
    }
    if (roll < 0.85) {
        const lore = [
            "Um vento gelado percorre a Torre.",
            "As paredes sussurram segredos antigos.",
            "Inscrições brilhantes surgem nas pedras.",
            "Passos ecoam em um andar distante."
        ];
        return { type: "lore", description: lore[Math.floor(Math.random() * lore.length)] };
    }
    return null;
}

/* ---------------------------------------------------------
   REWARDS
--------------------------------------------------------- */
export function getFloorReward(floor) {
    const gold = Math.floor(500 * Math.pow(REWARD_SCALING_FACTOR, floor - 1));
    const xp = Math.floor(200 * Math.pow(REWARD_SCALING_FACTOR, floor - 1));

    const shards = floor % 5 === 0 ? [rollShard()] : [];
    return { gold, xp, shards };
}

function rollShard() {
    const r = Math.random();
    if (r < 0.7) return { rarity: 3, id: rand(SHARD_TIERS[3]) };
    if (r < 0.95) return { rarity: 4, id: rand(SHARD_TIERS[4]) };
    return { rarity: 5, id: rand(SHARD_TIERS[5]) };
}

function rand(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

/* ---------------------------------------------------------
   INIT TOWER
--------------------------------------------------------- */
export function initTower(user) {
    sanitizeTower(user);
}

/* ---------------------------------------------------------
   EXECUTAR ANDAR
--------------------------------------------------------- */
export function climbFloor(user) {
    sanitizeTower(user);

    if (user.tower.attempts <= 0)
        return { success: false, msg: "❌ Sem tentativas restantes." };

    user.tower.attempts--;

    const enemy = getFloorEnemy(user.tower.floor);
    const event = getRandomTowerEvent(user.tower.floor);

    let eventMsg = "";
    if (event) {
        if (event.type === "gem") addTemporaryGem(user, event.gem);
        eventMsg = event.description;
    }

    const state = initBattle(user, enemy, { auto: true });
    runBattle(state);

    const win = state.enemy.hp <= 0;
    let rewardMsg = "";

    if (win) {
        const oldFloor = user.tower.floor;
        user.tower.floor++;
        user.tower.winStreak++;

        const reward = getFloorReward(oldFloor);

        addGold(user, reward.gold);
        addXP(user, reward.xp);
        reward.shards.forEach(s => giveShardToUser(user, s.id, 1));

        rewardMsg =
            `🎁 +${reward.gold} Ouro, +${reward.xp} XP` +
            (reward.shards.length ? `, Shard: ${reward.shards.map(s => `${s.id} (${s.rarity}★)`).join(", ")}` : "");
    } else {
        user.tower.winStreak = 0;
        rewardMsg = "❌ Você foi derrotado!";
    }

    markUserDirty(user.id);
    return { success: win, log: state.log, event: eventMsg, rewardMsg };
}

/* ---------------------------------------------------------
   RESET DIÁRIO
--------------------------------------------------------- */
export function resetDaily(user) {
    sanitizeTower(user);

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

/* ---------------------------------------------------------
   TOWER SHOP
--------------------------------------------------------- */
export function initTowerShop(user) {
    sanitizeTowerShop(user);

    const now = Date.now();
    const today = new Date(now).toISOString().split("T")[0];
    const lastDay = new Date(user.towerShop.lastReset).toISOString().split("T")[0];

    if (today !== lastDay) {
        user.towerShop.lastReset = now;
        user.towerShop.items = [];

        for (let i = 0; i < 3; i++) {
            const s = rollShard();
            user.towerShop.items.push({
                id: s.id,
                rarity: s.rarity,
                cost: s.rarity * 30
            });
        }

        markUserDirty(user.id);
    }
}

export function buyTowerShopItem(user, index) {
    sanitizeTower(user);
    sanitizeTowerShop(user);

    const item = user.towerShop.items[index - 1];
    if (!item) return "❌ Item inválido.";

    if (user.tower.tokens < item.cost)
        return `❌ Você precisa de ${item.cost} TT.`;

    user.tower.tokens -= item.cost;
    giveShardToUser(user, item.id, 1);

    markUserDirty(user.id);
    return `✅ Comprou ${item.id} (${item.rarity}★)`;
}

/* ---------------------------------------------------------
   STATUS
--------------------------------------------------------- */
export function getTowerStatus(user) {
    sanitizeTower(user);

    const t = user.tower;
    const gems = t.tempGems.length ? `💎 Gemas: ${t.tempGems.join(", ")}` : "";

    return `🗼 Torre - Andar ${t.floor}/${MAX_FLOOR}
Tentativas: ${t.attempts}/${DAILY_ATTEMPTS}
Win Streak: ${t.winStreak}
${gems}`;
}

/* ---------------------------------------------------------
   RANKING
--------------------------------------------------------- */
export function getTowerRankings(users) {
    return users
        .filter(u => u.tower)
        .map(u => ({
            id: u.id,
            name: u.name || `Player ${u.id}`,
            floor: u.tower.floor,
            winStreak: u.tower.winStreak
        }))
        .sort((a, b) =>
            b.floor !== a.floor ? b.floor - a.floor :
            b.winStreak - a.winStreak
        );
}

/* ---------------------------------------------------------
   GUARDIAN SHARDS
--------------------------------------------------------- */
export function giveGuardianShard(user, shardId, amount = 1) {
    sanitizeGuardianShards(user);

    if (!user.guardianShards[shardId])
        user.guardianShards[shardId] = 0;

    user.guardianShards[shardId] += amount;

    markUserDirty(user.id);
}

/* ---------------------------------------------------------
   SPEND ATTEMPTS
--------------------------------------------------------- */
export function spendTowerAttempt(user, amount = 1) {
    sanitizeTower(user);

    if (user.tower.attempts < amount) return false;

    user.tower.attempts -= amount;
    markUserDirty(user.id);

    return true;
}