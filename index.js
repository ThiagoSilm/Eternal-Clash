import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
<<<<<<< HEAD
import "./bot/index.js";
=======

// Imports dos comandos do jogo (preservados)
import { handleSummon } from "./src/commands/summon.js";
import { handleUpgrade } from "./src/commands/upgrade.js";
import { handleBattle } from "./src/commands/battle.js";
import { evoluirCommand, meldCommand } from "./src/commands/cards.js";
import { inventoryCommand } from "./src/commands/inventory.js";
import { deckCommand } from "./src/commands/deck.js";
import { energyCommand } from "./src/commands/energy.js";
import { claimEnergyCommand } from "./src/commands/claimEnergy.js";
import { towerCommand } from "./src/commands/tower.js";
import { dailyReset } from "./src/utils/dailyReset.js";
import { mazeCommand } from "./src/commands/maze.js";
import { clanCommand } from "./src/commands/clan.js";
import { eventCommand } from "./src/commands/events.js";
import { arenaCommand } from "./src/commands/arena.js";
import { luckySpinCommand } from "./src/commands/luckySpin.js";
>>>>>>> 9f9529367f853f8ba4df1b120188b3b36b851c71

// Executa o reset diário para o jogador (manter aqui)
dailyReset("Player");

// IMPORTANTE: Inicializa a lógica principal do Bot.
// O './' garante que o Node.js procure o arquivo 'bot/index.js' localmente.
import "./bot/index.js"; 

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Função pra carregar JSON de forma segura
function loadJSON(filePath, defaultData = {}) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    // Se o arquivo não existir ou for inválido, cria um novo com dados padrão
    fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
    return defaultData;
  }
}

// Função pra salvar JSON
function saveJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// Carregando configuração (ainda útil para o bot)
const config = loadJSON(path.join(__dirname, "data/config.json"), {
  prefix: "!",
  gameName: "Eternal Clash",
  version: "0.1.0",
  energyRegenRate: 30,
  energyRegenHours: [10, 15], // ex: 10h e 15h
});

console.log(`🔥 ${config.gameName} iniciado (v${config.version}) - MODO BOT ATIVO 🔥`);
