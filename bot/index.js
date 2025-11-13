// index.js

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Client, GatewayIntentBits, Collection } from "discord.js";
import dotenv from "dotenv";
// Importa todos os sistemas necessários
import { getOrCreateUser } from "../src/systems/userSystem.js";
import { loadUserCached, markUserDirty, touchUser, autoSaveUsers } from "../src/systems/userCacheSystem.js";

// Carrega variáveis de ambiente do .env
dotenv.config();

// ----------------------------------------------------
// 🔹 CONFIGURAÇÕES E INICIALIZAÇÃO
// ----------------------------------------------------

// Verifica o token antes de tudo
if (!process.env.DISCORD_TOKEN) {
    console.error("❌ ERRO FATAL: Variável DISCORD_TOKEN não encontrada. Crie um arquivo .env.");
    process.exit(1);
}

// Configuração de Caminhos
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define o prefixo com fallback seguro
const PREFIX = process.env.PREFIX || "!"; 

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Auto-salvar usuários a cada 30 segundos
const SAVE_INTERVAL_SECONDS = 30;
setInterval(autoSaveUsers, SAVE_INTERVAL_SECONDS * 1000);
console.log(`⏱️ Auto-salvamento de usuários configurado a cada ${SAVE_INTERVAL_SECONDS} segundos.`);

// ----------------------------------------------------
// 🔹 CARREGAMENTO DE COMANDOS
// ----------------------------------------------------

client.commands = new Collection();
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith(".js"));

for (const file of commandFiles) {
  try {
    const { default: command } = await import(`./commands/${file}`);
    if (command?.name && typeof command?.execute === "function") {
      client.commands.set(command.name, command);
      console.log(`✅ Comando carregado: \x1b[32m${command.name}\x1b[0m`); // Cor verde
    } else {
      console.warn(`⚠️ Ignorado (sem export válido): \x1b[33m${file}\x1b[0m`); // Cor amarela
    }
  } catch (err) {
    console.error(`❌ Erro ao carregar comando ${file}:`, err);
  }
}

// ----------------------------------------------------
// 🔹 EVENTO READY
// ----------------------------------------------------

client.once("ready", () => {
  console.log(`\n🤖 Eternal Clash Bot online como \x1b[36m${client.user.tag}\x1b[0m`); // Cor azul ciano
  console.log(`Prefixo de comando: \x1b[35m${PREFIX}\x1b[0m\n`); // Cor magenta
});

// ----------------------------------------------------
// 🔹 EVENTO messageCreate (Onde o middleware acontece)
// ----------------------------------------------------

/**
 * Middleware para carregar, tocar e marcar o usuário antes de executar o comando.
 */
async function loadUserMiddleware(userId) {
    let user = loadUserCached(userId);
    if (!user) {
        // Se não estiver no cache, carrega/cria do disco
        user = getOrCreateUser(userId);
    }
    touchUser(userId); // Marca o último uso para o cache não expirar
    return user;
}

client.on("messageCreate", async (message) => {
  // 1. Verificações iniciais
  if (message.author.bot || !message.content.startsWith(PREFIX)) return;
  
  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();
  const command = client.commands.get(commandName);
  
  if (!command) return message.reply("❌ Comando desconhecido.");
  
  try {
    // 2. MIDDLEWARE: Carrega o objeto user
    const user = await loadUserMiddleware(message.author.id);
    
    // 3. EXECUÇÃO
    await command.execute(message, args, user);
    
    // 4. PÓS-EXECUÇÃO: Sinaliza que o objeto no cache está modificado e precisa ser salvo
    markUserDirty(message.author.id, user);
    
  } catch (err) {
    console.error(`\n❌ ERRO DE EXECUÇÃO em ${commandName} (${message.author.tag}):`, err);
    message.reply("⚠️ Ocorreu um erro ao executar esse comando. O administrador foi notificado.");
  }
});

// ----------------------------------------------------
// 🔹 LOGIN
// ----------------------------------------------------

client.login(process.env.DISCORD_TOKEN);
