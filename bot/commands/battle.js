/**
 * bot/commands/battle.js
 * Comando de batalha com lógica de TCC (Trading Card Game) implementada.
 */
import { BattleSystem } from "../../src/systems/battleSystem.js";
import { spendEnergy, addXP, addGold, regenerateEnergy } from "../../src/systems/economySystem.js";

// 1. Inicializa o sistema de batalha a partir da função de fábrica exportada.
const battleSystem = BattleSystem();

// Função utilitária para embaralhar
const shuffle = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
};

// Dados de carta com custo para a lógica TCC
const BASE_PLAYER_CARDS = [
    { id: "p1", name: "Leaffang", hp: 500, maxHp: 500, attack: 40, defense: 5, effects: [], cost: 3 },
    { id: "p2", name: "Graniteback", hp: 600, maxHp: 600, attack: 35, defense: 10, effects: [], cost: 2 },
    { id: "p3", name: "Voidclaw", hp: 450, maxHp: 450, attack: 45, defense: 0, effects: [], cost: 4 },
];

const BASE_OPPONENT_CARDS = [
    { id: "shadow_beast", name: "Monstro das Sombras", hp: 120, maxHp: 120, attack: 35, defense: 0, effects: ["eff013"], cost: 2 },
    { id: "lesser_demon", name: "Demônio Menor", hp: 90, maxHp: 90, attack: 25, defense: 0, effects: ["eff046"], cost: 1 }
];

// O Deck deve ter 10 cartas no total
const createFullDeck = (baseCards, isPlayer) => {
    let deck = [];
    const maxCards = 10;
    
    // Duplica cartas base para atingir 10
    for (let i = 0; i < maxCards; i++) {
        const baseCard = baseCards[i % baseCards.length];
        deck.push({ 
            ...baseCard, 
            id: `${isPlayer ? 'P' : 'E'}_${baseCard.id}_${i}`, 
            isPlayer,
            status: {} 
        });
    }
    return shuffle(deck);
};

export default {
  name: "battle",
  description: "Batalhe contra inimigos e ganhe XP e ouro.",
  
  async execute(message, args, user) {
    if (!user) return message.reply("⚠️ Usuário não carregado. Reinicie o comando.");
    
    user.name = user.name || message.author.username || "Heroi";
    
    // 🔴 HP DO GUARDIÃO FIXADO EM 10000 🔴
    user.guardian = user.guardian || { id: "G01", name: "Guardião Aliado", hp: 10000, maxHp: 10000, rageMax: 100, specialEffect: "eff001" };
    
    // 1️⃣ Regeneração automática de energia
    const regenMsg = regenerateEnergy(user);
    if (regenMsg) await message.reply(`⚡ ${regenMsg}`);
    
    // 2️⃣ Custo de energia (apenas verificando o custo)
    const energyCost = 4;
    if (!spendEnergy(user, energyCost))
      return message.reply(`❌ Energia insuficiente. Você precisa de **${energyCost}** de energia. (Atual: ${user.energy || 0})`);
    
    // 3️⃣ Preparar o oponente padrão (mapa 1-1)
    const opponent = {
      id: "cpu_shadow",
      name: "CPU - Oponente Sombrio",
      guardian: { id: "G02", name: "Guardião Sombrio", hp: 400, maxHp: 400, rageMax: 100, specialEffect: "eff037" }
    };
    
    // 4️⃣ Rodar batalha - Nova lógica TCC
    let battle;
    try {
      battle = await simulateTCCBattle(user, opponent, battleSystem);
      const battleMessage = await displayBattleLog(message, battle); // exibe log em tempo real
      
      // 5️⃣ Mensagem final e recompensas
      const rewards = battle.rewards || { xp: 0, gold: 0 };
      let finalMsg = battle.win ?
        `\n🏆 **Você venceu!**\n✨ XP ganho: **${rewards.xp}**\n💰 Ouro ganho: **${rewards.gold}**` :
        `\n😓 **Derrota!** Nenhuma recompensa recebida.`;
      
      await battleMessage.edit(battleMessage.content + finalMsg);
      
      if (battle.win) {
        addXP(user, rewards.xp);
        addGold(user, rewards.gold);
      }
      
    } catch (err) {
      console.error("❌ Erro no simulateTCCBattle:", err);
      return message.reply("⚠️ Erro interno ao processar a batalha.");
    }
  }
};

// -----------------------------
// Função auxiliar para exibir log
// -----------------------------
async function displayBattleLog(message, battle) {
  const battleMessage = await message.reply(`⚔️ Iniciando a batalha...\n🔄 Preparando o inimigo...`);
  
  for (const line of battle.log) {
    const text = String(line);
    // Adaptação para evitar mensagens muito longas em um ambiente real
    if (battleMessage.content.length + text.length > 2000) {
        // Se a mensagem estiver muito longa, edite para mostrar apenas o final
        await battleMessage.edit(`[Log Truncado. Por favor, verifique o log completo.]\n${text}`);
    } else {
        await battleMessage.edit(battleMessage.content + "\n" + text);
    }
    await new Promise(r => setTimeout(r, 1200)); // delay para simular gameplay
  }
  
  return battleMessage;
}

// -----------------------------
// NOVO: Funções de suporte TCC
// -----------------------------

const drawCard = (playerState, amount = 1, log) => {
    for (let i = 0; i < amount; i++) {
        if (playerState.deck.length > 0) {
            const card = playerState.deck.shift(); // Remove do deck
            playerState.hand.push(card); // Adiciona à mão
            log.push(`   [DRAW] ${playerState.name} compra ${card.name}. (${playerState.hand.length} na mão)`);
        } else {
            log.push(`   [DRAW] ${playerState.name} não tem mais cartas no deck.`);
            // Implementar dano de fadiga, se necessário
        }
    }
};

const playCard = (playerState, cardIndex, log) => {
    const card = playerState.hand[cardIndex];
    if (card && playerState.energy >= card.cost) {
        // Remove da mão e adiciona ao board
        playerState.hand.splice(cardIndex, 1);
        playerState.board.push(card);
        playerState.energy -= card.cost;
        log.push(`   [PLAY] ${playerState.name} joga **${card.name}** (Custo: ${card.cost}) | Energia restante: ${playerState.energy}`);
        return true;
    }
    return false;
};

// -----------------------------
// NOVO: Função que simula o loop TCC completo
// -----------------------------
async function simulateTCCBattle(user, opponent, system) {
    const log = [];
    const maxTurns = 30; 
    let turn = 1;
    let win = false;
    
    // --- 1. Inicialização do Estado ---
    
    // Estado do Jogador
    const playerDeck = createFullDeck(BASE_PLAYER_CARDS, true);
    const userState = {
        name: user.name,
        guardian: { ...user.guardian, hp: user.guardian.maxHp },
        deck: playerDeck,
        hand: [],
        board: [],
        energy: 0,
        maxEnergy: 0,
    };
    
    // Estado do Oponente
    const opponentDeck = createFullDeck(BASE_OPPONENT_CARDS, false);
    const opponentState = {
        name: opponent.name,
        guardian: { ...opponent.guardian, hp: opponent.guardian.maxHp },
        deck: opponentDeck,
        hand: [],
        board: [],
        energy: 0,
        maxEnergy: 0,
    };

    // --- 2. Fase de Início de Jogo (Sorteio Inicial) ---
    drawCard(userState, 3, log); // Sorteio inicial do jogador (3 cartas)
    drawCard(opponentState, 3, log); // Sorteio inicial do oponente (3 cartas)
    
    const gameState = { user: userState, opponent: opponentState, log };
    system.startBattle(
        { playerBoard: userState.board, enemyBoard: opponentState.board }, 
        userState.guardian, 
        log
    );
    log.push(`\n⚔️ ${userState.name} (Guardião HP: ${userState.guardian.hp}) vs ${opponentState.name} (Guardião HP: ${opponentState.guardian.hp})!`);

    
    // --- 3. Loop de Turnos ---

    while (userState.guardian.hp > 0 && opponentState.guardian.hp > 0 && turn <= maxTurns) {
        log.push(`\n--- Turno ${turn} ---`);

        // --- A. FASE DO JOGADOR ---
        
        // 1. Recarga e Sorteio (Max Energy até 10)
        userState.maxEnergy = Math.min(10, userState.maxEnergy + 1);
        userState.energy = userState.maxEnergy;
        log.push(`   [ENERGY] ${userState.name} | Energia: ${userState.energy}/${userState.maxEnergy}`);
        drawCard(userState, 1, log); // Sorteia 1 carta

        // 2. Simulação de Jogada (Estratégia: Joga todas as cartas que puder, da mais barata para a mais cara)
        // A lógica do usuário é jogar todas as cartas disponíveis ao mesmo tempo
        userState.hand.sort((a, b) => a.cost - b.cost); // Ordena pela mais barata
        let playedCard = true;
        while(playedCard) {
            playedCard = false;
            // Tenta jogar a primeira carta (mais barata)
            if (userState.hand.length > 0 && userState.hand[0].cost <= userState.energy) {
                playCard(userState, 0, log);
                playedCard = true; // Se jogou, tenta de novo
            }
        }
        
        // 3. Fase de Ataque (Cartas no tabuleiro)
        log.push(`   [ATK] ${userState.name} ataca:`);
        performBoardAttacks(userState, opponentState, system, gameState, log);

        // --- B. FASE DO OPONENTE ---
        
        // 1. Recarga e Sorteio
        opponentState.maxEnergy = Math.min(10, opponentState.maxEnergy + 1);
        opponentState.energy = opponentState.maxEnergy;
        log.push(`   [ENERGY] ${opponentState.name} | Energia: ${opponentState.energy}/${opponentState.maxEnergy}`);
        drawCard(opponentState, 1, log); // Sorteia 1 carta

        // 2. Simulação de Jogada (Estratégia: Joga todas as cartas que puder, da mais barata)
        opponentState.hand.sort((a, b) => a.cost - b.cost); // Ordena pela mais barata
        playedCard = true;
        while(playedCard) {
            playedCard = false;
            // Tenta jogar a primeira carta (mais barata)
            if (opponentState.hand.length > 0 && opponentState.hand[0].cost <= opponentState.energy) {
                playCard(opponentState, 0, log);
                playedCard = true; // Se jogou, tenta de novo
            }
        }
        
        // 3. Fase de Ataque
        log.push(`   [ATK] ${opponentState.name} ataca:`);
        performBoardAttacks(opponentState, userState, system, gameState, log);


        // --- C. FASE DE FIM DE TURNO ---
        const allCards = [...userState.board, ...opponentState.board].filter(c => c.hp > 0);
        allCards.forEach(card => {
            if (card.hp > 0) {
                const allies = card.isPlayer ? userState.board : opponentState.board;
                const enemies = card.isPlayer ? opponentState.board : userState.board;
                system.triggerEffects('afterTurn', [card], { card, allies, enemies, log });
                system.processStatusEffects(card, log);
            }
        });
        
        // Log de vida ao final do turno
        log.push(`[Status] J-Guardião HP: ${userState.guardian.hp.toFixed(1)} | O-Guardião HP: ${opponentState.guardian.hp.toFixed(1)}`);

        // Verificar o fim da batalha
        if (opponentState.guardian.hp <= 0) {
            win = true;
            break;
        } else if (userState.guardian.hp <= 0) {
            win = false;
            break;
        }
        
        turn++;
    }

    log.push("\n--- Fim da Batalha ---");
    
    const rewards = win ? { xp: 50 + (turn * 2), gold: 30 } : { xp: 0, gold: 0 };

    return { win, log, rewards, };
}

/**
 * Lógica de ataque para todas as cartas em campo.
 */
function performBoardAttacks(attackerState, targetState, system, gameState, log) {
    const liveAttackers = attackerState.board.filter(c => c.hp > 0);
    const liveDefenders = targetState.board.filter(c => c.hp > 0);
    
    // Prioriza atacar cartas, se não houver, ataca o Guardião
    for (const card of liveAttackers) {
        let target = null;
        
        // Alvo Aleatório (se houver cartas vivas)
        if (liveDefenders.length > 0) {
            target = liveDefenders[Math.floor(Math.random() * liveDefenders.length)];
        } else if (targetState.guardian.hp > 0) {
            target = targetState.guardian;
        }
        
        if (target && target.hp > 0) {
            const isTargetGuardian = target.id.startsWith('G');
            const targetName = isTargetGuardian ? `${targetState.name} Guardião` : target.name;

            // Define o contexto de ataque
            const attackContext = { 
                allies: attackerState.board,
                enemies: targetState.board,
                game: gameState,
                log,
            };
            
            // Perform Attack (usa o método do seu battleSystem)
            system.performAttack(card, target, attackContext);
            
            // Remove cartas derrotadas do board
            if (!isTargetGuardian && target.hp <= 0) {
                log.push(`   [DEFEAT] ${target.name} foi derrotado!`);
                targetState.board = targetState.board.filter(c => c.hp > 0);
            }
            
            // Se o Guardião for derrotado, a batalha termina (verificado no loop principal)
        }
    }
}