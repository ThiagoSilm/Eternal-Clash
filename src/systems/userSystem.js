// src/systems/userSystem.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const usersPath = path.join(__dirname, "../../users/");

// Garante que a pasta de usuários existe
if (!fs.existsSync(usersPath)) {
  fs.mkdirSync(usersPath, { recursive: true });
}

/**
 * Carrega um usuário existente ou cria um novo se não existir.
 * @param {string} userId - ID único do jogador
 * @returns {Object} Dados do usuário
 */
export function getOrCreateUser(userId) {
  const userFile = path.join(usersPath, `${userId}.json`);
  
  // Se o arquivo não existe, cria um novo usuário
  if (!fs.existsSync(userFile)) {
    const newUser = {
      id: userId,
      level: 1,
      xp: 0,
      gold: 1000,
      gems: 50,
      energy: 30,
      cards: [],
      decks: { main: [] },
      guardian: null,
      daily: { lastClaim: null, streak: 0 },
      clan: null,
      tower: { floor: 1, progress: [] },
    };
    
    fs.writeFileSync(userFile, JSON.stringify(newUser, null, 2));
    console.log(`🆕 Novo usuário criado: ${userId}`);
    return newUser;
  }
  
  // Se já existe, tenta carregar
  try {
    const userData = JSON.parse(fs.readFileSync(userFile, "utf-8"));
    return userData;
  } catch (err) {
    console.error(`❌ Erro ao ler dados do usuário ${userId}:`, err);
    // Recupera criando novo perfil
    const backupUser = {
      id: userId,
      level: 1,
      xp: 0,
      gold: 1000,
      gems: 50,
      energy: 30,
      cards: [],
      decks: { main: [] },
      guardian: null,
      daily: { lastClaim: null, streak: 0 },
      clan: null,
      tower: { floor: 1, progress: [] },
    };
    fs.writeFileSync(userFile, JSON.stringify(backupUser, null, 2));
    return backupUser;
  }
}

/**
 * Salva os dados atualizados do usuário.
 * @param {Object} user - Objeto de dados do jogador
 */
export function saveUser(user) {
  const userFile = path.join(usersPath, `${user.id}.json`);
  fs.writeFileSync(userFile, JSON.stringify(user, null, 2));
}