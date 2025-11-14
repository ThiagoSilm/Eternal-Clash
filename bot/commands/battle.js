/**
 * bot/commands/battle.js
 * Comando de batalha com lógica de Cooldown (uso por contagem) implementada.
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

// Dados de carta com COOLDOWN (cooldown: 0 significa que a carta está pronta para ser jogada)
const BASE_PLAYER_CARDS = [
    // cooldown inicial de 1, significa que fica disponível no início do Turno 2
    { id: "p1", name: "Leaffang", hp: 500, maxHp: 500, attack: 40, defense: 5, effects: [], cooldown: 1, maxCooldown: 3 },
    { id: "p2", name: "Graniteback", hp: 600, maxHp: 600, attack: 35, defense: 10, effects: [], cooldown: 0, maxCooldown: 4 },
    { id: "p3", name: "Voidclaw", hp: 450, maxHp: 450, attack: 45, defense: 0, effects: [], cooldown: 2, maxCooldown: 2 },
];

const BASE_OPPONENT_CARDS = [
    { id: "shadow_beast", name: "Monstro das Sombras", hp: 120, maxHp: 120, attack: 35, defense: 0, effects: ["eff013"], cooldown: 1, maxCooldown: 3 },
    { id: "lesser_demon", name: "Demônio Menor", hp: 90, maxHp: 90, attack: 25, defense: 0, effects: ["eff046"], cooldown: 0, maxCooldown: 2 }
];

// O Deck deve ter 10 cartas no total
const createFullDeck = (baseCards, isPlayer) => {
    let deck = [];
    const maxCards = 10;
    
    // Adiciona cartas base (duplicando para atingir 10)
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
    
    // 1️⃣ Regeneração automática de energia (mantido o mock)
    const regenMsg = regenerateEnergy(user);
    if (regenMsg) await message.reply(`⚡ ${regenMsg}`);
    
    // 2️⃣ Custo de energia (mantido o mock)
    const energyCost = 4;
    if (!spendEnergy(user, energyCost))
      return message.reply(`❌ Energia insuficiente. Você precisa de **${energyCost}** de energia. (Atual: ${user.energy || 0})`);
    
    // 3️⃣ Preparar o oponente padrão (mapa 1-1)
    const opponent = {
      id: "cpu_shadow",
      name: "CPU - Oponente Sombrio",
      guardian: { id: "G02", name: "Guardião Sombrio", hp: 400, maxHp: 400, rageMax: 100, specialEffect: "eff037" }
    };
    
    // 4️⃣ Rodar batalha - Nova lógica de Cooldown
    let battle;
    try {
      battle = await simulateCooldownBattle(user, opponent, battleSystem);
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
      console.error("❌ Erro no simulateCooldownBattle:", err);
      return message.reply("⚠️ Erro interno ao processar a batalha.");
    }
  }
};

// -----------------------------
// Função auxiliar para exibir log - REDUÇÃO DE DELAY
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
    // 🔴 DELAY REDUZIDO PARA 300MS 🔴
    await new Promise(r => setTimeout(r, 300)); 
  }
  
  return battleMessage;
}

// -----------------------------
// NOVO: Funções de suporte Cooldown
// -----------------------------

const checkAvailableCards = (playerState) => {
    // Cartas disponíveis são aquelas no deck com cooldown <= 0
    return playerState.deck.filter(card => card.cooldown <= 0);
};

/**
 * Simula a jogada de uma carta, movendo-a do Deck (pool disponível) para o Board (campo).
 * A carta jogada volta ao deck com o cooldown resetado para o valor máximo.
 */
const playCard = (playerState, cardIndexInDeck, log) => {
    const cardToPlay = playerState.deck[cardIndexInDeck];
    
    if (cardToPlay && cardToPlay.cooldown <= 0) {
        
        // 1. Clonar para o Board (Campo)
        // Damos um novo ID para a instância em campo
        const boardCard = { 
            ...cardToPlay, 
            id: `${cardToPlay.id}_instance_${playerState.board.length}`,
            isCardInstance: true, // Marca como instância em campo
        };
        playerState.board.push(boardCard);
        
        // 2. Resetar Cooldown da carta no Deck (pool de disponibilidade)
        cardToPlay.cooldown = cardToPlay.maxCooldown;
        
        log.push(`   [PLAY] ${playerState.name} joga **${cardToPlay.name}** | CD resetado para ${cardToPlay.maxCooldown}.`);
        return true;
    }
    return false;
};

// -----------------------------
// NOVO: Função que simula o loop de Batalha por Cooldown
// -----------------------------
async function simulateCooldownBattle(user, opponent, system) {
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
        deck: playerDeck, // Cartas disponíveis (com cooldown)
        board: [], // Cartas em campo
    };
    
    // Estado do Oponente
    const opponentDeck = createFullDeck(BASE_OPPONENT_CARDS, false);
    const opponentState = {
        name: opponent.name,
        guardian: { ...opponent.guardian, hp: opponent.guardian.maxHp },
        deck: opponentDeck, // Cartas disponíveis (com cooldown)
        board: [], // Cartas em campo
    };

    const gameState = { user: userState, opponent: opponentState, log };
    system.startBattle(
        { playerBoard: userState.board, enemyBoard: opponentState.board }, 
        userState.guardian, 
        log
    );
    log.push(`\n⚔️ ${userState.name} (Guardião HP: ${userState.guardian.hp}) vs ${opponentState.name} (Guardião HP: ${opponentState.guardian.hp})!`);

    
    // --- 2. Loop de Turnos ---

    while (userState.guardian.hp > 0 && opponentState.guardian.hp > 0 && turn <= maxTurns) {
        log.push(`\n--- Turno ${turn} ---`);

        // --- A. FASE DO JOGADOR ---
        
        // 1. Redução do Cooldown
        userState.deck.forEach(card => {
            if (card.cooldown > 0) {
                card.cooldown--;
                log.push(`   [CD] ${userState.name} | ${card.name} CD: ${card.cooldown}`);
            }
        });

        // 2. Simulação de Jogada (Joga a primeira carta disponível)
        const availableCards = checkAvailableCards(userState);
        if (availableCards.length > 0) {
            // Encontra o índice da carta disponível no DECK original
            const cardToPlay = availableCards[0];
            const cardIndexInDeck = userState.deck.findIndex(c => c.id === cardToPlay.id);
            playCard(userState, cardIndexInDeck, log);
        }
        
        // 3. Fase de Ataque (Cartas no tabuleiro)
        log.push(`   [ATK] ${userState.name} ataca:`);
        performBoardAttacks(userState, opponentState, system, gameState, log);

        // --- B. FASE DO OPONENTE ---
        
        // 1. Redução do Cooldown
        opponentState.deck.forEach(card => {
            if (card.cooldown > 0) {
                card.cooldown--;
                log.push(`   [CD] ${opponentState.name} | ${card.name} CD: ${card.cooldown}`);
            }
        });

        // 2. Simulação de Jogada (Joga a primeira carta disponível)
        const availableCardsOpponent = checkAvailableCards(opponentState);
        if (availableCardsOpponent.length > 0) {
            const cardToPlay = availableCardsOpponent[0];
            const cardIndexInDeck = opponentState.deck.findIndex(c => c.id === cardToPlay.id);
            playCard(opponentState, cardIndexInDeck, log);
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
        
        // Limpeza de cartas derrotadas (se não forem guardiões)
        userState.board = userState.board.filter(c => c.hp > 0);
        opponentState.board = opponentState.board.filter(c => c.hp > 0);


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
            
            // Remove cartas derrotadas do board (se for carta, não guardião)
            if (!isTargetGuardian && target.hp <= 0) {
                log.push(`   [DEFEAT] ${target.name} foi derrotado!`);
                // A limpeza no final do turno já faz a remoção do array de board, 
                // mas essa verificação pode ser útil para efeitos imediatos.
            }
        }
    }
}