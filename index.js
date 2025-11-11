// index.js
import fs from "fs";
import path from "path";
import readline from "readline";
import { fileURLToPath } from "url";
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
dailyReset("Player");
import { mazeCommand } from "./src/commands/maze.js";
import { clanCommand } from "./src/commands/clan.js";
import { eventCommand } from "./src/commands/events.js";
import { arenaCommand } from "./src/commands/arena.js";
import { luckySpinCommand } from "./src/commands/luckySpin.js";
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

// Interface simples de linha de comando (CLI)
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function start() {
  console.log(`\nDigite um comando (ex: ${config.prefix}help):`);
  rl.on("line", async (line) => {
    const input = line.trim();
    if (!input.startsWith(config.prefix)) return;

    const [cmd, ...args] = input.slice(config.prefix.length).split(" ");

    switch (cmd.toLowerCase()) {
      case "help":
        console.log("Comandos: help, summon, battle, status");
        break;
      case "exit":
        console.log("Saindo do jogo...");
        process.exit(0);
        break;
      case "!invocar":
        summonCommand(args);
        break;
      case "upgrade":
        await handleUpgrade("player1", args);
        break;
      case "battle":
        await handleBattle("player1");
        break;
      case "!evoluir":
        evoluirCommand(args);
        break;
      case "!meld":
        meldCommand(args);
        break;
      case "!inventario":
        inventoryCommand();
        break;
      case "!deck":
        deckCommand(args);
        break;
      case "!energia":
        energyCommand();
        break;
      case "!reivindicar":
        claimEnergyCommand();
        break;
      case "!tower":
        towerCommand(args);
        break;
      case "!maze":
        mazeCommand(args);
        break;
      case "!clan":
        clanCommand(args);
        break;
      case "!evento":
        eventCommand(args);
        break;
      case "!arena":
        arenaCommand(args);
        break;
      case "!luckyspin":
        luckySpinCommand(args);
        break;
      default:
        console.log("Comando desconhecido. Use !help");
    }
  });
}
start();