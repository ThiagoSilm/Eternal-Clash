// src/systems/clanSystem.js
import fs from "fs";
import path from "path";
import { loadUsers, saveUsers } from "./economySystem.js";

const clansPath = path.join("./data/clans.json");

export function loadClans() {
  if (!fs.existsSync(clansPath)) fs.writeFileSync(clansPath, JSON.stringify([]));
  return JSON.parse(fs.readFileSync(clansPath, "utf-8"));
}

export function saveClans(clans) {
  fs.writeFileSync(clansPath, JSON.stringify(clans, null, 2));
}

/** Cria um novo clan */
export function createClan(user, name) {
  const clans = loadClans();
  if (clans.find(c => c.name.toLowerCase() === name.toLowerCase()))
    return "❌ Clan já existe.";
  
  const clan = {
    id: Date.now(),
    name,
    level: 1,
    xp: 0,
    weeklyXp: 0,
    members: [{ id: user.id, role: "leader" }],
    rank: 0,
  };
  
  clans.push(clan);
  saveClans(clans);
  return `✅ Clan ${name} criado com sucesso! Você é o líder.`;
}

/** Usuário entra em um clan */
export function joinClan(user, clanId) {
  const clans = loadClans();
  const clan = clans.find(c => c.id === clanId);
  if (!clan) return "❌ Clan não encontrado.";
  
  if (clan.members.find(m => m.id === user.id))
    return "⚠️ Você já está nesse clan.";
  
  clan.members.push({ id: user.id, role: "member" });
  saveClans(clans);
  return `✅ Você entrou no clan ${clan.name}!`;
}

/** Usuário sai de um clan */
export function leaveClan(user) {
  const clans = loadClans();
  const clan = clans.find(c => c.members.find(m => m.id === user.id));
  if (!clan) return "⚠️ Você não está em nenhum clan.";
  
  clan.members = clan.members.filter(m => m.id !== user.id);
  
  // Se líder sair, promove o membro mais antigo
  if (clan.members.length > 0 && !clan.members.find(m => m.role === "leader"))
    clan.members[0].role = "leader";
  
  saveClans(clans);
  return `🛡️ Você saiu do clan ${clan.name}.`;
}

/** Retorna clan do usuário */
export function getUserClan(userId) {
  const clans = loadClans();
  return clans.find(c => c.members.some(m => m.id === userId));
}

/** Atualiza ranking global dos clans baseado no XP semanal */
export function updateClanRanks() {
  const clans = loadClans();
  clans.sort((a, b) => b.weeklyXp - a.weeklyXp);
  clans.forEach((c, i) => (c.rank = i + 1));
  saveClans(clans);
}

/** Retorna leaderboard top N clans */
export function getTopClans(limit = 10) {
  const clans = loadClans();
  clans.sort((a, b) => b.weeklyXp - a.weeklyXp);
  return clans.slice(0, limit).map(c => `${c.rank}. ${c.name} (Lv.${c.level}) - XP: ${c.weeklyXp}`);
}

/** Distribui prêmios semanais e reseta XP */
export function distributeWeeklyClanRewards() {
  const clans = loadClans();
  const users = loadUsers();
  
  clans.sort((a, b) => b.weeklyXp - a.weeklyXp);
  
  const rewards = [
    { gold: 5000, gems: 5, top: 1 },
    { gold: 3000, gems: 3, top: 2 },
    { gold: 2000, gems: 2, top: 3 },
  ];
  
  rewards.forEach(reward => {
    const clan = clans[reward.top - 1];
    if (!clan) return;
    clan.members.forEach(member => {
      const user = users.find(u => u.id === member.id);
      if (!user) return;
      user.gold += reward.gold;
      user.gems += reward.gems;
    });
  });
  
  // Reset semanal
  clans.forEach(c => {
    c.weeklyXp = 0;
  });
  
  saveClans(clans);
  saveUsers(users);
  
  return "🎁 Prêmios semanais distribuídos e XP resetado!";
}

/** Rotina diária para atualizar ranks */
export function dailyUpdate() {
  updateClanRanks();
  // Aqui podemos adicionar prêmios diários menores no futuro
}

/** Rotina semanal para distribuir prêmios */
export function weeklyUpdate() {
  distributeWeeklyClanRewards();
} 