// src/systems/towerSystem.js

import { saveUser, loadUser } from "./userSystem.js";
import { addResource } from "./userSystem.js";
import { addShardsToUser } from "./shardSystem.js";
import { rng, choice, weightedChoice } from "./rngSystem.js";
import { initBattle, runBattle } from "./battleSystem.js";

// =========================================================
// ⚙️ CONFIGURAÇÃO E CONSTANTES
// =========================================================

const CONFIG = {
  maxFloor: 120,
  dailyAttempts: 3,
  rewardScaling: 1.15,
  
  // Tentativas e energia
  attemptEnergyCost: 20,
  bonusAttemptCost: 50, // Gems para comprar tentativa extra
  
  // Tokens
  tokenPerWin: 1,
  tokenBossBonus: 2,
  tokenStreakBonus: 0.5, // +0.5 por vitória consecutiva
  
  // Boss floors
  bossInterval: 5,
  bossRewardMultiplier: 2,
  
  // Buffs e eventos
  eventChance: 60, // 60% de ter evento
  gemDuration: 1, // Gemas duram 1 andar
};

// Gems temporárias disponíveis
const TOWER_GEMS = Object.freeze({
  FURY: { name: "Fúria", effect: "attack", value: 0.2 },
  SHIELD: { name: "Proteção", effect: "defense", value: 0.3 },
  SPEED: { name: "Velocidade", effect: "speed", value: 0.15 },
  CRITICAL: { name: "Crítico", effect: "critical", value: 0.1 },
  REGEN: { name: "Regeneração", effect: "heal", value: 20 },
});

// Tabela de drops de shards
const SHARD_DROP_TABLE = Object.freeze({
  3: { // Raro
    cards: ["golem3", "ninja3", "minotaur3", "archer3"],
    weight: 70,
    amount: [1, 3],
  },
  4: { // Épico
    cards: ["dragon4", "angel4", "lich4", "phoenix4"],
    weight: 25,
    amount: [1, 2],
  },
  5: { // Lendário
    cards: ["celestial5", "titan5", "demon5"],
    weight: 5,
    amount: [1, 1],
  },
});

// Templates de inimigos
const ENEMY_TEMPLATES = Object.freeze([
  { name: "Golem", type: "tank", hpMult: 1.3, atkMult: 0.8 },
  { name: "Dragão", type: "dps", hpMult: 1.0, atkMult: 1.3 },
  { name: "Assassino", type: "burst", hpMult: 0.7, atkMult: 1.5 },
  { name: "Lich", type: "magic", hpMult: 1.1, atkMult: 1.2 },
  { name: "Minotauro", type: "balanced", hpMult: 1.2, atkMult: 1.1 },
  { name: "Fênix", type: "sustain", hpMult: 1.4, atkMult: 0.9 },
]);

// =========================================================
// 🏗️ INICIALIZAÇÃO E ESTRUTURAS
// =========================================================

class TowerStructure {
  /**
   * Garante que as estruturas da torre existam no usuário
   */
  static ensure(user) {
    let modified = false;

    // Torre principal
    if (!user.tower || typeof user.tower !== "object") {
      user.tower = this._createDefaultTower();
      modified = true;
    } else {
      modified = this._sanitizeTower(user.tower) || modified;
    }

    // Loja da torre
    if (!user.towerShop || typeof user.towerShop !== "object") {
      user.towerShop = { lastReset: 0, items: [] };
      modified = true;
    }

    // Guardian shards
    if (!user.guardianShards || typeof user.guardianShards !== "object") {
      user.guardianShards = {};
      modified = true;
    }

    return modified;
  }

  static _createDefaultTower() {
    return {
      floor: 1,
      highestFloor: 1,
      attempts: CONFIG.dailyAttempts,
      lastAccess: Date.now(),
      winStreak: 0,
      totalWins: 0,
      totalLosses: 0,
      tokens: 0,
      tempGems: [],
      gemDuration: 0,
      stats: {
        floorsCleared: 0,
        bossesDefeated: 0,
        totalDamageDealt: 0,
        totalDamageTaken: 0,
      },
    };
  }

  static _sanitizeTower(tower) {
    let modified = false;

    const defaults = this._createDefaultTower();
    
    for (const [key, defaultValue] of Object.entries(defaults)) {
      if (tower[key] === undefined) {
        tower[key] = defaultValue;
        modified = true;
      }
    }

    // Validações específicas
    if (tower.floor < 1) {
      tower.floor = 1;
      modified = true;
    }

    if (tower.attempts < 0) {
      tower.attempts = 0;
      modified = true;
    }

    if (tower.highestFloor < tower.floor) {
      tower.highestFloor = tower.floor;
      modified = true;
    }

    return modified;
  }
}

// =========================================================
// 🎲 SISTEMA DE EVENTOS ALEATÓRIOS
// =========================================================

class TowerEventSystem {
  /**
   * Gera evento aleatório para o andar
   */
  static generateEvent(floor) {
    if (rng(1, 100) > CONFIG.eventChance) {
      return null;
    }

    const eventTypes = [
      { type: "buff", weight: 25 },
      { type: "debuff", weight: 20 },
      { type: "gem", weight: 30 },
      { type: "heal", weight: 15 },
      { type: "lore", weight: 10 },
    ];

    const eventType = weightedChoice(eventTypes);

    switch (eventType) {
      case "buff":
        return this._buffEvent();
      case "debuff":
        return this._debuffEvent();
      case "gem":
        return this._gemEvent();
      case "heal":
        return this._healEvent();
      case "lore":
        return this._loreEvent(floor);
      default:
        return null;
    }
  }

  static _buffEvent() {
    const buffs = [
      { desc: "Inimigo enfraquecido", effect: "enemyHp", value: -0.2 },
      { desc: "Inimigo cansado", effect: "enemyAtk", value: -0.15 },
      { desc: "Vento favorável", effect: "playerSpeed", value: 0.2 },
    ];

    const buff = choice(buffs);
    return {
      type: "buff",
      description: `✨ ${buff.desc} (${Math.abs(buff.value * 100)}%)`,
      effect: buff.effect,
      value: buff.value,
    };
  }

  static _debuffEvent() {
    const debuffs = [
      { desc: "Inimigo enfurecido", effect: "enemyAtk", value: 0.25 },
      { desc: "Terreno difícil", effect: "playerSpeed", value: -0.15 },
      { desc: "Neblina densa", effect: "playerAccuracy", value: -0.1 },
    ];

    const debuff = choice(debuffs);
    return {
      type: "debuff",
      description: `⚠️ ${debuff.desc} (${Math.abs(debuff.value * 100)}%)`,
      effect: debuff.effect,
      value: debuff.value,
    };
  }

  static _gemEvent() {
    const gemKeys = Object.keys(TOWER_GEMS);
    const gemKey = choice(gemKeys);
    const gem = TOWER_GEMS[gemKey];

    return {
      type: "gem",
      description: `💎 Gema encontrada: **${gem.name}**\n` +
                   `Efeito: ${this._getGemDescription(gem)}`,
      gem: gemKey,
      gemData: gem,
    };
  }

  static _healEvent() {
    const healAmount = rng(15, 30);
    return {
      type: "heal",
      description: `💚 Fonte de cura encontrada (+${healAmount}% HP)`,
      value: healAmount / 100,
    };
  }

  static _loreEvent(floor) {
    const lores = [
      "Runas antigas brilham nas paredes, emanando poder arcano.",
      "Ecos de batalhas passadas ressoam pelos corredores.",
      "Uma brisa gelada traz sussurros de advertência.",
      "Cristais luminosos iluminam o caminho à frente.",
      `Inscrições revelam: 'Aqui caíram os guerreiros do andar ${floor - 1}'`,
    ];

    return {
      type: "lore",
      description: `📜 ${choice(lores)}`,
    };
  }

  static _getGemDescription(gem) {
    const effects = {
      attack: `+${gem.value * 100}% de dano`,
      defense: `+${gem.value * 100}% de defesa`,
      speed: `+${gem.value * 100}% de velocidade`,
      critical: `+${gem.value * 100}% de chance crítica`,
      heal: `Regenera ${gem.value} HP por turno`,
    };

    return effects[gem.effect] || "Efeito desconhecido";
  }
}

// =========================================================
// 👹 SISTEMA DE INIMIGOS
// =========================================================

class TowerEnemySystem {
  /**
   * Gera inimigo para o andar
   */
  static generateEnemy(floor) {
    const isBoss = floor % CONFIG.bossInterval === 0;
    const template = choice(ENEMY_TEMPLATES);

    const baseHp = 500 + floor * 50;
    const baseAtk = 50 + floor * 10;

    // Escala com variação de seed
    const seed = floor % 10;
    const seedMult = 1 + seed * 0.05;

    const hp = Math.floor(baseHp * template.hpMult * seedMult * (isBoss ? 2 : 1));
    const atk = Math.floor(baseAtk * template.atkMult * seedMult * (isBoss ? 1.5 : 1));

    return {
      id: `tower_${floor}_${template.name}`,
      name: isBoss 
        ? `👑 Boss do Andar ${floor}: ${template.name} Supremo`
        : `🗡️ Guardião ${floor}: ${template.name}`,
      hp: hp,
      maxHp: hp,
      attack: atk,
      type: template.type,
      deck: this._generateDeck(floor, isBoss, template.type),
      floor: floor,
      isBoss: isBoss,
      isPlayer: false,
    };
  }

  static _generateDeck(floor, isBoss, type) {
    const deckSize = isBoss ? 10 : 6;
    const deck = [];

    for (let i = 0; i < deckSize; i++) {
      // Tipo de carta baseado no tipo do inimigo
      const cardType = this._getCardTypeForEnemy(type);
      const value = this._getCardValue(floor, cardType);

      deck.push({
        id: `tower_card_${floor}_${i}`,
        type: cardType,
        value: value,
      });
    }

    return deck;
  }

  static _getCardTypeForEnemy(type) {
    const distributions = {
      tank: ["defense", "defense", "defense", "attack"],
      dps: ["attack", "attack", "attack", "defense"],
      burst: ["attack", "attack", "special", "defense"],
      magic: ["special", "special", "attack", "defense"],
      balanced: ["attack", "attack", "defense", "defense"],
      sustain: ["defense", "defense", "heal", "attack"],
    };

    const pool = distributions[type] || distributions.balanced;
    return choice(pool);
  }

  static _getCardValue(floor, type) {
    const baseValues = {
      attack: 50 + floor * 5,
      defense: 30 + floor * 3,
      special: 40 + floor * 4,
      heal: 25 + floor * 2,
    };

    return baseValues[type] || 50;
  }
}

// =========================================================
// 🎁 SISTEMA DE RECOMPENSAS
// =========================================================

class TowerRewardSystem {
  /**
   * Calcula recompensas do andar
   */
  static calculateRewards(floor, isBoss, winStreak) {
    const base = {
      gold: Math.floor(500 * Math.pow(CONFIG.rewardScaling, floor - 1)),
      xp: Math.floor(200 * Math.pow(CONFIG.rewardScaling, floor - 1)),
      tokens: CONFIG.tokenPerWin + (winStreak * CONFIG.tokenStreakBonus),
    };

    // Bônus de boss
    if (isBoss) {
      base.gold *= CONFIG.bossRewardMultiplier;
      base.xp *= CONFIG.bossRewardMultiplier;
      base.tokens += CONFIG.tokenBossBonus;
    }

    // Arredonda tokens
    base.tokens = Math.floor(base.tokens);

    // Shards em andares especiais
    const shards = this._rollShards(floor, isBoss);

    return { ...base, shards };
  }

  static _rollShards(floor, isBoss) {
    // Shard garantido a cada 5 andares
    if (floor % 5 !== 0 && !isBoss) {
      return [];
    }

    const numShards = isBoss ? 2 : 1;
    const shards = [];

    for (let i = 0; i < numShards; i++) {
      const shard = this._rollSingleShard();
      if (shard) shards.push(shard);
    }

    return shards;
  }

  static _rollSingleShard() {
    // Weighted random por raridade
    const rarityRoll = rng(1, 100);
    let rarity;

    if (rarityRoll <= SHARD_DROP_TABLE[3].weight) {
      rarity = 3;
    } else if (rarityRoll <= SHARD_DROP_TABLE[3].weight + SHARD_DROP_TABLE[4].weight) {
      rarity = 4;
    } else {
      rarity = 5;
    }

    const table = SHARD_DROP_TABLE[rarity];
    const cardId = choice(table.cards);
    const amount = rng(table.amount[0], table.amount[1]);

    return { rarity, id: cardId, amount };
  }

  static formatRewards(rewards) {
    let msg = `🎁 **Recompensas:**\n`;
    msg += `💰 ${rewards.gold} Ouro\n`;
    msg += `⭐ ${rewards.xp} XP\n`;
    msg += `🎫 ${rewards.tokens} Tower Tokens\n`;

    if (rewards.shards.length > 0) {
      msg += `\n💎 **Shards:**\n`;
      rewards.shards.forEach(s => {
        msg += `  • ${s.id} (${s.rarity}★) x${s.amount}\n`;
      });
    }

    return msg.trim();
  }
}

// =========================================================
// ⚔️ SISTEMA DE COMBATE NA TORRE
// =========================================================

class TowerBattleSystem {
  /**
   * Executa batalha na torre
   */
  static async executeBattle(user, enemy, event) {
    // Aplica efeitos do evento
    const modifiedEnemy = this._applyEventEffects(enemy, event);
    
    // Prepara opções de batalha
    const battleOptions = {
      auto: true,
      towerGems: user.tower.tempGems,
      towerFloor: enemy.floor,
    };

    // Inicializa e executa batalha
    const battleState = initBattle(user, modifiedEnemy, battleOptions);
    const result = runBattle(battleState);

    return {
      victory: result.winner === "player",
      log: result.log || [],
      stats: {
        damageDealt: result.damageDealt || 0,
        damageTaken: result.damageTaken || 0,
        turnsPlayed: result.turns || 0,
      },
    };
  }

  static _applyEventEffects(enemy, event) {
    if (!event) return enemy;

    const modified = { ...enemy };

    switch (event.effect) {
      case "enemyHp":
        modified.hp = Math.floor(enemy.hp * (1 + event.value));
        modified.maxHp = modified.hp;
        break;
      case "enemyAtk":
        modified.attack = Math.floor(enemy.attack * (1 + event.value));
        break;
    }

    return modified;
  }
}

// =========================================================
// 🗼 SISTEMA PRINCIPAL DE TORRE
// =========================================================

class TowerSystem {
  /**
   * Tenta subir um andar
   */
  static async climbFloor(userId) {
    const user = await loadUser(userId);
    TowerStructure.ensure(user);

    // Verifica reset diário
    this._checkDailyReset(user);

    // Valida tentativas
    if (user.tower.attempts <= 0) {
      return {
        success: false,
        message: "❌ Sem tentativas restantes!\n" +
                 `💎 Compre mais por ${CONFIG.bonusAttemptCost} gems ou volte amanhã.`,
      };
    }

    // Gasta tentativa
    user.tower.attempts--;
    const currentFloor = user.tower.floor;
    const isBoss = currentFloor % CONFIG.bossInterval === 0;

    // Gera inimigo e evento
    const enemy = TowerEnemySystem.generateEnemy(currentFloor);
    const event = TowerEventSystem.generateEvent(currentFloor);

    // Adiciona gema se evento
    if (event?.type === "gem") {
      user.tower.tempGems.push(event.gem);
      user.tower.gemDuration = CONFIG.gemDuration;
    }

    // Executa batalha
    const battle = await TowerBattleSystem.executeBattle(user, enemy, event);

    // Processa resultado
    const result = battle.victory
      ? await this._processVictory(user, currentFloor, isBoss, battle.stats)
      : await this._processDefeat(user, battle.stats);

    // Atualiza gems temporárias
    this._updateGemDuration(user);

    // Salva
    await saveUser(user);

    return {
      success: battle.victory,
      floor: currentFloor,
      isBoss: isBoss,
      event: event?.description,
      message: result.message,
      rewards: result.rewards,
      battleLog: battle.log,
    };
  }

  static async _processVictory(user, floor, isBoss, stats) {
    // Atualiza progresso
    user.tower.floor++;
    user.tower.winStreak++;
    user.tower.totalWins++;
    user.tower.stats.floorsCleared++;
    
    if (isBoss) {
      user.tower.stats.bossesDefeated++;
    }

    if (user.tower.floor > user.tower.highestFloor) {
      user.tower.highestFloor = user.tower.floor;
    }

    // Atualiza estatísticas
    user.tower.stats.totalDamageDealt += stats.damageDealt;
    user.tower.stats.totalDamageTaken += stats.damageTaken;

    // Calcula recompensas
    const rewards = TowerRewardSystem.calculateRewards(
      floor,
      isBoss,
      user.tower.winStreak
    );

    // Concede recompensas
    await addResource(user.id, "gold", rewards.gold);
    await addResource(user.id, "xp", rewards.xp);
    user.tower.tokens += rewards.tokens;

    // Concede shards
    for (const shard of rewards.shards) {
      addShardsToUser(user, shard.id, shard.amount);
    }

    const message = isBoss
      ? `🏆 **BOSS DERROTADO!** Andar ${floor} conquistado!\n` +
        `🔥 Sequência: ${user.tower.winStreak} vitórias consecutivas!`
      : `✅ Andar ${floor} conquistado!\n` +
        `🔥 Sequência: ${user.tower.winStreak} vitórias`;

    return {
      message,
      rewards: TowerRewardSystem.formatRewards(rewards),
    };
  }

  static async _processDefeat(user, stats) {
    user.tower.winStreak = 0;
    user.tower.totalLosses++;
    user.tower.stats.totalDamageTaken += stats.damageTaken;
    user.tower.tempGems = [];

    return {
      message: `❌ Derrota no andar ${user.tower.floor}!\n` +
               `💔 Sua sequência de vitórias foi reiniciada.`,
      rewards: null,
    };
  }

  static _updateGemDuration(user) {
    if (user.tower.gemDuration > 0) {
      user.tower.gemDuration--;
      
      if (user.tower.gemDuration === 0) {
        user.tower.tempGems = [];
      }
    }
  }

  static _checkDailyReset(user) {
    const now = Date.now();
    const today = new Date(now).toISOString().split("T")[0];
    const last = new Date(user.tower.lastAccess).toISOString().split("T")[0];

    if (today !== last) {
      user.tower.attempts = CONFIG.dailyAttempts;
      user.tower.lastAccess = now;
      user.tower.tempGems = [];
      user.tower.gemDuration = 0;
    }
  }

  /**
   * Compra tentativa extra
   */
  static async buyAttempt(userId) {
    const user = await loadUser(userId);
    TowerStructure.ensure(user);

    if (user.gems < CONFIG.bonusAttemptCost) {
      return {
        success: false,
        message: `❌ Você precisa de ${CONFIG.bonusAttemptCost} gems (Possui: ${user.gems})`,
      };
    }

    await addResource(userId, "gems", -CONFIG.bonusAttemptCost);
    user.tower.attempts++;
    await saveUser(user);

    return {
      success: true,
      message: `✅ Tentativa comprada! (${user.tower.attempts} disponíveis)`,
    };
  }

  /**
   * Retorna status da torre
   */
  static async getStatus(userId) {
    const user = await loadUser(userId);
    TowerStructure.ensure(user);
    this._checkDailyReset(user);

    const t = user.tower;
    const progress = ((t.floor / CONFIG.maxFloor) * 100).toFixed(1);

    let gemsText = "💎 Gemas Ativas: Nenhuma";
    if (t.tempGems.length > 0) {
      const gemNames = t.tempGems.map(g => TOWER_GEMS[g]?.name || g);
      gemsText = `💎 Gemas: ${gemNames.join(", ")} (${t.gemDuration} andar(es))`;
    }

    return `
🗼 **Torre da Ascensão**
━━━━━━━━━━━━━━━━━━━━━━
📍 Andar Atual: **${t.floor}/${CONFIG.maxFloor}** (${progress}%)
🏆 Maior Andar: **${t.highestFloor}**
🎯 Tentativas: **${t.attempts}/${CONFIG.dailyAttempts}**
🔥 Sequência: **${t.winStreak}** vitórias
🎫 Tokens: **${t.tokens} TT**
${gemsText}

📊 **Estatísticas:**
✅ Vitórias: ${t.totalWins}
❌ Derrotas: ${t.totalLosses}
👑 Bosses: ${t.stats.bossesDefeated}
⚔️ Dano Total: ${t.stats.totalDamageDealt.toLocaleString()}
`.trim();
  }
}

// =========================================================
// 📤 API PÚBLICA
// =========================================================

export const climbFloor = (userId) => TowerSystem.climbFloor(userId);
export const buyAttempt = (userId) => TowerSystem.buyAttempt(userId);
export const getTowerStatus = (userId) => TowerSystem.getStatus(userId);

export const initTower = (user) => TowerStructure.ensure(user);
export const getFloorEnemy = (floor) => TowerEnemySystem.generateEnemy(floor);

export default {
  climbFloor,
  buyAttempt,
  getTowerStatus,
  initTower,
  getFloorEnemy,
};