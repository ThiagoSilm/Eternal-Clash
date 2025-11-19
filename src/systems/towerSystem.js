// src/systems/towerSystem.js

import { markUserDirty } from "./userCacheSystem.js";
import { addGold, addXP } from "./economySystem.js";
// Assumindo que giveCardToUser será substituído por addShardsToUser
import { addShardsToUser } from "./shardSystem.js"; 
// Importa o sistema de RNG
import { rng, choice } from "./rngSystem.js"; 
import { initBattle, runBattle } from "./battleSystem.js"; // Assume estas funções de batalha

// =========================================================
// ⚙️ CONFIGURAÇÃO & CONSTANTES
// =========================================================

const MAX_FLOOR = 120;
const DAILY_ATTEMPTS = 3;
const REWARD_SCALING_FACTOR = 1.15; // Fator de escala geométrica para recompensas
const TOWER_TOKENS_NAME = "Tower Token (TT)"; // Nome da moeda da torre

/** Mapeamento de raridade para IDs de cartas que podem ser dropadas como Shards. */
const SHARD_TIERS = Object.freeze({
    3: ["golem3", "ninja3", "minotauro3"],
    4: ["dragao4", "anjo4", "lich4"],
    5: ["fenix5", "celestial5"]
});
const GEMS = Object.freeze(["Fúria", "Proteção", "Velocidade", "Crítico"]); // Gemas temporárias

// =========================================================
// 🛡️ FAILSAFE E ESTRUTURA DE ESTADO
// =========================================================

/**
 * @typedef {object} TowerState
 * @property {number} floor - Andar atual que o usuário tentará (começa em 1).
 * @property {number} attempts - Tentativas restantes do dia.
 * @property {number} lastAccess - Timestamp do último acesso/reset diário.
 * @property {number} winStreak - Sequência de vitórias.
 * @property {string[]} tempGems - IDs das gemas temporárias ativas.
 * @property {number} tokens - Moeda da Torre (Tower Tokens).
 */

/**
 * @typedef {object} TowerShopState
 * @property {number} lastReset - Timestamp do último reset da loja.
 * @property {object[]} items - Itens disponíveis para compra.
 */

/**
 * @typedef {object} UserState
 * @property {string} id
 * @property {string} [name] - Nome do usuário.
 * @property {TowerState} [tower]
 * @property {TowerShopState} [towerShop]
 * @property {Object.<string, number>} [guardianShards] - Shards de guardião.
 */


/**
 * Garante que todas as estruturas relacionadas à Torre existam e tenham valores válidos.
 * @param {UserState} user - Objeto do usuário (mutável).
 */
function initTowerStructures(user) {
    let dirty = false;
    
    // 1. TowerState
    if (!user.tower || typeof user.tower !== "object") {
        user.tower = { floor: 1, attempts: DAILY_ATTEMPTS, lastAccess: 0, winStreak: 0, tempGems: [], tokens: 0 };
        dirty = true;
    } else {
        const t = user.tower;
        if (Number(t.floor) <= 0) t.floor = 1;
        if (Number(t.attempts) < 0) t.attempts = DAILY_ATTEMPTS;
        if (Number(t.lastAccess) < 0) t.lastAccess = 0;
        if (Number(t.winStreak) < 0) t.winStreak = 0;
        if (!Array.isArray(t.tempGems)) t.tempGems = [];
        if (typeof t.tokens !== "number" || t.tokens < 0) t.tokens = 0;
        dirty = true;
    }
    
    // 2. TowerShopState
    if (!user.towerShop || typeof user.towerShop !== "object") {
        user.towerShop = { lastReset: 0, items: [] };
        dirty = true;
    } else if (!Array.isArray(user.towerShop.items)) {
        user.towerShop.items = [];
        dirty = true;
    }

    // 3. GuardianShards
    if (!user.guardianShards || typeof user.guardianShards !== "object") {
        user.guardianShards = {};
        dirty = true;
    }

    if (dirty) markUserDirty(user.id);
}

/**
 * Ponto de entrada para garantir a inicialização da Torre.
 * @param {UserState} user
 */
export function initTower(user) {
    initTowerStructures(user);
    // Chama o reset diário para garantir que as tentativas e a loja estejam atualizadas
    resetDaily(user); 
    initTowerShop(user);
}

// =========================================================
// 💎 GEMS TEMPORÁRIAS (Buffs de Torre)
// =========================================================

/**
 * Adiciona uma gema temporária ativa para o run da Torre.
 * @param {UserState} user - Objeto do usuário (mutável).
 * @param {string} gem - Nome da gema.
 */
export function addTemporaryGem(user, gem) {
    initTowerStructures(user);
    user.tower.tempGems.push(gem);
    markUserDirty(user.id);
}

/**
 * Remove todas as gemas temporárias.
 * @param {UserState} user - Objeto do usuário (mutável).
 */
export function clearTemporaryGems(user) {
    initTowerStructures(user);
    if (user.tower.tempGems.length > 0) {
        user.tower.tempGems = [];
        markUserDirty(user.id);
    }
}

// =========================================================
// 👹 INIMIGOS E Batalha
// =========================================================

/**
 * Gera a definição do inimigo para um dado andar da Torre.
 * @param {number} floor - O andar atual.
 * @returns {object} Definição do inimigo.
 */
export function getFloorEnemy(floor) {
    const seed = floor % 10;
    
    const names = ["Golem", "Dragão", "Assassino", "Lich", "Minotauro"];
    const suffix = choice(names) || "Guardião";

    // Fórmulas de escala
    const hp = Math.floor((500 + floor * 50) * (1 + seed * 0.05));
    const atk = Math.floor((50 + floor * 10) * (1 + seed * 0.05));
    const isBoss = floor % 5 === 0;

    return {
        id: `E_TOWER_${floor}_${suffix.slice(0, 3)}`,
        name: isBoss ? `👑 Boss do Andar ${floor} (${suffix})` : `Guardião ${floor} (${suffix})`,
        hp,
        maxHp: hp,
        attack: atk,
        deck: generateEnemyDeck(floor, isBoss),
        type: "tower_enemy",
        isPlayer: false
    };
}

/**
 * Gera um deck básico para o inimigo da Torre.
 * @param {number} floor
 * @param {boolean} isBoss
 * @returns {object[]} O deck.
 */
function generateEnemyDeck(floor, isBoss) {
    const amount = isBoss ? 8 : 5;
    const deck = [];
    for (let i = 0; i < amount; i++) {
        // Dano e Defesa aumentam com o andar
        deck.push({ id: `atk${floor}_${i}`, type: "attack", value: 50 + floor * 5 });
        deck.push({ id: `def${floor}_${i}`, type: "defense", value: 20 + floor * 2 });
    }
    return deck;
}

// =========================================================
// ❓ EVENTOS ALEATÓRIOS
// =========================================================

/**
 * Retorna um evento aleatório que ocorre antes da batalha.
 * @param {number} floor
 * @returns {{type: string, value?: number, gem?: string, description: string} | null} O evento.
 */
export function getRandomTowerEvent(floor) {
    // Usando rng para escolher o evento
    const roll = rng(1, 100); 

    if (roll <= 25) return { type: "buff", value: 0.2, description: "Inimigo enfraquecido (20% menos HP)." };
    if (roll <= 45) return { type: "debuff", value: 0.2, description: "Inimigo fortalecido (20% mais ataque)." };
    
    // Chance de Gema Temporária
    if (roll <= 65) {
        const gem = choice(GEMS);
        return { type: "gem", gem, description: `Gema temporária recebida: **${gem}**` };
    }
    
    // Lore ou evento neutro
    if (roll <= 85) {
        const lore = [
            "Um vento gelado percorre a Torre, recarregando suas forças.",
            "As paredes sussurram segredos antigos, ganhando um pouco de EXP extra.",
            "Inscrições brilhantes surgem nas pedras, te dando uma moeda da Torre.",
            "Passos ecoam em um andar distante."
        ];
        return { type: "lore", description: choice(lore) || "Evento neutro." };
    }
    return null; // Nada acontece
}

// =========================================================
// 🎁 RECOMPENSAS
// =========================================================

/**
 * Calcula a recompensa estática de um andar.
 * @param {number} floor - Andar completado.
 * @returns {{gold: number, xp: number, shards: object[]}} Recompensa.
 */
export function getFloorReward(floor) {
    // Crescimento exponencial do Gold e XP
    const gold = Math.floor(500 * Math.pow(REWARD_SCALING_FACTOR, floor - 1));
    const xp = Math.floor(200 * Math.pow(REWARD_SCALING_FACTOR, floor - 1));

    // Shards a cada 5 andares, mais chances de drop raro
    const shards = floor % 5 === 0 ? [rollShard()] : [];
    return { gold, xp, shards };
}

/**
 * Rola um Shard de carta aleatório com base na raridade.
 * @returns {{rarity: number, id: string, amount: number}} Detalhes do shard.
 */
function rollShard() {
    // Usando rng para controle explícito
    const r = rng(1, 100); 
    let rarity, amount;

    if (r <= 70) { // 70% R3
        rarity = 3;
        amount = rng(1, 3);
    } else if (r <= 95) { // 25% R4
        rarity = 4;
        amount = rng(1, 2);
    } else { // 5% R5
        rarity = 5;
        amount = 1;
    }
    
    const idList = SHARD_TIERS[rarity];
    const cardId = choice(idList);
    
    return { rarity, id: cardId, amount };
}


// =========================================================
// 🏃 EXECUTAR ANDAR (CORE)
// =========================================================

/**
 * Tenta subir um andar na Torre.
 * @param {UserState} user - Objeto do usuário (mutável).
 * @returns {{success: boolean, msg?: string, log?: string[], event?: string, rewardMsg?: string}} Resultado.
 */
export function climbFloor(user) {
    initTowerStructures(user); // Garante a estrutura

    if (user.tower.attempts <= 0)
        return { success: false, msg: "❌ Sem tentativas restantes. Volte amanhã ou compre mais tentativas." };

    // 1. Gasta 1 tentativa
    user.tower.attempts--;

    const currentFloor = user.tower.floor;
    const enemy = getFloorEnemy(currentFloor);
    const event = getRandomTowerEvent(currentFloor);

    let eventMsg = "";
    if (event) {
        eventMsg = event.description;
        // Aplica o efeito do evento
        if (event.type === "gem") addTemporaryGem(user, event.gem);
        // Exemplo de aplicação de buff/debuff (o battleSystem precisaria ler isso)
        if (event.type === "buff" && event.value) enemy.hp = Math.floor(enemy.hp * (1 - event.value));
        if (event.type === "debuff" && event.value) enemy.attack = Math.floor(enemy.attack * (1 + event.value));
    }

    // 2. Inicia e executa a batalha
    // As tempGems (buffs) devem ser passadas para o battleSystem aqui via options
    const state = initBattle(user, enemy, { auto: true, towerGems: user.tower.tempGems });
    const battleResult = runBattle(state); // runBattle deve retornar o resultado final

    const win = battleResult?.winner === "player"; 
    let rewardMsg = "";

    if (win) {
        // 3. VITORIA
        user.tower.floor++;
        user.tower.winStreak++;

        const reward = getFloorReward(currentFloor);
        const tokensGained = 1; // Exemplo: 1 Token por vitória
        
        // Concede recompensas
        addGold(user, reward.gold);
        addXP(user, reward.xp);
        user.tower.tokens += tokensGained;
        
        // Concede Shards
        reward.shards.forEach(s => addShardsToUser(user, s.id, s.amount));

        rewardMsg =
            `🎁 +${reward.gold} Ouro, +${reward.xp} XP, +${tokensGained} TT.` +
            (reward.shards.length ? `\n💎 Shards: ${reward.shards.map(s => `${s.id} x${s.amount}`).join(", ")}` : "");
            
    } else {
        // 4. DERROTA
        user.tower.winStreak = 0;
        rewardMsg = "❌ Você foi derrotado! Sua sequência de vitórias foi reiniciada.";
        // Perde as gemas temporárias em caso de derrota
        clearTemporaryGems(user); 
    }

    markUserDirty(user.id);
    return { 
        success: win, 
        msg: win ? `Andar **${currentFloor}** Concluído!` : `Falha no Andar **${currentFloor}**!`, 
        event: eventMsg, 
        rewardMsg 
    };
}


// =========================================================
// 📅 RESET DIÁRIO
// =========================================================

/**
 * Verifica e executa o reset diário de tentativas e gemas.
 * @param {UserState} user - Objeto do usuário (mutável).
 * @returns {string | null} Mensagem de reset, ou null se não for necessário.
 */
export function resetDaily(user) {
    initTowerStructures(user);

    const now = Date.now();
    // Cria strings de data simples para comparação (formato YYYY-MM-DD)
    const today = new Date(now).toISOString().split("T")[0];
    const last = new Date(user.tower.lastAccess).toISOString().split("T")[0];

    if (today !== last) {
        user.tower.attempts = DAILY_ATTEMPTS;
        user.tower.lastAccess = now;
        clearTemporaryGems(user); // Limpa as gemas ao resetar
        markUserDirty(user.id);
        
        // Também garante o reset da loja aqui
        initTowerShop(user); 
        
        return `✅ Tentativas da Torre resetadas para: ${DAILY_ATTEMPTS}`;
    }
    return null;
}

// =========================================================
// 🏬 TOWER SHOP
// =========================================================

/**
 * Inicializa/Reseta a loja da Torre diariamente.
 * @param {UserState} user - Objeto do usuário (mutável).
 */
export function initTowerShop(user) {
    initTowerStructures(user);

    const now = Date.now();
    const today = new Date(now).toISOString().split("T")[0];
    const lastDay = new Date(user.towerShop.lastReset).toISOString().split("T")[0];

    if (today !== lastDay) {
        user.towerShop.lastReset = now;
        user.towerShop.items = [];

        // Gera 3 ofertas aleatórias de Shards
        for (let i = 0; i < 3; i++) {
            const s = rollShard();
            user.towerShop.items.push({
                id: s.id,
                rarity: s.rarity,
                amount: s.amount,
                cost: s.rarity * 30 * s.amount // Custo de TT escala com raridade e quantidade
            });
        }

        markUserDirty(user.id);
    }
}

/**
 * Compra um item da loja da Torre usando Tower Tokens (TT).
 * @param {UserState} user - Objeto do usuário (mutável).
 * @param {number} index - Índice do item na lista (1-baseado).
 * @returns {string} Mensagem de resultado da compra.
 */
export function buyTowerShopItem(user, index) {
    initTowerStructures(user);

    const item = user.towerShop.items[index - 1];
    if (!item) return "❌ Item inválido. Use o número de 1 a 3.";

    if (user.tower.tokens < item.cost) {
        return `❌ Você precisa de **${item.cost} TT**. (Possui: ${user.tower.tokens}).`;
    }

    user.tower.tokens -= item.cost;
    addShardsToUser(user, item.id, item.amount); // Adiciona os shards

    markUserDirty(user.id);
    return `✅ Comprou **${item.amount}x Shard de ${item.id}** (${item.rarity}★) por **${item.cost} TT**.`;
}

// =========================================================
// ℹ️ STATUS E RANKING
// =========================================================

/**
 * Retorna o status atual da Torre para o usuário.
 * @param {UserState} user
 * @returns {string} Status formatado.
 */
export function getTowerStatus(user) {
    initTowerStructures(user);
    const t = user.tower;
    
    // Garante que o reset diário tenha ocorrido
    resetDaily(user); 

    const gems = t.tempGems.length ? `💎 Gemas: **${t.tempGems.join(", ")}**` : "💎 Gemas: Nenhuma";

    return `
🗼 **Torre da Ascensão** - Andar **${t.floor}/${MAX_FLOOR}**
----------------------------------
Tentativas: **${t.attempts}/${DAILY_ATTEMPTS}**
Win Streak: **${t.winStreak}**
Tokens: **${t.tokens} TT**
${gems}
`.trim();
}

/**
 * Gera um ranking de usuários baseado no progresso da Torre.
 * @param {UserState[]} users - Lista de todos os usuários.
 * @returns {object[]} Ranking ordenado.
 */
export function getTowerRankings(users) {
    return users
        .filter(u => u.tower && u.tower.floor > 1)
        .map(u => ({
            id: u.id,
            name: u.name || `Player ${u.id}`,
            floor: u.tower.floor,
            winStreak: u.tower.winStreak
        }))
        .sort((a, b) =>
            // Ordem primária: Andar (descendente)
            b.floor !== a.floor ? b.floor - a.floor :
            // Ordem secundária: Win Streak (descendente)
            b.winStreak - a.winStreak
        );
}

// =========================================================
// ⚔️ GUARDIAN SHARDS E GASTO DE TENTATIVAS (Utilidades)
// =========================================================

/**
 * Adiciona um Shard de Guardião (moeda especial para evolução de guardiões).
 * @param {UserState} user - Objeto do usuário (mutável).
 * @param {string} shardId - ID do Shard de Guardião.
 * @param {number} [amount=1] - Quantidade.
 */
export function giveGuardianShard(user, shardId, amount = 1) {
    initTowerStructures(user);

    if (!user.guardianShards[shardId])
        user.guardianShards[shardId] = 0;

    user.guardianShards[shardId] += amount;
    markUserDirty(user.id);
}

/**
 * Gasta tentativas de Torre (usado por itens da loja ou ações externas).
 * @param {UserState} user - Objeto do usuário (mutável).
 * @param {number} [amount=1] - Quantidade a gastar.
 * @returns {boolean} True se o gasto foi bem-sucedido.
 */
export function spendTowerAttempt(user, amount = 1) {
    initTowerStructures(user);

    if (user.tower.attempts < amount) return false;

    user.tower.attempts -= amount;
    markUserDirty(user.id);

    return true;
}
