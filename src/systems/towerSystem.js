import { markUserDirty } from "./userCacheSystem.js";
import { addGold, addXP } from "./economySystem.js";

// --- Configuração ---
const MAX_FLOOR = 120;
const DAILY_ATTEMPTS = 3;
const REWARD_SCALING_FACTOR = 1.15; // Aumento de recompensas por andar

// ----------------------------------------------------
// 🔹 LÓGICA DE DADOS/MOCK (Para simular dados fixos da Torre)
// ----------------------------------------------------

/**
 * Retorna as especificações do inimigo para um determinado andar.
 * Em um jogo real, isso seria carregado de um arquivo JSON.
 * @param {number} floor - O andar atual.
 * @returns {object} Dados do inimigo.
 */
export function getFloorEnemy(floor) {
    const seed = floor % 10;
    const nameSuffix = (seed % 3 === 0) ? "Golem" : (seed % 3 === 1) ? "Dragão" : "Assassino";
    
    const baseHp = 500 + floor * 50;
    const baseAttack = 50 + floor * 10;
    
    // Define o oponente
    return {
        id: `E_TOWER_${floor}`,
        name: `Guardião do Andar ${floor} (${nameSuffix})`,
        hp: Math.floor(baseHp * (1 + seed * 0.05)),
        attack: Math.floor(baseAttack * (1 + seed * 0.05)),
        isPlayer: false, // Inimigo fixo da Torre
        deck: [], // Oponente usa um deck fixo (não implementado aqui)
        type: "tower_enemy"
    };
}

/**
 * Calcula a recompensa por completar um andar.
 * @param {number} floor - O andar atual.
 * @returns {object} Recompensas de Ouro e XP.
 */
export function getFloorReward(floor) {
    const baseGold = 500;
    const baseXP = 200;
    
    // Recompensa escalada exponencialmente
    const gold = Math.floor(baseGold * Math.pow(REWARD_SCALING_FACTOR, floor - 1));
    const xp = Math.floor(baseXP * Math.pow(REWARD_SCALING_FACTOR, floor - 1));
    
    // 💡 Ponto de Extensão: Adicionar chance de carta ou item aqui
    return { gold, xp };
}

// ----------------------------------------------------
// 🔹 LÓGICA DE GESTÃO DO ESTADO DO USUÁRIO
// ----------------------------------------------------

/**
 * Inicializa a estrutura da Torre do usuário e verifica a "primeira ativação do dia".
 * Se for a primeira vez no dia, concede recompensas do andar atual sem lutar.
 * @param {object} user - O objeto usuário.
 */
function checkDailyInit(user) {
    if (!user.tower) {
        user.tower = { floor: 1, attempts: DAILY_ATTEMPTS, lastAccess: 0 };
    }
    
    const today = new Date().toISOString().split('T')[0];
    const lastAccessDate = new Date(user.tower.lastAccess).toISOString().split('T')[0];
    let message = null;
    
    // Reseta as tentativas e verifica a primeira ativação
    if (lastAccessDate !== today) {
        user.tower.attempts = DAILY_ATTEMPTS;
        user.tower.lastAccess = Date.now();
        
        // Aplica a recompensa de "primeira ativação"
        if (user.tower.floor > 1) {
            const floorBefore = user.tower.floor - 1;
            const reward = getFloorReward(floorBefore);
            
            // Recompensas são aplicadas apenas pelos andares que ele já completou (andar anterior)
            addGold(user, reward.gold);
            addXP(user, reward.xp);
            
            message = `🎉 **Bem-vindo de volta à Torre!**\n` +
                `Suas tentativas foram resetadas para ${DAILY_ATTEMPTS}.\n` +
                `Recompensa de Ativação do Andar ${floorBefore} concedida: +${reward.gold} Ouro, +${reward.xp} XP.`;
        } else {
            message = `🎉 Suas tentativas de Torre foram resetadas para ${DAILY_ATTEMPTS}.`;
        }
        markUserDirty(user.id);
    }
    
    return message;
}

/**
 * Gasta uma tentativa de Torre do usuário.
 * @param {object} user - O objeto usuário.
 * @returns {boolean} True se a tentativa foi gasta, False se não havia tentativas.
 */
export function spendTowerAttempt(user) {
    // Garante a estrutura e executa a inicialização diária
    checkDailyInit(user);
    
    if ((user.tower.attempts || 0) > 0) {
        user.tower.attempts -= 1;
        user.tower.lastAccess = Date.now(); // Atualiza acesso para controle de reset
        markUserDirty(user.id);
        return true;
    }
    return false;
}

/**
 * Retorna uma string formatada com o status atual da Torre do usuário.
 * @param {object} user - O objeto usuário.
 * @returns {string} Status formatado.
 */
export function getTowerStatus(user) {
    // Garante que as tentativas e a recompensa diária sejam verificadas
    const dailyMessage = checkDailyInit(user);
    
    const floor = user.tower.floor || 1;
    const attempts = user.tower.attempts || 0;
    const nextEnemy = getFloorEnemy(floor);
    const nextReward = getFloorReward(floor);
    
    let status = `\n**Andar Atual:** ${floor} / ${MAX_FLOOR}`;
    status += `\n**Tentativas:** ${attempts} / ${DAILY_ATTEMPTS}`;
    
    if (floor <= MAX_FLOOR) {
        status += `\n\n**Próximo Desafio (Andar ${floor}):**`;
        status += `\n⚔️ Inimigo: ${nextEnemy.name} (HP: ${nextEnemy.hp}, ATK: ${nextEnemy.attack})`;
        status += `\n🎁 Recompensa: +${nextReward.gold} Ouro, +${nextReward.xp} XP (garantido em vitória)`;
    } else {
        status += `\n\n🏆 **PARABÉNS!** Você concluiu todos os ${MAX_FLOOR} andares da Torre.`;
    }
    
    return (dailyMessage ? `${dailyMessage}\n\n` : "") + status;
}

/**
 * Simula a compra de mais tentativas (custo: 5 Gemas por tentativa).
 * @param {object} user - O objeto usuário.
 * @param {number} amount - Quantidade de tentativas a comprar.
 * @returns {string} Mensagem de resposta.
 */
export function buyTowerAttempts(user, amount = 1) {
    checkDailyInit(user);
    const costPerAttempt = 5;
    const totalCost = amount * costPerAttempt;
    
    if (amount <= 0) return "❌ A quantidade de tentativas deve ser positiva.";
    
    // Assumimos que spendGems está disponível no economySystem.js e retorna boolean
    if (!spendGems(user, totalCost)) {
        return `❌ Você precisa de ${totalCost} Gemas para comprar ${amount} tentativas.`;
    }
    
    user.tower.attempts += amount;
    markUserDirty(user.id);
    
    return `💎 Você comprou **${amount}** tentativas de Torre por ${totalCost} Gemas. Tentativas atuais: ${user.tower.attempts}.`;
}

// ----------------------------------------------------
// 💡 Ponto de Extensão: Adicionar lógica de Reset da Torre (Prestige)
// ----------------------------------------------------