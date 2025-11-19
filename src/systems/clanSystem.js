import fs from "fs/promises";
import path from "path";

const CLANS_FILE = path.resolve("./src/data/clans.json");
const USERS_FILE = path.resolve("./src/data/users.json");

const MAX_CLAN_MEMBERS = 50;
const CLAN_XP_PER_LEVEL = 1000;
const CLAN_CREATION_COST = 5000;

// Leitura/escrita JSON
async function readJSON(file) {
  try {
    const data = await fs.readFile(file, "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function writeJSON(file, data) {
  await fs.writeFile(file, JSON.stringify(data, null, 2), "utf-8");
}

// Registrar usuário
export async function registerUser(userId, username, gold = 0) {
  const users = await readJSON(USERS_FILE);
  let user = users.find(u => u.id === userId);
  if (!user) {
    user = { id: userId, username, gold, clanId: null };
    users.push(user);
    await writeJSON(USERS_FILE, users);
  }
  return user;
}

// Salvar usuário
async function saveUser(updatedUser) {
  const users = await readJSON(USERS_FILE);
  const index = users.findIndex(u => u.id === updatedUser.id);
  if (index !== -1) users[index] = updatedUser;
  else users.push(updatedUser);
  await writeJSON(USERS_FILE, users);
}

// Criar clã
export async function createClan(user, name) {
  if (!name) return "❌ Nome do clã inválido.";
  
  const clans = await readJSON(CLANS_FILE);
  if (clans.find(c => c.name.toLowerCase() === name.toLowerCase())) return "❌ Já existe um clã com esse nome.";
  if (user.gold < CLAN_CREATION_COST) return `❌ Você precisa de ${CLAN_CREATION_COST} Ouro para criar um clã.`;
  
  const clan = {
    id: String(clans.length + 1),
    name,
    level: 1,
    xp: 0,
    members: [user.id]
  };
  
  clans.push(clan);
  user.clanId = clan.id;
  user.gold -= CLAN_CREATION_COST;
  
  await writeJSON(CLANS_FILE, clans);
  await saveUser(user);
  
  return `✅ Clã **${name}** criado com sucesso! Você agora é o líder e gastou ${CLAN_CREATION_COST} Ouro.`;
}

// Entrar em clã
export async function joinClan(user, nameOrId) {
  if (!nameOrId) return "❌ Informe o nome ou ID do clã.";
  const clans = await readJSON(CLANS_FILE);
  const clan = clans.find(c => c.id === nameOrId || c.name.toLowerCase() === nameOrId.toLowerCase());
  if (!clan) return "❌ Clã não encontrado.";
  if (clan.members.includes(user.id)) return "❌ Você já está nesse clã.";
  if (clan.members.length >= MAX_CLAN_MEMBERS) return "❌ Este clã atingiu o limite máximo de membros.";
  
  clan.members.push(user.id);
  user.clanId = clan.id;
  
  await writeJSON(CLANS_FILE, clans);
  await saveUser(user);
  
  return `✅ Você entrou no clã **${clan.name}** com sucesso!`;
}

// Sair de clã
export async function leaveClan(user) {
  if (!user.clanId) return "❌ Você não está em nenhum clã.";
  
  const clans = await readJSON(CLANS_FILE);
  const clan = clans.find(c => c.id === user.clanId);
  if (clan) {
    clan.members = clan.members.filter(id => id !== user.id);
    await writeJSON(CLANS_FILE, clans);
  }
  
  user.clanId = null;
  await saveUser(user);
  
  return clan ?
    `✅ Você saiu do clã **${clan.name}**.` :
    "⚠️ Clã não encontrado, mas você foi removido do registro.";
}

// Doar ouro para clã
export async function donateToClan(user, amount) {
  if (!user.clanId) return "❌ Você precisa estar em um clã para doar.";
  if (!amount || amount <= 0) return "❌ Valor inválido para doação.";
  if (user.gold < amount) return "❌ Você não tem ouro suficiente.";
  
  const clans = await readJSON(CLANS_FILE);
  const clan = clans.find(c => c.id === user.clanId);
  if (!clan) return "❌ Clã não encontrado.";
  
  user.gold -= amount;
  clan.xp += amount;
  
  // Level up automático
  while (clan.xp >= CLAN_XP_PER_LEVEL) {
    clan.level += 1;
    clan.xp -= CLAN_XP_PER_LEVEL;
  }
  
  await saveUser(user);
  await writeJSON(CLANS_FILE, clans);
  
  return `💰 Você doou **${amount} Ouro** para o clã **${clan.name}**!`;
}

// Info do clã
export async function getClanInfo(nameOrId) {
  const clans = await readJSON(CLANS_FILE);
  const clan = clans.find(c => c.id === nameOrId || c.name.toLowerCase() === nameOrId.toLowerCase());
  if (!clan) return "❌ Clã não encontrado.";
  
  return `🏰 **${clan.name}** (ID: ${clan.id})
Nv.: ${clan.level}
XP: ${clan.xp}/${CLAN_XP_PER_LEVEL}
Membros: ${clan.members.length}/${MAX_CLAN_MEMBERS}`;
}

// Ranking top 10
export async function getClanRankings() {
  const clans = await readJSON(CLANS_FILE);
  return clans
    .slice()
    .sort((a, b) => b.level - a.level || b.xp - a.xp)
    .slice(0, 10);
}