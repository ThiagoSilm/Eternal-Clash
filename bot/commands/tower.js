// tower.js
// Comando para interagir com o sistema de Torre/Dungeon
// -----------------------------------------------------------------
import { EmbedBuilder } from "discord.js";
import { 
  getTowerStatus,
  climbFloor,
  resetDaily,
  initTowerShop,
  buyTowerShopItem,
  getFloorEnemy,
  MAX_FLOOR
} from "../../src/systems/towerSystem.js"; 
import { getBalance } from "../../src/systems/economySystem.js"; // Para ver o saldo de tokens

// --- Constantes de Emojis e Cores ---
const TOWER_EMOJI = "🗼";
const CLIMB_EMOJI = "🪜";
const SHOP_EMOJI = "💎";
const STATUS_COLOR = "#8E44AD"; // Púrpura

export default {
  name: "tower",
  description: "Gerencia a escalada da Torre, batalhas de andar e a loja de Shards.",
  usage: "[status | climb | shop | buy <index>]",
  aliases: ["torre"],
  
  async execute(message, args, user) { 
    const subcommand = args[0]?.toLowerCase() || 'status';
    const username = message.author.username;
    
    // Tenta fazer o reset diário no início de qualquer comando da torre
    const dailyResetMsg = resetDaily(user);
    if (dailyResetMsg) {
        message.channel.send(`*${dailyResetMsg}*`);
    }

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

    // --- 1. STATUS / VISUALIZAR (Padrão) ---
    if (subcommand === 'status' || subcommand === 'view') {
        const status = getTowerStatus(user);
        
        return replyInEmbed(
            `${TOWER_EMOJI} Status da Torre de ${username}`,
            status,
            STATUS_COLOR
        );
    }
    
    // --- 2. CLIMB / ESCALAR ANDAR ---
    if (subcommand === 'climb' || subcommand === 'up') {
        try {
            // Puxa o estado ANTES da escalada
            const currentFloor = user.tower?.floor || 1;
            const enemy = getFloorEnemy(currentFloor);
            
            await message.reply(`${CLIMB_EMOJI} Subindo para o Andar **${currentFloor}**... Batalha contra **${enemy.name}** iniciada!`);

            const result = climbFloor(user);
            
            if (!result.success && result.msg) {
                return message.channel.send(`⚠️ ${result.msg}`);
            }

            const isVictory = result.success;
            const nextFloor = user.tower.floor;

            const description = [
                result.event ? `✨ Evento: **${result.event}**` : "",
                `\n⚔️ **Resultado:** ${isVictory ? 'VITÓRIA' : 'DERROTA'}`,
                isVictory ? `**Andar Alcançado:** ${nextFloor - 1} -> **${nextFloor}**` : `Andar atual: **${nextFloor}**`,
                isVictory ? `\n${result.rewardMsg}` : result.rewardMsg,
                `Tentativas Restantes: **${user.tower.attempts}**`
            ].filter(Boolean).join('\n'); // Remove linhas vazias

            return replyInEmbed(
                `${CLIMB_EMOJI} Batalha da Torre`,
                description,
                isVictory ? "#2ECC71" : "#E74C3C"
            );

        } catch (err) {
            console.error(`Erro em !tower climb:`, err);
            return message.reply(`❌ Erro ao escalar a torre: ${err.message}`);
        }
    }
    
    // --- 3. SHOP / LOJA DA TORRE ---
    if (subcommand === 'shop') {
        initTowerShop(user); // Garante que a loja está resetada para o dia
        const shopItems = user.towerShop?.items || [];
        const towerTokens = getBalance(user, 'tokens'); // Assumindo que 'tokens' é o ID da moeda TT
        
        if (shopItems.length === 0) {
            return message.reply("❌ A loja da torre está vazia ou não foi inicializada corretamente.");
        }

        const itemsList = shopItems.map((item, index) => {
            return `**[${index + 1}]** ${item.id} (${item.rarity}★) - Custo: **${item.cost} TT**`;
        }).join('\n');

        const embed = new EmbedBuilder()
            .setTitle(`${SHOP_EMOJI} Loja da Torre (Shards)`)
            .setDescription("Use Tower Tokens (TT) para comprar Shards de Guardiões.")
            .addFields([
                { name: `Seus Tokens`, value: `**${towerTokens} TT**`, inline: true },
                { name: `Itens (Reset Diário)`, value: itemsList, inline: false }
            ])
            .setColor(STATUS_COLOR)
            .setFooter({ text: "Use !tower buy <número> para comprar." });
            
        return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
    }

    // --- 4. BUY / COMPRAR NA LOJA DA TORRE ---
    if (subcommand === 'buy') {
        const itemIndex = parseInt(args[1]);
        
        if (isNaN(itemIndex) || itemIndex < 1) {
            return message.reply("❌ Forneça o **número do item** que deseja comprar (ex: `!tower buy 1`).");
        }

        try {
            const result = buyTowerShopItem(user, itemIndex);
            
            if (result.startsWith("❌")) {
                return message.reply(result);
            }
            
            return replyInEmbed(
                `${SHOP_EMOJI} Compra Concluída`,
                `${result}\nSaldo TT: **${user.tower.tokens}**`,
                "#FFD700" // Ouro
            );
        } catch (err) {
            console.error(`Erro em !tower buy:`, err);
            return message.reply(`❌ Ocorreu um erro ao comprar o item: ${err.message}`);
        }
    }

    // --- Ajuda ---
    return message.reply(`Comando inválido. Uso correto: \`!tower ${this.usage}\`.`);
  }
};
