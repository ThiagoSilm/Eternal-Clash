// src/commands/maze.js

import {
    rollMaze,
    useGoldDice,
    resetMaze,
    getCurrentMapId,
    getMazeMapInfo
} from "../../src/systems/mazeSystem.js";
import { EmbedBuilder } from "discord.js";

export default {
    name: "maze",
    description: "Jogue no Maze, role o dado, use Gold Dice ou resete o mapa.",
    usage: "[roll | gold <mapId?> <targetHouse> | reset]",
    
    async execute(message, args, user) {
        const sub = (args[0] || "roll").toLowerCase();
        
        const toInt = (v) => {
            const n = parseInt(v);
            return Number.isInteger(n) && n > 0 ? n : null;
        };
        
        const currentMapId = getCurrentMapId(user) || 1;
        
        const renderMiniMap = (mapInfo, targetHouse = null) => {
            const housesPerLine = 10;
            let mapStr = "";
            for (let i = 1; i <= mapInfo.totalHouses; i++) {
                if (i === mapInfo.currentHouse) mapStr += "🧍";
                else if (i === targetHouse) mapStr += "🎯";
                else if (mapInfo.visitedHouses.includes(i)) mapStr += "✅";
                else if (mapInfo.prizeHouses[i]) {
                    switch (mapInfo.prizeHouses[i]) {
                        case "coin":
                            mapStr += "💰";
                            break;
                        case "trophy":
                            mapStr += "🏆";
                            break;
                        case "rare":
                            mapStr += "✨";
                            break;
                        default:
                            mapStr += "💎";
                    }
                } else mapStr += "⬜";
                
                if (i % housesPerLine === 0) mapStr += "\n";
            }
            return mapStr;
        };
        
        const renderPrizeMessage = (prize) => {
            if (!prize) return null;
            switch (prize.type) {
                case "coin":
                    return `🎉 Você encontrou 💰 **${prize.amount} moedas**!`;
                case "trophy":
                    return `🏆 Parabéns! Você ganhou um troféu!`;
                case "rare":
                    return `✨ Incrível! Você conseguiu um item raro!`;
                default:
                    return `💎 Você encontrou um prêmio especial!`;
            }
        };
        
        const celebratePrize = async (prizeType) => {
            if (!["trophy", "rare"].includes(prizeType)) return;
            const frames = ["🎉✨🏆💎", "✨🎉🏆💎", "🏆✨🎉💎", "🎉🏆✨💎"];
            for (let frame of frames) {
                await message.channel.send(frame);
                await new Promise(res => setTimeout(res, 500));
            }
        };
        
        try {
            
            const handleRollOrGold = async (type) => {
                const mapIdArg = toInt(args[1]) || currentMapId;
                const targetHouse = type === "gold" ? toInt(args[2]) : null;
                
                if (type === "gold" && !targetHouse)
                    return message.reply("❌ Informe a **casa alvo**: `!maze gold <mapId?> <casa>`");
                
                const mapInfo = getMazeMapInfo(user, mapIdArg);
                
                if (targetHouse && targetHouse > mapInfo.totalHouses)
                    return message.reply(`❌ Essa casa não existe neste mapa. O máximo é ${mapInfo.totalHouses}.`);
                
                const actionResult = type === "roll" ?
                    rollMaze(user, mapIdArg) :
                    useGoldDice(user, mapIdArg, targetHouse);
                
                const prizeMsg = renderPrizeMessage(actionResult.prize);
                
                const embed = new EmbedBuilder()
                    .setTitle(`🎲 Maze - ${type === "roll" ? "Rolagem" : "Gold Dice"}`)
                    .addFields({ name: "Mapa", value: `#${mapIdArg}`, inline: true }, { name: "Casa Atual", value: `${mapInfo.currentHouse}`, inline: true }, { name: "Progresso", value: `${mapInfo.visitedHouses.length}/${mapInfo.totalHouses}` }, { name: "Resultado", value: actionResult.message }, );
                
                if (prizeMsg)
                    embed.addFields({ name: "Prêmio Recebido", value: prizeMsg });
                
                embed.addFields({ name: "Tabuleiro", value: renderMiniMap(mapInfo, targetHouse) });
                embed.setColor(type === "roll" ? "Random" : "Gold");
                
                await message.reply({ embeds: [embed] });
                
                // 🎆 Efeito de celebração
                if (actionResult.prize) await celebratePrize(actionResult.prize.type);
            };
            
            if (sub === "roll") return handleRollOrGold("roll");
            if (sub === "gold") return handleRollOrGold("gold");
            
            if (sub === "reset") {
                const mapIdArg = toInt(args[1]) || currentMapId;
                const mapInfo = getMazeMapInfo(user, mapIdArg);
                const result = resetMaze(user, mapIdArg);
                
                const embed = new EmbedBuilder()
                    .setTitle(`🔄 Maze - Reset`)
                    .addFields({ name: "Mapa", value: `#${mapIdArg}`, inline: true }, { name: "Casa Antes do Reset", value: `${mapInfo.currentHouse}` }, { name: "Progresso", value: `${mapInfo.visitedHouses.length}/${mapInfo.totalHouses}` }, { name: "Resultado", value: result }, { name: "Tabuleiro", value: renderMiniMap(mapInfo) })
                    .setColor("Red");
                
                return message.reply({ embeds: [embed] });
            }
            
            return message.reply(
                "❌ Subcomando inválido.\nUse:\n" +
                "`!maze roll [mapId]`\n" +
                "`!maze gold <mapId?> <casa>`\n" +
                "`!maze reset [mapId]`"
            );
            
        } catch (err) {
            console.error("❌ Erro em !maze:", err);
            return message.reply("⚠️ Ocorreu um erro ao processar o Maze.");
        }
    }
};