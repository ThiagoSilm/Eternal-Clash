// maze.js
// Comando para interagir com o sistema de Labirinto/Dungeon Crawl
// -----------------------------------------------------------------
import { EmbedBuilder } from "discord.js";
import { 
  rollMaze,
  resetMaze,
  useGoldDice,
  getMazeMapInfo,
  getCurrentMapId,
  MAZE_CONFIG
} from "../../src/systems/mazeSystem.js"; 
import { getBalance } from "../../src/systems/economySystem.js";

// --- Constantes de Emojis e Cores ---
const ROLL_EMOJI = "🎲";
const MAZE_EMOJI = "🏰";
const GOLD_DICE_EMOJI = "✨";
const RESET_EMOJI = "🔄";
const DEFAULT_MAP_ID = getCurrentMapId(); 

// Cores para os resultados
const RESULT_COLORS = {
    victory: "#2ECC71", // Verde
    defeat: "#E74C3C",  // Vermelho
    prize: "#F1C40F",   // Amarelo
    info: "#3498DB"     // Azul
};

export default {
  name: "maze",
  description: "Gira o dado para avançar no Labirinto e ganhar recompensas.",
  usage: "[roll | reset | golddice <CasaAlvo>]",
  aliases: ["labirinto"],
  
  async execute(message, args, user) {
    const subcommand = args[0]?.toLowerCase() || 'roll';
    const username = message.author.username;
    
    // Configurações do Mapa Atual
    const mapId = DEFAULT_MAP_ID;
    const mapInfo = MAZE_CONFIG.maps[mapId];

    // Checa o Estado do Labirinto
    const state = getMazeMapInfo(user, mapId);

    // --- Helper para enviar Embeds ---
    async function replyInEmbed(title, description, color, fields = []) {
        const embed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(description)
            .setColor(color)
            .addFields(fields)
            .setTimestamp();
        await message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
    }

    // --- Tratamento de Subcomandos ---

    // 1. ROLL / ROLAR DADO (Padrão)
    if (subcommand === 'roll' || subcommand === 'r') {
      try {
        const initialState = getMazeMapInfo(user, mapId);
        
        // Simulação de Roll
        await message.reply(`${ROLL_EMOJI} ${username} rola o dado e entra no labirinto...`);

        const result = await rollMaze(user, mapId);
        const finalState = getMazeMapInfo(user, mapId);

        let color = RESULT_COLORS.prize;
        if (result.message.includes("Vitória")) color = RESULT_COLORS.victory;
        if (result.message.includes("Derrota")) color = RESULT_COLORS.defeat;

        const embed = new EmbedBuilder()
          .setTitle(`${ROLL_EMOJI} Aventura no Labirinto de ${mapId}`)
          .setDescription(`**${result.message}**`)
          .addFields([
            { name: "🏠 Casa Atual", value: `${initialState.currentHouse} → **${finalState.currentHouse}** (Máx: ${mapInfo.maxHouses})`, inline: true },
            { name: "⚡ Custo", value: `${MAZE_CONFIG.energyCost} Energia`, inline: true },
            { name: "💰 Saldo", value: `Ouro: ${getBalance(user, 'gold')} | Gemas: ${getBalance(user, 'gems')}`, inline: true }
          ])
          .setColor(color)
          .setFooter({ text: `Usos restantes hoje: ${2 - finalState.usedToday}` })
          .setTimestamp();
          
        return message.channel.send({ embeds: [embed] });

      } catch (err) {
        // Trata erros específicos do sistema (energia, limite)
        if (err.message.includes("Energia insuficiente") || err.message.includes("Limite diário")) {
            return message.reply(`⚠️ ${err.message}`);
        }
        console.error(`Erro em !maze roll:`, err);
        return message.reply("❌ Ocorreu um erro ao rolar o dado.");
      }
    }
    
    // 2. RESET / REINICIAR LABIRINTO (Com Gemas ou Uso Diário)
    if (subcommand === 'reset') {
        try {
            const result = resetMaze(user, mapId); // O sistema gerencia o limite diário de reset
            return replyInEmbed(
                `${RESET_EMOJI} Labirinto Reiniciado`,
                result,
                RESULT_COLORS.info
            );
        } catch (err) {
            return message.reply(`❌ Falha ao Resetar: ${err.message}`);
        }
    }
    
    // 3. GOLDDICE / DADO DE OURO (Pula casas com Gemas)
    if (subcommand === 'golddice') {
        const targetHouse = parseInt(args[1]);
        if (isNaN(targetHouse)) return message.reply("❌ Forneça a casa alvo para onde deseja pular (ex: `!maze golddice 30`).");
        
        try {
            const result = useGoldDice(user, mapId, targetHouse);
            const finalState = getMazeMapInfo(user, mapId);

            return replyInEmbed(
                `${GOLD_DICE_EMOJI} Gold Dice Utilizado!`,
                `${result.message}\n\n**Custo:** ${MAZE_CONFIG.goldDiceGemCost} Gemas\n**Nova Posição:** ${finalState.currentHouse}/${mapInfo.maxHouses}`,
                RESULT_COLORS.prize,
                [{ name: "Saldo de Gemas", value: `${getBalance(user, 'gems')} Gemas`, inline: true }]
            );
        } catch (err) {
            return message.reply(`❌ Falha no Gold Dice: ${err.message}`);
        }
    }

    // --- Padrão / Ajuda ---
    const info = getMazeMapInfo(user, mapId);
    const usesLeft = 2 - info.usedToday;

    const helpEmbed = new EmbedBuilder()
        .setTitle(`${MAZE_EMOJI} Labirinto da Perdição - ${mapId}`)
        .setDescription("Seu objetivo é alcançar a **Casa do Chefe** no final!")
        .addFields([
            { name: "Posição Atual", value: `🏠 Casa **${info.currentHouse}** / ${info.totalHouses}`, inline: true },
            { name: "Usos Diários", value: `${usesLeft} de 2 restantes`, inline: true },
            { name: "Custo por Rolo", value: `⚡ ${MAZE_CONFIG.energyCost} Energia`, inline: true },
            { name: `Comandos`, value: `\`!maze roll\` - Rola o dado e avança.\n\`!maze reset\` - Reinicia o labirinto (limite 1/dia).\n\`!maze golddice <Casa>\` - Pula para uma casa pagando ${MAZE_CONFIG.goldDiceGemCost} Gemas.`, inline: false }
        ])
        .setColor(RESULT_COLORS.info);
        
    return message.reply({ embeds: [helpEmbed], allowedMentions: { repliedUser: false } });
  }
};
