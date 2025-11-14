/**
 * bot/commands/battle.js
 * Comando de batalha com correção de importação e implementação do loop de combate.
 */
import { BattleSystem } from "../../src/systems/battleSystem.js";
import { spendEnergy, addXP, addGold, regenerateEnergy } from "../../src/systems/economySystem.js";

// 1. CORREÇÃO: Inicializa o sistema de batalha a partir da função de fábrica exportada.
const battleSystem = BattleSystem();

export default {
  name: "battle",
  description: "Batalhe contra inimigos e ganhe XP e ouro.",
  
  async execute(message, args, user) {
    if (!user) return message.reply("⚠️ Usuário não carregado. Reinicie o comando.");
    
    // Configurações de batalha e usuário mock para demonstração
    user.name = user.name || message.author.username || "Heroi";
    
    // 💥 CORREÇÃO DE ESTATÍSTICAS: Usando os nomes do seu log e reduzindo o ataque base
    user.cards = user.cards || [
      // Leaffang: Attacker balanceado
      { id: "player_card1", name: "Leaffang", hp: 100, maxHp: 100, attack: 30, defense: 5, effects: [] },
      // Graniteback: Tank mais defensivo
      { id: "player_card2", name: "Graniteback", hp: 150, maxHp: 150, attack: 25, defense: 10, effects: [] },
      // Voidclaw: Atacante rápido, alto dano (o dano pode vir dos efeitos)
      { id: "player_card3", name: "Voidclaw", hp: 80, maxHp: 80, attack: 35, defense: 0, effects: [] },
    ];
    // Garantindo que o Guardião tenha maxHp definido.
    // 🔴 AUMENTANDO O HP DO GUARDIÃO PARA 10000 🔴
    user.guardian = user.guardian || { id: "G01", name: "Guardião Aliado", hp: 10000, maxHp: 10000, rageMax: 100, specialEffect: "eff001" };
    
    // 1️⃣ Regeneração automática de energia
    const regenMsg = regenerateEnergy(user);
    if (regenMsg) await message.reply(`⚡ ${regenMsg}`);
    
    // 2️⃣ Custo de energia
    const energyCost = 4;
    if (!spendEnergy(user, energyCost))
      return message.reply(`❌ Energia insuficiente. Você precisa de **${energyCost}** de energia. (Atual: ${user.energy || 0})`);
    
    // 3️⃣ Preparar o oponente padrão (mapa 1-1)
    const opponent = {
      id: "cpu_shadow",
      name: "CPU - Oponente Sombrio",
      cards: [
        { id: "shadow_beast", name: "Monstro das Sombras", hp: 120, maxHp: 120, attack: 35, defense: 0, effects: ["eff013"] },
        { id: "lesser_demon", name: "Demônio Menor", hp: 90, maxHp: 90, attack: 25, defense: 0, effects: ["eff046"] }
      ],
      guardian: { id: "G02", name: "Guardião Sombrio", hp: 400, maxHp: 400, rageMax: 100, specialEffect: "eff037" }
    };
    
    // 4️⃣ Rodar batalha - Agora usa a função simulada abaixo
    let battle;
    try {
      // Passando o battleSystem como parâmetro
      battle = await simulateAutoBattle(user, opponent, battleSystem);
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
      console.error("❌ Erro no simulateAutoBattle:", err);
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
// NOVO: Função que simula o loop completo da batalha, substituindo 'runBattle'
// -----------------------------
async function simulateAutoBattle(user, opponent, system) {
  const log = [];
  const maxTurns = 15;
  let turn = 1;
  let win = false;
  
  // Clonar e inicializar o estado: GARANTINDO QUE HP VOLTE AO MÁXIMO
  const userCards = user.cards.map(c => ({ ...c, hp: c.maxHp, isPlayer: true, status: {} }));
  const opponentCards = opponent.cards.map(c => ({ ...c, hp: c.maxHp, isPlayer: false, status: {} }));
  
  // CORREÇÃO: Usar maxHp para resetar o HP inicial do Guardião
  const userGuardian = { ...user.guardian, hp: user.guardian.maxHp };
  const opponentGuardian = { ...opponent.guardian, hp: opponent.guardian.maxHp };
  
  const gameState = {
    playerBoard: userCards,
    enemyBoard: opponentCards,
    userGuardian,
    opponentGuardian,
    log // Log está agora no gameState
  };
  
  // Inicia a batalha (Gatilhos 'onBattleStart')
  // Passando o log como parte do contexto
  system.startBattle({ playerBoard: userCards, enemyBoard: opponentCards }, userGuardian, log);
  log.push(`\n⚔️ ${user.name} (Guardião HP: ${userGuardian.hp}) vs ${opponent.name} (Guardião HP: ${opponentGuardian.hp})!`);
  
  while (userGuardian.hp > 0 && opponentGuardian.hp > 0 && turn <= maxTurns) {
    log.push(`\n--- Turno ${turn} ---`);
    
    // Lista de todas as cartas em ordem de iniciativa (simplificado: Jogador -> Oponente)
    const allCards = [...userCards, ...opponentCards].filter(c => c.hp > 0);
    
    for (const card of allCards) {
      if (card.hp <= 0) continue;
      
      const isPlayer = card.isPlayer;
      
      // Cartas e Guardião Alvos vivos (do lado oposto)
      const liveEnemies = isPlayer ? opponentCards.filter(c => c.hp > 0) : userCards.filter(c => c.hp > 0);
      const enemyGuardian = isPlayer ? opponentGuardian : userGuardian;
      
      // Encontra um alvo: prioriza cartas, depois o Guardião
      // Alvo Aleatório (se houver cartas vivas)
      let target = null;
      if (liveEnemies.length > 0) {
        target = liveEnemies[Math.floor(Math.random() * liveEnemies.length)];
      } else if (enemyGuardian.hp > 0) {
        target = enemyGuardian;
      }
      
      if (target && target.hp > 0) {
        // Perform Attack (usa o método do seu battleSystem)
        system.performAttack(card, target, {
          allies: isPlayer ? userCards : opponentCards, // todas as cartas aliadas
          enemies: isPlayer ? opponentCards : userCards, // todas as cartas inimigas
          game: gameState,
          log // Passando o log array para o performAttack
        });
      }
    }
    
    // Processar efeitos de status (no fim do turno)
    // Efeitos 'afterTurn' (Regen, Aura, etc.) e Status DOT
    allCards.forEach(card => {
      if (card.hp > 0) {
        system.triggerEffects('afterTurn', [card], { card, allies: userCards, enemies: opponentCards, log });
        system.processStatusEffects(card, log);
      }
    });
    
    // Log de vida ao final do turno
    log.push(`[Status] J-Guardião HP: ${userGuardian.hp.toFixed(1)} | O-Guardião HP: ${opponentGuardian.hp.toFixed(1)}`);
    
    
    // Verificar o fim da batalha
    if (opponentGuardian.hp <= 0) {
      win = true;
      break;
    } else if (userGuardian.hp <= 0) {
      win = false;
      break;
    }
    
    turn++;
  }
  
  log.push("\n--- Fim da Batalha ---");
  
  // Definir recompensas
  const rewards = win ? { xp: 50 + (turn * 2), gold: 30 } : { xp: 0, gold: 0 };
  
  return {
    win,
    log,
    rewards,
  };
}