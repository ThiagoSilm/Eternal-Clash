// src/systems/arenaSystem.js
import { loadUser, saveUser } from "./economySystem.js";
import { simulateBattle } from "./battleSimulator.js";

// ✅ Tabela de ranks
const RANKS = [
  { name: "Bronze", min: 0, reward: { gold: 500 } },
  { name: "Prata", min: 100, reward: { gold: 1000, gems: 2 } },
  { name: "Ouro", min: 300, reward: { gold: 2000, gems: 5 } },
  { name: "Platina", min: 700, reward: { gold: 4000, gems: 10 } },
  { name: "Diamante", min: 1500, reward: { gold: 8000, gems: 20 } }
];

// 📊 Determina o rank do jogador com base nos pontos
export function getRank(points) {
  let current = RANKS[0];
  for (const r of RANKS) {
    if (points >= r.min) current = r;
    else break;
  }
  return current;
}

// 🏆 Ver status do jogador na Arena
export function arenaStatus(userId) {
  const user = loadUser(userId);
  const rank = getRank(user.arenaPoints || 0);
  
  return `🏆 **Arena — ${rank.name}**\n` +
    `⭐ Pontos: ${user.arenaPoints || 0}\n` +
    `✅ Vitórias: ${user.arenaWins || 0}\n` +
    `❌ Derrotas: ${user.arenaLosses || 0}`;
}

// ⚔️ Desafiar outro jogador
export function arenaChallenge(attackerId, defenderId) {
  if (attackerId === defenderId)
    return "❌ Você não pode lutar contra si mesmo.";
  
  const attacker = loadUser(attackerId);
  const defender = loadUser(defenderId);
  
  if (!defender || !defender.deck || defender.deck.length === 0)
    return "⚠️ O oponente não tem um deck configurado.";
  
  const now = Date.now();
  
  // Evita flood (60 segundos entre batalhas)
  if (attacker.lastArenaBattle && now - attacker.lastArenaBattle < 60000)
    return "⏳ Espere 1 minuto antes do próximo desafio na Arena.";
  
  attacker.lastArenaBattle = now;
  
  const result = simulateBattle(attacker, defender);
  
  let message;
  
  if (result === "attacker") {
    attacker.arenaPoints = (attacker.arenaPoints || 0) + 50;
    attacker.arenaWins = (attacker.arenaWins || 0) + 1;
    defender.arenaPoints = Math.max((defender.arenaPoints || 0) - 30, 0);
    defender.arenaLosses = (defender.arenaLosses || 0) + 1;
    message = `⚔️ ${attacker.name || "Jogador"} venceu ${defender.name || "Oponente"}!\n🏅 +50 pontos Arena`;
  } else {
    attacker.arenaPoints = Math.max((attacker.arenaPoints || 0) - 20, 0);
    attacker.arenaLosses = (attacker.arenaLosses || 0) + 1;
    defender.arenaPoints = (defender.arenaPoints || 0) + 40;
    defender.arenaWins = (defender.arenaWins || 0) + 1;
    message = `💀 ${attacker.name || "Jogador"} perdeu para ${defender.name || "Oponente"}!\n❌ -20 pontos Arena`;
  }
  
  saveUser(attacker);
  saveUser(defender);
  
  return message;
}

// 🎁 Coletar recompensa do rank
export function arenaReward(userId) {
  const user = loadUser(userId);
  const now = Date.now();
  
  // Recompensa só 1x por dia
  if (user.lastArenaReward && now - user.lastArenaReward < 86400000) {
    const hoursLeft = Math.ceil((86400000 - (now - user.lastArenaReward)) / 3600000);
    return `⏰ Você já coletou sua recompensa hoje. Tente novamente em ${hoursLeft}h.`;
  }
  
  const rank = getRank(user.arenaPoints || 0);
  const reward = rank.reward;
  
  if (!reward) return "⚠️ Nenhuma recompensa disponível.";
  
  user.gold += reward.gold || 0;
  user.gems += reward.gems || 0;
  user.lastArenaReward = now;
  
  saveUser(user);
  
  return `🎁 **Recompensa do rank ${rank.name} recebida!**\n` +
    `💰 +${reward.gold || 0} ouro ${reward.gems ? `💎 +${reward.gems} gemas` : ""}`;
}