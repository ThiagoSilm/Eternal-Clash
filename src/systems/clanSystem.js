// src/systems/clanSystem.js
import fs from "fs";

const file = "data/clans.json";

function loadClans() {
  return JSON.parse(fs.readFileSync(file));
}

function saveClans(data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

export function createClan(username, clanName) {
  const clans = loadClans();
  
  if (clans.find(c => c.name.toLowerCase() === clanName.toLowerCase()))
    return "⚠️ Já existe um clã com esse nome.";
  
  const clan = {
    name: clanName,
    leader: username,
    members: [username],
    gold: 0,
    xpBuff: 0,
    createdAt: new Date().toISOString(),
  };
  
  clans.push(clan);
  saveClans(clans);
  
  return `🏰 Clã **${clanName}** criado com sucesso por ${username}!`;
}

export function joinClan(username, clanName) {
  const clans = loadClans();
  
  const clan = clans.find(c => c.name.toLowerCase() === clanName.toLowerCase());
  if (!clan) return "❌ Clã não encontrado.";
  
  if (clan.members.includes(username))
    return "⚠️ Você já está nesse clã.";
  
  clan.members.push(username);
  saveClans(clans);
  return `🤝 ${username} entrou no clã **${clanName}**!`;
}

export function leaveClan(username) {
  const clans = loadClans();
  let left = false;
  
  clans.forEach(clan => {
    if (clan.members.includes(username)) {
      clan.members = clan.members.filter(m => m !== username);
      if (clan.leader === username) {
        if (clan.members.length > 0) {
          clan.leader = clan.members[0];
        } else {
          clan.delete = true;
        }
      }
      left = true;
    }
  });
  
  const updated = clans.filter(c => !c.delete);
  saveClans(updated);
  
  return left ? "🏃 Você saiu do clã." : "❌ Você não está em nenhum clã.";
}

export function donateToClan(username, amount) {
  const clans = loadClans();
  const clan = clans.find(c => c.members.includes(username));
  if (!clan) return "❌ Você não pertence a nenhum clã.";
  
  clan.gold += amount;
  saveClans(clans);
  
  return `💰 ${username} doou ${amount} ouro para o clã **${clan.name}**!`;
}

export function getClanInfo(clanName) {
  const clans = loadClans();
  const clan = clans.find(c => c.name.toLowerCase() === clanName.toLowerCase());
  if (!clan) return "❌ Clã não encontrado.";
  
  return `
🏰 **${clan.name}**
👑 Líder: ${clan.leader}
👥 Membros: ${clan.members.length}
💰 Ouro do clã: ${clan.gold}
📈 Buff de XP: +${clan.xpBuff * 100}%
📅 Criado em: ${new Date(clan.createdAt).toLocaleDateString("pt-BR")}
`;
}