// clan.js
// Comando para gerenciar Clãs (Guildas)
// -----------------------------------------------------------------
import { EmbedBuilder } from "discord.js";
import { 
  createClan, 
  joinClan, 
  leaveClan, 
  donateToClan, 
  getClanInfo, 
  getClanRankings, 
  registerUser // Usado para garantir que o usuário existe no sistema
} from "../../src/systems/clanSystem.js"; 

export default {
  name: "clan",
  description: "Gerencia a criação, entrada, saída e doações de Clãs.",
  usage: "<create <Nome> | join <ID/Nome> | leave | info [ID/Nome] | donate <Ouro> | top>",
  
  async execute(message, args, user, users) { 
    // Garante que o objeto 'user' tenha pelo menos os campos básicos esperados pelo clanSystem.js
    // Nota: O registerUser lida com leitura/escrita de arquivo, o que pode ser lento.
    // Em bots reais, você faria isso no middleware/cache. Aqui, chamamos por segurança.
    await registerUser(user.id, user.username || message.author.username, user.gold || 0);

    const subcommand = args[0]?.toLowerCase();
    const userId = message.author.id;
    const username = message.author.username;
    
    // --- Funções de Ajuda e Estado ---

    async function replyInEmbed(title, description, color = "#3498DB") {
        const embed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(description)
            .setColor(color);
        await message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
    }

    // --- Tratamento de Subcomandos ---

    // 1. CREATE
    if (subcommand === 'create') {
        const name = args.slice(1).join(" ");
        if (!name) return message.reply("❌ Forneça um nome para o novo clã.");
        if (user.clanId) return message.reply("❌ Você já está em um clã. Saia dele primeiro.");
        
        try {
            const result = await createClan(user, name);
            if (result.startsWith("❌")) return message.reply(result);
            return replyInEmbed("🏰 Criação de Clã", result, "#2ECC71"); // Sucesso
        } catch (err) {
            console.error(`Erro em !clan create para ${userId}:`, err);
            return message.reply("❌ Erro fatal ao tentar criar o clã.");
        }
    }

    // 2. JOIN
    if (subcommand === 'join') {
        const nameOrId = args.slice(1).join(" ");
        if (!nameOrId) return message.reply("❌ Forneça o nome ou ID do clã para entrar.");
        if (user.clanId) return message.reply("❌ Você já está em um clã.");
        
        try {
            const result = await joinClan(user, nameOrId);
            if (result.startsWith("❌")) return message.reply(result);
            return replyInEmbed("➡️ Entrar em Clã", result, "#3498DB");
        } catch (err) {
            console.error(`Erro em !clan join para ${userId}:`, err);
            return message.reply("❌ Erro fatal ao tentar entrar no clã.");
        }
    }

    // 3. LEAVE
    if (subcommand === 'leave') {
        if (!user.clanId) return message.reply("❌ Você não está em nenhum clã.");
        
        try {
            const result = await leaveClan(user);
            return replyInEmbed("👋 Sair do Clã", result, "#F39C12"); // Aviso/Remoção
        } catch (err) {
            console.error(`Erro em !clan leave para ${userId}:`, err);
            return message.reply("❌ Erro fatal ao tentar sair do clã.");
        }
    }
    
    // 4. INFO
    if (subcommand === 'info') {
        const nameOrId = args.slice(1).join(" ") || user.clanId;
        
        if (!nameOrId) return message.reply("❌ Forneça o nome/ID do clã ou entre em um para ver as informações.");
        
        try {
            const result = await getClanInfo(nameOrId);
            if (result.startsWith("❌")) return message.reply(result);
            
            // O resultado é uma string formatada, use-a diretamente no Embed.
            return replyInEmbed(`ℹ️ Detalhes do Clã`, result, "#9B59B6");
        } catch (err) {
            console.error(`Erro em !clan info para ${userId}:`, err);
            return message.reply("❌ Erro fatal ao buscar informações do clã.");
        }
    }

    // 5. DONATE
    if (subcommand === 'donate') {
        const amount = parseInt(args[1]);
        if (isNaN(amount) || amount <= 0) return message.reply("❌ Forneça um valor de ouro válido para doar.");
        if (!user.clanId) return message.reply("❌ Você precisa estar em um clã para doar.");
        
        try {
            const result = await donateToClan(user, amount);
            if (result.startsWith("❌")) return message.reply(result);
            return replyInEmbed("💰 Doação para o Clã", result, "#1ABC9C"); // Teal
        } catch (err) {
            console.error(`Erro em !clan donate para ${userId}:`, err);
            return message.reply("❌ Erro fatal ao tentar doar ouro.");
        }
    }
    
    // 6. TOP
    if (subcommand === 'top' || subcommand === 'rank') {
        try {
            const rankings = await getClanRankings();
            
            const list = rankings.map((clan, i) => 
                `${i + 1}. 🏰 **${clan.name}** (Lv ${clan.level}, XP: ${clan.xp})`
            ).join("\n") || "Nenhum clã classificado ainda.";

            return replyInEmbed("👑 Ranking Global de Clãs (Top 10)", list, "#FFD700"); // Ouro
        } catch (err) {
            console.error(`Erro em !clan top para ${userId}:`, err);
            return message.reply("❌ Erro fatal ao buscar o ranking de clãs.");
        }
    }

    // --- Padrão / Ajuda ---
    message.reply(`Comando inválido. Use: \`!clan ${this.usage}\``);
  }
};
