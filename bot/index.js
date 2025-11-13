// index.js

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Client, GatewayIntentBits, Collection } from "discord.js";
import dotenv from "dotenv";

// 🎯 CORREÇÕES DE IMPORTAÇÃO:
// 1. userSystem: Importa 'loadUser' (conforme seu userSystem.js)
import { loadUser } from "../src/systems/userSystem.js"; 
// 2. userCacheSystem: Importa 'flushCache' e remove 'touchUser'
import { markUserDirty, flushCache } from "../src/systems/userCacheSystem.js";


// Carrega variáveis de ambiente do .env
dotenv.config();

// ----------------------------------------------------
// 🔹 CONFIGURAÇÕES E INICIALIZAÇÃO
// ----------------------------------------------------

if (!process.env.DISCORD_TOKEN) {
    console.error("❌ ERRO FATAL: Variável DISCORD_TOKEN não encontrada. Crie um arquivo .env.");
    process.exit(1);
}

// Configuração de Caminhos (inalterada)
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

// Auto-salvar usuários a cada 30 segundos
const SAVE_INTERVAL_SECONDS = 30;
// 🎯 CORREÇÃO: Chama 'flushCache' (que é a sua função de autosave)
setInterval(flushCache, SAVE_INTERVAL_SECONDS * 1000); 
console.log(`⏱️ Auto-salvamento de usuários configurado a cada ${SAVE_INTERVAL_SECONDS} segundos.`);

// ... (Carregamento de Comandos inalterado) ...

// ----------------------------------------------------
// 🔹 EVENTO messageCreate (Onde o middleware acontece)
// ----------------------------------------------------

// 🎯 REMOVIDO: A função loadUserMiddleware foi removida.
// O 'userSystem.loadUser' já faz tudo que o middleware precisa para carregar.

client.on("messageCreate", async (message) => {
  // 1. Verificações iniciais
  if (message.author.bot || !message.content.startsWith(PREFIX)) return;
  
  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();
  const command = client.commands.get(commandName);
  
  if (!command) return message.reply("❌ Comando desconhecido.");
  
  try {
    // 2. MIDDLEWARE: Carrega o objeto user
    // 🎯 CORREÇÃO: Chama diretamente o 'loadUser' do sistema de usuários
    const user = loadUser(message.author.id); // Não precisa ser await, se o loadUser for síncrono
    
    // 3. EXECUÇÃO
    await command.execute(message, args, user);
    
    // 4. PÓS-EXECUÇÃO: Sinaliza que o objeto no cache está modificado e precisa ser salvo
    // 🎯 CORREÇÃO: markUserDirty agora recebe APENAS o userId, conforme sua definição
    markUserDirty(message.author.id); 
    
  } catch (err) {
    console.error(`\n❌ ERRO DE EXECUÇÃO em ${commandName} (${message.author.tag}):`, err);
    message.reply("⚠️ Ocorreu um erro ao executar esse comando. O administrador foi notificado.");
  }
});

// ----------------------------------------------------
// 🔹 LOGIN
// ----------------------------------------------------

client.login(process.env.DISCORD_TOKEN);
