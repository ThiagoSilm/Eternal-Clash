// bot/index.js

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Client, GatewayIntentBits, Collection } from "discord.js";
import dotenv from "dotenv";
import chalk from "chalk";
import { performance } from "perf_hooks";

// Sistemas
import { loadUser } from "../src/systems/userSystem.js";
import { markUserDirty, flushCache } from "../src/systems/userCacheSystem.js";

// Cooldowns + Stats
const cooldowns = new Map();
let totalCommandsExecuted = 0;

// ----------------------------------------------------
// 🔹 LOGGER AVANÇADO
// ----------------------------------------------------
function log(type, msg) {
  const ts = new Date().toLocaleTimeString("pt-BR");
  const colors = {
    info: chalk.blue,
    warn: chalk.yellow,
    error: chalk.red,
    success: chalk.green,
    event: chalk.magenta
  };
  console.log(colors[type](`[${ts}] ${msg}`));
}

// ----------------------------------------------------
// 🔹 ANTI-CRASH GLOBAL
// ----------------------------------------------------
process.on("unhandledRejection", err => log("error", `Unhandled Rejection: ${err}`));
process.on("uncaughtException", err => log("error", `Uncaught Exception: ${err}`));

// ====================================================
// 🚀 INÍCIO DO BOT
// ====================================================
export async function startBot(config) {
  
  dotenv.config();
  
  if (!process.env.DISCORD_TOKEN) {
    log("error", "DISCORD_TOKEN não encontrado no .env");
    return;
  }
  
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  
  const PREFIX = config.prefix || "!";
  
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ]
  });
  
  // Auto salvar cache
  setInterval(flushCache, 30000);
  log("event", "Auto salvamento a cada 30s ativado.");
  
  // ====================================================
  // 🔹 CARREGAMENTO DE COMANDOS + HOT RELOAD
  // ====================================================
  client.commands = new Collection();
  const commandsPath = path.join(__dirname, "commands");
  const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith(".js"));
  
  for (const file of commandFiles) {
    try {
      const { default: command } = await import(`./commands/${file}`);
      if (command?.name && typeof command.execute === "function") {
        client.commands.set(command.name, command);
        log("success", `Comando carregado: ${command.name}`);
      } else {
        log("warn", `Ignorado (export inválido): ${file}`);
      }
    } catch (err) {
      log("error", `Erro ao carregar ${file}: ${err}`);
    }
  }
  
  // Hot reload em devMode
  if (config.devMode) {
    fs.watch(commandsPath, async (_, filename) => {
      if (!filename.endsWith(".js")) return;
      try {
        // Import dinâmico com timestamp para invalidar cache
        const { default: cmd } = await import(`./commands/${filename}?update=${Date.now()}`);
        if (cmd?.name) {
          client.commands.set(cmd.name, cmd);
          log("success", `HotReload → ${cmd.name}`);
        }
      } catch (e) {
        log("error", `Falha ao recarregar ${filename}: ${e}`);
      }
    });
    log("event", "HotReload ativado em devMode.");
  }
  
  // ====================================================
  // 🔹 READY
  // ====================================================
  client.once("ready", () => {
    log("success", `${config.gameName} ONLINE como ${client.user.tag}`);
    log("info", `Prefixo → ${PREFIX}`);
    
    const statuses = [
      `${config.gameName} Online`,
      `${PREFIX}help para ajuda`,
      `🔥 ${totalCommandsExecuted} comandos usados`,
    ];
    
    setInterval(() => {
      client.user.setActivity(statuses[Math.floor(Math.random() * statuses.length)]);
    }, 15000);
  });
  
  // ====================================================
  // 🔹 EVENTO PRINCIPAL messageCreate
  // ====================================================
  client.on("messageCreate", async (message) => {
    
    // Ignora bots e mensagens sem prefixo
    if (message.author.bot || !message.content.startsWith(PREFIX)) return;
    
    // Anti-links suspeitos
    if (/discord\.gg\/|http:\/\/|https:\/\//i.test(message.content))
      log("warn", `Possível link suspeito → ${message.author.tag}`);
    
    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();
    const command = client.commands.get(commandName);
    if (!command) return;
    
    // ⭐ Cooldown global
    const cdTime = command.cooldown || 1500;
    const cdKey = `${message.author.id}-${commandName}`;
    const last = cooldowns.get(cdKey);
    
    if (last && Date.now() < last + cdTime) {
      return message.reply(`⏳ Aguarde **${((last + cdTime - Date.now()) / 1000).toFixed(1)}s**.`);
    }
    
    cooldowns.set(cdKey, Date.now());
    
    try {
      // Middleware: carregar user
      const user = loadUser(message.author.id);
      
      // Performance tracking
      const start = performance.now();
      
      await command.execute(message, args, user);
      
      const end = performance.now();
      log("info", `Cmd '${commandName}' por ${message.author.tag} → ${Math.round(end - start)}ms`);
      
      // Usuário modificado
      markUserDirty(message.author.id);
      
      // Estatística global
      totalCommandsExecuted++;
      
    } catch (err) {
      log("error", `Erro no comando ${commandName}: ${err}`);
      message.reply("⚠️ Erro ao executar o comando.");
    }
  });
  
  // Estatísticas de uso a cada 1 min
  setInterval(() => {
    log("event", `📊 Total executados: ${totalCommandsExecuted}`);
  }, 60000);
  
  // Login
  await client.login(process.env.DISCORD_TOKEN);
}