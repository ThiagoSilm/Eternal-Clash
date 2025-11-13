// src/systems/arenaSystem.js
import { loadUserCached, markUserDirty } from "./userCacheSystem.js";
import { battleSystem } from "./battleSystem.js"; // usa o sistema de batalha real
import { getTimestampDay } from "../utils/timeUtils.js"; // helper simples para reset diário

// 🏅 Configuração de ranks
const RANKS = [
  { name: "Bronze", min: 0, reward: { gold: 500 } },
  { name: "Prata", min: 100, reward: { gold: 1000, gems: 2 } },
  { name: "Ouro", min: 300, reward: { gold: 2000, gems: 5 } },
  { name: "Platina", min: 700, reward: { gold: 4000, gems: 10 } },
  { name: "Diamante", min: 1500, reward: { gold: 8000, gems: 20 } },
];

// 🎯 Retorna o rank atual do jogador
function getRank(points) {
  let current = RANKS[0];
  for (const r of RANKS) {
    if (points >= r.min) current = r;
    else break;
  }
  return current;
}

// 🧠 Gera cinco oponentes diários (aleatórios entre jogadores salvos)
export function generateArenaOpponents(userId, allUsers) {
  const user = loadUserCached(userId);
  const today = getTimestampDay(Date.now());
  
  if (user.lastArenaReset === today && user.arenaOpponents?.length === 5)
    return user.arenaOpponents; // já tem oponentes de hoje
  
  const candidates = allUsers
    .filter(u => u.id !== userId && u.deck && u.deck.length > 0)
    .sort(() => Math.random() - 0.5)
    .slice(0, 5)
    .map(u => ({ id: u.id, name: u.name, power: u.power || 0 }));
  
  user.arenaOpponents = candidates;
  user.arenaTries = 5; // reseta tentativas
  user.lastArenaReset = today;
  markUserDirty(userId);
  return candidates;
}

// 📊 Mostra o status do jogador
export function arenaStatus(userId) {
  const user = loadUserCached(userId);
  const rank = getRank(user.arenaPoints || 0);
  return (
    `🏆 **Arena — ${rank.name}**\n` +
    `⭐ Pontos: ${user.arenaPoints || 0}\n` +
    `✅ Vitórias: ${user.arenaWins || 0}\n` +
    `❌ Derrotas: ${user.arenaLosses || 0}\n` +
    `🎯 Tentativas restantes: ${user.arenaTries || 0}/5`
  );
}

// ⚔️ Desafiar um dos oponentes diários
export function arenaChallenge(attackerId, defenderId) {
  const attacker = loadUserCached(attackerId);
  const defender = loadUserCached(defenderId);
  
  if (!attacker.arenaTries || attacker.arenaTries <= 0)
    return "⚠️ Você usou todas as 5 tentativas de hoje.";
  
  if (!defender || !defender.deck?.length)
    return "⚠️ O oponente não tem deck configurado.";
  
  attacker.arenaTries--;
  
  const result = battleSystem(attacker, defender); // ✅ batalha real
  let message = "";
  
  if (result.winner === "attacker") {
    attacker.arenaPoints = (attacker.arenaPoints || 0) + 50;
    attacker.arenaWins = (attacker.arenaWins || 0) + 1;
    defender.arenaPoints = Math.max((defender.arenaPoints || 0) - 30, 0);
    defender.arenaLosses = (defender.arenaLosses || 0) + 1;
    attacker.gems = (attacker.gems || 0) + 3; // recompensa instantânea
    message = `⚔️ ${attacker.name} venceu ${defender.name}!\n🏅 +50 pontos Arena\n💎 +3 gemas`;
  } else {
    attacker.arenaPoints = Math.max((attacker.arenaPoints || 0) - 20, 0);
    attacker.arenaLosses = (attacker.arenaLosses || 0) + 1;
    defender.arenaPoints = (defender.arenaPoints || 0) + 40;
    defender.arenaWins = (defender.arenaWins || 0) + 1;
    message = `💀 ${attacker.name} perdeu para ${defender.name}!\n❌ -20 pontos Arena`;
  }
  
  markUserDirty(attackerId);
  markUserDirty(defenderId);
  return message;
}

// 🎁 Coletar recompensa diária
export function arenaReward(userId) {
  const user = loadUserCached(userId);
  const now = Date.now();
  
  if (user.lastArenaReward && now - user.lastArenaReward < 86400000) {
    const hoursLeft = Math.ceil(
      (86400000 - (now - user.lastArenaReward)) / 3600000
    );
    return `⏰ Você já coletou sua recompensa hoje. Tente novamente em ${hoursLeft}h.`;
  }
  
  const rank = getRank(user.arenaPoints || 0);
  const reward = rank.reward || {};
  
  user.gold += reward.gold || 0;
  user.gems += reward.gems || 0;
  user.lastArenaReward = now;
  
  markUserDirty(userId);
  
  return (
    `🎁 **Recompensa do rank ${rank.name} recebida!**\n` +
    `💰 +${reward.gold || 0} ouro ${reward.gems ? `💎 +${reward.gems} gemas` : ""}`
  );
}