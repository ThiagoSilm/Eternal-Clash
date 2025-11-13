import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { startBot } from "./bot/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadJSON(filePath, defaultData = {}) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
    return defaultData;
  }
}

function saveJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

const config = loadJSON(path.join(__dirname, "data/config.json"), {
  prefix: "!",
  gameName: "Eternal Clash",
  version: "0.1.0",
  energyRegenRate: 30,
  energyRegenHours: [10, 15],
});

async function main() {
    console.log("-------------------------------------------------");
    console.log(`🔥 ${config.gameName} iniciado (v${config.version}) - MODO BOT ATIVO 🔥`);

    await startBot(config);
    console.log("-------------------------------------------------");
}

main().catch(error => {
    console.error("❌ ERRO FATAL: O sistema não pôde ser inicializado.");
    console.error(error);
    process.exit(1);
});
