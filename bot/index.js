// index.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Client, GatewayIntentBits, Collection } from "discord.js";
import dotenv from "dotenv";
dotenv.config();

import { getOrCreateUser, saveUser } from "./src/systems/userSystem.js";
import { loadUserCached, markUserDirty, touchUser, autoSaveUsers } from "./src/systems/userCacheSystem.js";

// Auto-salvar usuários a cada 30 segundos
setInterval(autoSaveUsers, 30 * 1000);

// Configuração base
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PREFIX = process.env.PREFIX || "!";
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// 🧩 Carregar comandos automaticamente
client.commands = new Collection();
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith(".js"));

for (const file of commandFiles) {
  const { default: command } = await import(`./commands/${file}`);
  if (command?.name && typeof command?.execute === "function") {
    client.commands.set(command.name, command);
    console.log(`✅ Comando carregado: ${command.name}`);
  } else {
    console.warn(`⚠️ Ignorado (sem export válido): ${file}`);
  }
}

client.once("ready", () => {
  console.log(`🤖 Eternal Clash Bot online como ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.content.startsWith(PREFIX)) return;
  
  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();
  const command = client.commands.get(commandName);
  
  if (!command) return message.reply("❌ Comando desconhecido.");
  
  try {
    // Middleware — carrega usuário com cache ou cria novo
    let user = loadUserCached(message.author.id);
    if (!user) user = getOrCreateUser(message.author.id);
    touchUser(message.author.id); // atualiza último uso
    
    // Executa comando passando o user
    await command.execute(message, args, user);
    
    // Marca como alterado para salvar no autoSave
    markUserDirty(message.author.id, user);
    
  } catch (err) {
    console.error(`Erro em ${commandName}:`, err);
    message.reply("⚠️ Ocorreu um erro ao executar esse comando.");
  }
});

client.login(process.env.DISCORD_TOKEN);