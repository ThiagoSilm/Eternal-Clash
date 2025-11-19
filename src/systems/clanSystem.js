import fs from "fs/promises";
import path from "path";

// --- ⚙️ Configuração ---
const CLANS_FILE = path.resolve("./src/data/clans.json");
const USERS_FILE = path.resolve("./src/data/users.json");

const MAX_CLAN_MEMBERS = 50;
const CLAN_XP_PER_LEVEL = 1000;
const CLAN_CREATION_COST = 5000;

// --- 📁 Acesso a Dados (Data Access) ---

/**
 * Lê um arquivo JSON e retorna o conteúdo ou um array vazio em caso de erro.
 * @param {string} file - O caminho para o arquivo JSON.
 * @returns {Promise<any[]>} O conteúdo do arquivo.
 */
async function readJSON(file) {
  try {
    const data = await fs.readFile(file, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      // Retorna array vazio se o arquivo não existir (primeiro uso)
      return []; 
    }
    // Para outros erros (ex: JSON inválido)
    console.error(`Erro ao ler ${file}:`, error.message);
    return [];
  }
}

/**
 * Escreve dados em um arquivo JSON.
 * @param {string} file - O caminho para o arquivo JSON.
 * @param {any} data - Os dados a serem escritos.
 */
async function writeJSON(file, data) {
  await fs.writeFile(file, JSON.stringify(data, null, 2), "utf-8");
}

// --- 👤 Funções Auxiliares de Usuário ---

/**
 * Salva um usuário atualizado ou novo na lista de usuários.
 * @param {object} updatedUser - O objeto do usuário a ser salvo.
 */
async function saveUser(updatedUser) {
  const users = await readJSON(USERS_FILE);
  const index = users.findIndex(u => u.id === updatedUser.id);
  
  if (index !== -1) {
    users[index] = updatedUser;
  } else {
    users.push(updatedUser);
  }
  
  await writeJSON(USERS_FILE, users);
}

// --- 🏰 Funções Auxiliares de Clã ---

/**
 * Encontra um clã pelo ID ou nome (case-insensitive).
 * @param {string} nameOrId - Nome ou ID do clã.
 * @param {Array<object>} clans - Lista de todos os clãs.
 * @returns {object | undefined} O objeto do clã.
 */
function findClan(nameOrId, clans) {
    return clans.find(c => c.id === nameOrId || c.name.toLowerCase() === nameOrId.toLowerCase());
}

// --- 🌐 Funções Exportáveis (Lógica de Negócios) ---

/**
 * Registra um novo usuário ou retorna o existente.
 */
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

/**
 * Cria um novo clã, definindo o usuário como membro inicial e cobrando o custo.
 */
export async function createClan(user, name) {
  const trimmedName = name ? name.trim() : '';

  if (!trimmedName) return "❌ Nome do clã inválido.";
  if (user.clanId) return "❌ Você já está em um clã. Saia primeiro para criar um novo.";
  
  const clans = await readJSON(CLANS_FILE);
  if (findClan(trimmedName, clans)) return "❌ Já existe um clã com esse nome.";
  if (user.gold < CLAN_CREATION_COST) return `❌ Você precisa de ${CLAN_CREATION_COST} Ouro para criar um clã.`;
  
  const clan = {
    id: String(clans.length + 1), // ID simples baseado no tamanho atual
    name: trimmedName,
    level: 1,
    xp: 0,
    members: [user.id] // O criador é o primeiro membro (e líder implícito)
  };
  
  clans.push(clan);
  user.clanId = clan.id;
  user.gold -= CLAN_CREATION_COST;
  
  await writeJSON(CLANS_FILE, clans);
  await saveUser(user);
  
  return `✅ Clã **${trimmedName}** criado com sucesso! Você gastou ${CLAN_CREATION_COST} Ouro.`;
}

/**
 * Permite que um usuário entre em um clã existente.
 */
export async function joinClan(user, nameOrId) {
  if (!nameOrId) return "❌ Informe o nome ou ID do clã.";
  if (user.clanId) return "❌ Você já está em um clã.";

  const clans = await readJSON(CLANS_FILE);
  const clan = findClan(nameOrId, clans);

  if (!clan) return "❌ Clã não encontrado.";
  if (clan.members.includes(user.id)) return "❌ Você já está nesse clã.";
  if (clan.members.length >= MAX_CLAN_MEMBERS) return "❌ Este clã atingiu o limite máximo de membros.";
  
  clan.members.push(user.id);
  user.clanId = clan.id;
  
  await writeJSON(CLANS_FILE, clans);
  await saveUser(user);
  
  return `✅ Você entrou no clã **${clan.name}** com sucesso!`;
}

/**
 * Remove o usuário do clã.
 */
export async function leaveClan(user) {
  if (!user.clanId) return "❌ Você não está em nenhum clã.";
  
  const clans = await readJSON(CLANS_FILE);
  const clan = clans.find(c => c.id === user.clanId);
  
  if (clan) {
    clan.members = clan.members.filter(id => id !== user.id);
    // TODO: Adicionar lógica de transferência de liderança se o usuário for o líder.
    
    await writeJSON(CLANS_FILE, clans);
  }
  
  const clanName = clan ? clan.name : null;
  user.clanId = null;
  await saveUser(user);
  
  return clan ?
    `✅ Você saiu do clã **${clanName}**.` :
    "⚠️ Clã não encontrado, mas você foi removido do registro.";
}

/**
 * Processa a doação de ouro e a progressão de XP/nível do clã.
 */
export async function donateToClan(user, amount) {
  if (!user.clanId) return "❌ Você precisa estar em um clã para doar.";
  const donationAmount = parseInt(amount);

  if (isNaN(donationAmount) || donationAmount <= 0) return "❌ Valor inválido para doação.";
  if (user.gold < donationAmount) return "❌ Você não tem ouro suficiente.";
  
  const clans = await readJSON(CLANS_FILE);
  const clan = clans.find(c => c.id === user.clanId);
  
  if (!clan) return "❌ Clã não encontrado.";
  
  user.gold -= donationAmount;
  clan.xp += donationAmount;
  
  let levelUpCount = 0;
  // Level up automático
  while (clan.xp >= CLAN_XP_PER_LEVEL) {
    clan.level += 1;
    clan.xp -= CLAN_XP_PER_LEVEL;
    levelUpCount++;
  }
  
  await saveUser(user);
  await writeJSON(CLANS_FILE, clans);
  
  let message = `💰 Você doou **${donationAmount} Ouro** para o clã **${clan.name}**!`;
  if (levelUpCount > 0) {
    message += `\n🎉 O clã subiu **${levelUpCount} Nível(is)**!`;
  }
  
  return message;
}

/**
 * Obtém informações detalhadas sobre um clã.
 */
export async function getClanInfo(nameOrId) {
  const clans = await readJSON(CLANS_FILE);
  const clan = findClan(nameOrId, clans);
  
  if (!clan) return "❌ Clã não encontrado.";
  
  return `🏰 **${clan.name}** (ID: ${clan.id})
Nv.: ${clan.level}
XP: ${clan.xp}/${CLAN_XP_PER_LEVEL}
Membros: ${clan.members.length}/${MAX_CLAN_MEMBERS}`;
}

/**
 * Retorna o ranking dos 10 clãs com base no nível e XP.
 */
export async function getClanRankings() {
  const clans = await readJSON(CLANS_FILE);
  
  return clans
    .slice() // Cria uma cópia para ordenar
    .sort((a, b) => b.level - a.level || b.xp - a.xp) // Ordena por Nível (maior primeiro) e depois por XP
    .slice(0, 10); // Limita aos 10 primeiros
}
