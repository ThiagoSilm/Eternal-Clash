// search.js
// Comando para buscar informações sobre Cartas, Itens, Fases, etc.
// -----------------------------------------------------------------
import { EmbedBuilder } from "discord.js";
import { searchInventory, viewCardDetails } from "../../src/systems/inventorySystem.js";
import { getCardTemplate, formatCardInfo } from "../../src/systems/cardSystem.js";
import { getPhaseInfo } from "../../src/systems/mapSystem.js"; 
import { getInventoryMeta } from "../../src/systems/inventorySystem.js"; // Para tags/meta

// Definição de cores para a busca
const SEARCH_COLOR = "#E67E22"; // Laranja
const CARD_COLOR = "#9B59B6";  // Roxo
const PHASE_COLOR = "#1ABC9C"; // Teal

export default {
  name: "search",
  description: "Busca informações sobre Cartas (template ou inventário), Itens ou Fases do Mapa.",
  usage: "<card <Nome/ID> | item <Nome> | phase <ID da Fase> | mycard <ID Único/Index> | tag <Tag>",
  aliases: ["procurar", "s"],
  
  async execute(message, args, user) { 
    const type = args[0]?.toLowerCase();
    const query = args.slice(1).join(" ");
    const username = message.author.username;
    
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

    if (!type || !query) {
        return message.reply(`❌ Uso inválido. Especifique o tipo de busca e o termo. Ex: \`!search card Mago\` ou \`!search phase 1-5\``);
    }

    // --- 1. SEARCH CARD TEMPLATE (Dados estáticos da carta) ---
    if (type === 'card' || type === 'template') {
        const cardTemplate = getCardTemplate(query);
        
        if (!cardTemplate) {
            return message.reply(`❌ Nenhuma carta template encontrada para "${query}".`);
        }
        
        // Simula o objeto de carta para usar a função formatCardInfo
        const dummyCard = { id: cardTemplate.id, level: 1, xp: 0, uniqueId: 'template' };
        const infoText = formatCardInfo(dummyCard, cardTemplate);
        
        return replyInEmbed(
            `📚 Info da Carta: ${cardTemplate.name}`, 
            infoText, 
            CARD_COLOR
        );
    }
    
    // --- 2. SEARCH MY CARD (Detalhes do inventário pela Unique ID ou Index) ---
    if (type === 'mycard' || type === 'inv') {
        const identifier = isNaN(Number(query)) ? query : Number(query);
        
        try {
            const infoText = viewCardDetails(user, identifier);
            
            if (infoText === "Card not found.") {
                 // Tenta pesquisar pelo nome no inventário se a query não for numérica
                if (typeof identifier !== 'number') {
                    const foundCards = searchInventory(user, query);
                    if (foundCards.length > 0) {
                        const list = foundCards.slice(0, 5).map((c, i) => 
                            `${i + 1}. ${getCardTemplate(c.id)?.name} (Lv.${c.level}, ID: \`${c.uniqueId}\`)`
                        ).join('\n');
                        return replyInEmbed(
                            `🔎 Cartas Encontradas em seu Inventário (${foundCards.length})`,
                            `Use \`!search mycard <ID Único>\` ou \`!inv view <Index>\` para ver os detalhes:\n\n${list}`,
                            SEARCH_COLOR
                        );
                    }
                }
                return message.reply(`❌ Carta \`${query}\` não encontrada em seu inventário por ID Único ou Índice.`);
            }
            
            return replyInEmbed(
                `🔎 Detalhes da sua Carta de ${username}`,
                infoText,
                CARD_COLOR
            );
        } catch (err) {
            console.error(`Erro em !search mycard:`, err);
            return message.reply(`❌ Erro ao buscar sua carta: ${err.message}`);
        }
    }

    // --- 3. SEARCH PHASE (Fase do Mapa) ---
    if (type === 'phase' || type === 'fase') {
        const phaseInfo = getPhaseInfo(query);
        
        if (!phaseInfo) {
            return message.reply(`❌ Fase de Mapa \`${query}\` inexistente. Ex: 1-1, 2-5.`);
        }
        
        const rewards = phaseInfo.reward 
            ? Object.entries(phaseInfo.reward).map(([key, val]) => `${key}: ${val}`).join(', ')
            : 'Nenhuma recompensa primária.';
        
        const enemies = phaseInfo.enemies?.map((e, i) => 
            `**Inimigo ${i + 1}:** ${e.base?.guardian || 'Desconhecido'}`
        ).join('\n') || 'Nenhum inimigo.';

        return replyInEmbed(
            `🗺️ Detalhes da Fase: ${query}`,
            `**Recompensas Estáticas:** ${rewards}`,
            PHASE_COLOR,
            [{ name: "Inimigos Encontrados", value: enemies, inline: false }]
        );
    }
    
    // --- 4. SEARCH TAG (Cartas por Tag em seu Inventário) ---
    if (type === 'tag') {
        const meta = getInventoryMeta(user);
        const results = [];
        
        // Itera sobre as tags e procura a query
        for (const [uniqueId, tags] of Object.entries(meta.tags || {})) {
            if (tags.has(query)) {
                results.push(uniqueId);
            }
        }

        if (results.length === 0) {
            return message.reply(`❌ Nenhuma carta marcada com a tag \`${query}\`.`);
        }
        
        const cardNames = results.slice(0, 10).map(id => {
            // Tenta obter o nome da carta, se possível
            const card = user.cards.find(c => c.uniqueId === id);
            const template = card ? getCardTemplate(card.id) : null;
            return `\`${id}\` - ${template?.name || "Carta Desconhecida"}`;
        }).join('\n');

        return replyInEmbed(
            `🏷️ Cartas com a Tag: #${query} (${results.length})`,
            `**IDs Únicos em seu inventário:**\n${cardNames}\n\nUse \`!inv view <ID Único>\` para detalhes.`,
            SEARCH_COLOR
        );
    }

    // --- Padrão / Ajuda ---
    message.reply(`❌ Tipo de busca inválido. Tipos disponíveis: \`card\`, \`mycard\`, \`phase\`, \`tag\`.`);
  }
};
