import fs from "fs";
import path from "path";

const dataPath = path.join(process.cwd(), "data/users.json");
const cache = new Map();
const dirty = new Set();
let allDiskData = {};

function loadAllDiskData() {
  if (fs.existsSync(dataPath)) {
    try {
      const data = fs.readFileSync(dataPath, "utf-8");
      allDiskData = JSON.parse(data);
    } catch (e) {
      console.error("Erro ao ler ou desserializar users.json:", e);
      allDiskData = {};
    }
  }
}

loadAllDiskData();

export function loadUserCached(userId) {
  if (cache.has(userId)) return cache.get(userId);
  const userData = allDiskData[userId] || null;
  if (userData) {
    cache.set(userId, userData);
    return userData;
  }
  const newUserPlaceholder = { id: userId };
  cache.set(userId, newUserPlaceholder);
  return newUserPlaceholder;
}

export function markUserDirty(userId) {
  dirty.add(userId);
}

export function flushCache() {
  if (dirty.size === 0) return;
  dirty.forEach((userId) => {
    const user = cache.get(userId);
    if (user) allDiskData[userId] = user;
  });
  try {
    fs.writeFileSync(dataPath, JSON.stringify(allDiskData, null, 2));
    dirty.clear();
  } catch (e) {
    console.error("FATAL ERROR: Falha ao escrever users.json no disco.", e);
  }
}