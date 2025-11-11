// index.js
import fs from "fs";
import path from "path";
import readline from "readline";
import { fileURLToPath } from "url";
import "./bot/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Função pra carregar JSON de forma segura
function loadJSON(filePath, defaultData = {}) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
    return defaultData;
  }
}

// Função pra salvar JSON
function saveJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// Carregando configuração
const config = loadJSON(path.join(__dirname, "data/config.json"), {
  prefix: "!",
  gameName: "Eternal Clash",
  version: "0.1.0",
  energyRegenRate: 30,
  energyRegenHours: [10, 15], // ex: 10h e 15h
});

console.log(`🔥 ${config.gameName} iniciado (v${config.version}) 🔥`);