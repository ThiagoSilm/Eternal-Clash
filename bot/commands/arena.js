// arena.js
// Comando de Arena PvP para o Discord
// -----------------------------------------------------------------
import { EmbedBuilder } from "discord.js";
import {
  arenaStatus,
  arenaChallenge,
  arenaReward,
  arenaLeaderboard // Assumindo que você tem uma forma de buscar todos os usuários (users)
} from "../src/systems/arenaSystem.js"; // Importa as funções do seu sistema

// Variáveis globais para a busca de usuários (ajustar conforme seu bot)
// OBS: Você precisará injetar ou importar uma função que retorne a lista de todos os usuários
const USERS_CACHE = []; // Placeholder. Substitua pela sua função de cache ou BD. 

export default {
  name: "arena",
  description: "Gerencia e inicia batalhas na Arena PvP.",
  usage: "<status | challenge <index> | reward | top>",
  
  async execute(message, args, user, users) { // users injetado para o leaderboard
    const subcommand = args[0]?.toLowerCase();
    const userId = message.author.id;
    const username = message.author.username;

    if (!subcommand || subcommand === 'status') {
      // ------------------------------------
      // !arena status
      // ------------------------------------
      try {
        const statusText = arenaStatus(user);
        
        const embed = new EmbedBuilder()
          .setTitle(`⚔️ Arena PvP - Status de ${username}`)
          .setDescription(statusText)
          .setColor("#FFD700") // Ouro
          .setFooter({ text: "Use !arena challenge <número> para lutar!" });

        await message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });

      } catch (err) {
        console.error(`Erro em !arena status para ${userId}:`, err);
        await message.reply(`❌ Erro ao obter status da arena: ${err.message}`);
      }
      return;
    }
    
    // ------------------------------------
    // !arena challenge <index>
    // ------------------------------------
    if (subcommand === 'challenge') {
      const index = parseInt(args[1]);
      if (isNaN(index) || index < 1) {
        return message.reply("❌ Por favor, especifique o número do oponente (ex: `!arena challenge 3`).");
      }

      try {
        const resultMsg = await arenaChallenge(user, index);
        
        const embed = new EmbedBuilder()
          .setTitle(`🔥 Batalha na Arena #${index}`)
          .setDescription(resultMsg)
          .setColor(resultMsg.includes("🏆 Vitória") ? "#2ECC71" : "#E74C3C"); // Verde p/ Vitória, Vermelho p/ Derrota

        await message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });

      } catch (err) {
        console.error(`Erro em !arena challenge para ${userId}:`, err);
        await message.reply(`❌ Desafio falhou: ${err.message}`);
      }
      return;
    }

    // ------------------------------------
    // !arena reward
    // ------------------------------------
    if (subcommand === 'reward') {
      try {
        const resultMsg = arenaReward(user);
        
        const embed = new EmbedBuilder()
          .setTitle(`🎁 Baú de Pontos da Arena`)
          .setDescription(resultMsg)
          .setColor(resultMsg.includes("Precisa") ? "#F39C12" : "#3498DB"); // Laranja p/ Aviso, Azul p/ Recompensa

        await message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });

      } catch (err) {
        console.error(`Erro em !arena reward para ${userId}:`, err);
        await message.reply(`❌ Erro ao resgatar recompensa: ${err.message}`);
      }
      return;
    }
    
    // ------------------------------------
    // !arena top
    // ------------------------------------
    if (subcommand === 'top') {
      // Usar a lista injetada (users) ou o placeholder USERS_CACHE
      const allUsers = users || USERS_CACHE; 
      
      try {
        const topList = arenaLeaderboard(allUsers);
        
        const embed = new EmbedBuilder()
          .setTitle(`🏅 Top 10 Ranqueado da Arena`)
          .setDescription(topList)
          .setColor("#9B59B6") // Roxo
          .setFooter({ text: "O ranking é baseado no ELO." });

        await message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });

      } catch (err) {
        console.error(`Erro em !arena top para ${userId}:`, err);
        await message.reply(`❌ Erro ao gerar placar: ${err.message}`);
      }
      return;
    }

    // ------------------------------------
    // Comando inválido
    // ------------------------------------
    message.reply(`Comando inválido. Use: \`!arena ${this.usage}\``);
  }
};
