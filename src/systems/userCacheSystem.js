// src/systems/userCacheSystem.js
import fs from "fs";
import path from "path";

const dataPath = path.join(process.cwd(), "data/users.json");
const cache = new Map();
const dirty = new Set();

export function loadUserCached(userId) {
  if (cache.has(userId)) return cache.get(userId);
  
  let userData = {};
  if (fs.existsSync(dataPath)) {
    const allData = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
    userData = allData[userId] || {};
  }
  
  // Inicializa campos padrão
  const defaultUser = {
    userId,
    level: 1,
    xp: 0,
    energy: 10,
    gold: 0,
    gems: 0,
    coupons: 0,
    cards: [],
    decks: { deck1: [], deck2: [], deck3: [], deck4: [], deck5: [] },
    seed: Math.floor(Math.random() * 999999),
    lastEnergyClaim: 0,
  };
  
  const user = { ...defaultUser, ...userData };
  cache.set(userId, user);
  return user;
}

export function markUserDirty(userId) {
  dirty.add(userId);
}

export function saveUser(user) {
  const userId = user.userId;
  const allData = fs.existsSync(dataPath) ?
    JSON.parse(fs.readFileSync(dataPath, "utf-8")) :
    {};
  allData[userId] = user;
  fs.writeFileSync(dataPath, JSON.stringify(allData, null, 2));
  dirty.delete(userId);
}

// Salva todos os usuários sujos
export function flushCache() {
  if (dirty.size === 0) return;
  const allData = fs.existsSync(dataPath) ?
    JSON.parse(fs.readFileSync(dataPath, "utf-8")) :
    {};
  
  dirty.forEach((userId) => {
    const user = cache.get(userId);
    if (user) allData[userId] = user;
  });
  
  fs.writeFileSync(dataPath, JSON.stringify(allData, null, 2));
  dirty.clear();
}