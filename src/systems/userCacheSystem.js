import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getOrCreateUser } from "./userSystem.js"; // tua função de criação padrão

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const usersPath = path.join(__dirname, "../../users/");

// Cache na memória
const userCache = new Map();

// Controla modificações
const dirtyUsers = new Set();

// Carrega usuário (do cache ou arquivo)
export function loadUserCached(userId) {
  if (userCache.has(userId)) {
    return userCache.get(userId);
  }
  
  const userFile = path.join(usersPath, `${userId}.json`);
  let user;
  
  if (fs.existsSync(userFile)) {
    user = JSON.parse(fs.readFileSync(userFile, "utf-8"));
  } else {
    user = getOrCreateUser(userId);
    fs.writeFileSync(userFile, JSON.stringify(user, null, 2));
  }
  
  userCache.set(userId, user);
  return user;
}

// Marca usuário como modificado (pra salvar depois)
export function markUserDirty(userId) {
  dirtyUsers.add(userId);
}

// Salva usuário específico
export function saveUserCached(userId) {
  if (!userCache.has(userId)) return;
  const user = userCache.get(userId);
  const userFile = path.join(usersPath, `${userId}.json`);
  fs.writeFileSync(userFile, JSON.stringify(user, null, 2));
  dirtyUsers.delete(userId);
}

// Salva todos os usuários modificados periodicamente
export function autoSaveUsers() {
  for (const userId of dirtyUsers) {
    saveUserCached(userId);
  }
}

// Remove usuários inativos do cache (opcional)
export function cleanupCache(maxInactiveMinutes = 10) {
  const now = Date.now();
  for (const [userId, user] of userCache.entries()) {
    if (!user.lastActive) user.lastActive = now;
    if (now - user.lastActive > maxInactiveMinutes * 60 * 1000) {
      saveUserCached(userId);
      userCache.delete(userId);
    }
  }
}

// Atualiza última atividade do usuário
export function touchUser(userId) {
  const user = userCache.get(userId);
  if (user) user.lastActive = Date.now();
} 