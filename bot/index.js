// bot/index.js

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Client, GatewayIntentBits, Collection } from "discord.js";
import dotenv from "dotenv";

// Importa os sistemas (ajuste o caminho se necessário)
import { loadUser } from "../src/systems/userSystem.js"; 
import { markUserDirty, flushCache } from "../src/systems/userCacheSystem.js"; 

// A função startBot recebe o objeto config que foi carregado no arquivo principal
export async function startBot(config) {

    dotenv.config(); // Carregar variáveis de ambiente

    // ----------------------------------------------------
    // 🔹 CONFIGURAÇÕES E INICIALIZAÇÃO
    // ----------------------------------------------------

    if (!process.env.DISCORD_TOKEN) {
        console.error("❌ ERRO FATAL: Variável DISCORD_TOKEN não encontrada. Crie um arquivo .env.");
        return; // Retorna em vez de process.exit, deixando o main() tratar
    }

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    
    // O prefixo agora vem da configuração
    const PREFIX = config.prefix || "!"; 

    const client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
      ]
    });

    // Auto-salvar usuários a cada 30 segundos
    const SAVE_INTERVAL_SECONDS = 30;
    setInterval(flushCache, SAVE_INTERVAL_SECONDS * 1000); 
    console.log(`⏱️ Auto-salvamento de usuários configurado a cada ${SAVE_INTERVAL_SECONDS} segundos.`);


    // ----------------------------------------------------
    // 🔹 CARREGAMENTO DE COMANDOS
    // ----------------------------------------------------

    client.commands = new Collection();
    // Ajuste o caminho dos comandos relativo a 'bot/index.js'
    const commandsPath = path.join(__dirname, ".", "commands"); 
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith(".js"));

    for (const file of commandFiles) {
      try {
        // Ajuste o caminho de import dinâmico
        const { default: command } = await import(`../commands/${file}`); 
        if (command?.name && typeof command?.execute === "function") {
          client.commands.set(command.name, command);
          console.log(`✅ Comando carregado: \x1b[32m${command.name}\x1b[0m`);
        } else {
          console.warn(`⚠️ Ignorado (sem export válido): \x1b[33m${file}\x1b[0m`);
        }
      } catch (err) {
        console.error(`❌ Erro ao carregar comando ${file}:`, err);
      }
    }


    // ----------------------------------------------------
    // 🔹 EVENTOS (READY e messageCreate)
    // ----------------------------------------------------

    client.once("ready", () => {
      console.log(`\n🤖 ${config.gameName} Bot online como \x1b[36m${client.user.tag}\x1b[0m`); 
      console.log(`Prefixo de comando: \x1b[35m${PREFIX}\x1b[0m\n`);
    });


    client.on("messageCreate", async (message) => {
      // 1. Verificações iniciais
      if (message.author.bot || !message.content.startsWith(PREFIX)) return;
      
      const args = message.content.slice(PREFIX.length).trim().split(/ +/);
      const commandName = args.shift().toLowerCase();
      const command = client.commands.get(commandName);
      
      if (!command) return;
      
      try {
        // 2. MIDDLEWARE: Carrega o objeto user
        const user = loadUser(message.author.id);
        
        // 3. EXECUÇÃO
        await command.execute(message, args, user);
        
        // 4. PÓS-EXECUÇÃO: Sinaliza que o objeto no cache está modificado
        markUserDirty(message.author.id); 
        
      } catch (err) {
        console.error(`\n❌ ERRO DE EXECUÇÃO em ${commandName} (${message.author.tag}):`, err);
        message.reply("⚠️ Ocorreu um erro ao executar esse comando. O administrador foi notificado.");
      }
    });

    // ----------------------------------------------------
    // 🔹 LOGIN
    // ----------------------------------------------------

    await client.login(process.env.DISCORD_TOKEN);
}
