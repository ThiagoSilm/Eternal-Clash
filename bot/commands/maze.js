// src/commands/maze.js
import {
    rollMaze,
    useGoldDice,
    resetMaze,
    getMazeState,
    getCurrentMapId,
    getMazeMapInfo,
    startMaze,
    mazeConfig
} from "../../src/systems/mazeSystem.js";
import { EmbedBuilder } from "discord.js";

export default {
    name: "maze",
    description: "Jogue no Maze: role o dado, use Gold Dice, resete o mapa ou inicie o Maze.",
    usage: "[start | roll | gold <mapId?> <targetHouse> | reset]",

    async execute(message, args, user) {
        const sub = (args[0] || "roll").toLowerCase();
        const toInt = (v) => { const n = parseInt(v); return Number.isInteger(n) && n > 0 ? n : null; };

        // 🔹 Inicializa Maze se o usuário ainda não tiver mapa
        let currentMapId = getCurrentMapId(user);
        if (!currentMapId && sub !== "start") {
            startMaze(user);
            currentMapId = "map1";
        }

        const renderMiniMap = (mapInfo) => {
            if (!mapInfo) return "❌ Mapa não disponível.";
            const housesPerLine = 10;
            let str = "";
            for (let i = 1; i <= (mapInfo.totalHouses ?? 0); i++) {
                if (i === (mapInfo.currentHouse ?? 0)) str += "🧍";
                else if ((mapInfo.visitedHouses ?? []).includes(i)) str += "✅";
                else {
                    const r = Math.random();
                    if (r < mazeConfig.enemyChance) str += "⚔️";
                    else if (r < mazeConfig.enemyChance + mazeConfig.questionChance) str += "❓";
                    else str += "⬜";
                }
                if (i % housesPerLine === 0) str += "\n";
            }
            return str;
        };

        const renderPrizeMessage = (prize) => {
            if (!prize) return null;
            switch (prize.type) {
                case "coin": return `🎉 Você recebeu **${prize.amount} ouro**${prize.xp ? ` + **${prize.xp} XP**` : ""}!`;
                case "xp": return `✨ Você ganhou **${prize.amount} XP**!`;
                case "cards": return `🎴 Você ganhou cartas!`;
                case "trophy": return `🏆 Vitória contra inimigo!`;
                case "boss": return `👑 Vitória no chefão! Ouro e XP recebidos.`;
                default: return `💎 Você encontrou um prêmio especial!`;
            }
        };

        const celebratePrize = async (prizeType) => {
            if (!["trophy", "cards"].includes(prizeType)) return;
            const frames = ["🎉✨🏆💎", "✨🎉🏆💎", "🏆✨🎉💎", "🎉🏆✨💎"];
            for (let frame of frames) {
                await message.channel.send(frame);
                await new Promise(res => setTimeout(res, 500));
            }
        };

        try {
            if (sub === "start") {
                const msg = startMaze(user);
                return message.reply(msg);
            }

            const handleRollOrGold = async (type) => {
                const mapIdArg = args[1] || currentMapId;
                if (!mazeConfig.maps[mapIdArg]) return message.reply("❌ Mapa inválido. Use `!maze start` para iniciar.");

                const targetHouse = type === "gold" ? toInt(args[2]) : null;
                if (type === "gold" && !targetHouse) return message.reply("❌ Informe a **casa alvo**: `!maze gold <mapId?> <casa>`");

                const actionResult = type === "roll"
                    ? await rollMaze(user, mapIdArg)
                    : useGoldDice(user, mapIdArg, targetHouse);

                const mapInfo = getMazeMapInfo(user, mapIdArg);
                if (!mapInfo) return message.reply("❌ Mapa inválido ou não iniciado. Use `!maze start`.");

                const prizeMsg = renderPrizeMessage(actionResult.prize);

                const currentHouse = mapInfo.currentHouse ?? 0;
                const visitedHousesLength = mapInfo.visitedHouses?.length ?? 0;
                const totalHouses = mapInfo.totalHouses ?? 0;

                const embed = new EmbedBuilder()
                    .setTitle(`🎲 Maze - ${type === "roll" ? "Rolagem" : "Gold Dice"}`)
                    .addFields(
                        { name: "Mapa", value: `#${mapIdArg}`, inline: true },
                        { name: "Casa Atual", value: `${currentHouse}`, inline: true },
                        { name: "Progresso", value: `${visitedHousesLength}/${totalHouses}` },
                        { name: "Resultado", value: actionResult.message }
                    );

                if (prizeMsg) embed.addFields({ name: "Prêmio Recebido", value: prizeMsg });
                embed.addFields({ name: "Tabuleiro", value: renderMiniMap(mapInfo) });
                embed.setColor(type === "roll" ? "Random" : "Gold");

                await message.reply({ embeds: [embed] });
                if (actionResult.prize) await celebratePrize(actionResult.prize.type);
            };

            if (sub === "roll") return handleRollOrGold("roll");
            if (sub === "gold") return handleRollOrGold("gold");

            if (sub === "reset") {
                const mapIdArg = args[1] || currentMapId;
                if (!mazeConfig.maps[mapIdArg]) return message.reply("❌ Mapa inválido. Use `!maze start` para iniciar.");

                const mapInfo = getMazeMapInfo(user, mapIdArg);
                const result = resetMaze(user, mapIdArg);
                const updatedMapInfo = getMazeMapInfo(user, mapIdArg);

                const currentHouseBefore = mapInfo.currentHouse ?? 0;
                const visitedHousesLength = updatedMapInfo.visitedHouses?.length ?? 0;
                const totalHouses = updatedMapInfo.totalHouses ?? 0;

                const embed = new EmbedBuilder()
                    .setTitle(`🔄 Maze - Reset`)
                    .addFields(
                        { name: "Mapa", value: `#${mapIdArg}`, inline: true },
                        { name: "Casa Antes do Reset", value: `${currentHouseBefore}` },
                        { name: "Progresso", value: `${visitedHousesLength}/${totalHouses}` },
                        { name: "Resultado", value: result },
                        { name: "Tabuleiro", value: renderMiniMap(updatedMapInfo) }
                    )
                    .setColor("Red");

                return message.reply({ embeds: [embed] });
            }

            return message.reply(
                "❌ Subcomando inválido.\nUse:\n" +
                "`!maze start` - Iniciar o Maze\n" +
                "`!maze roll [mapId]`\n" +
                "`!maze gold <mapId?> <casa>`\n" +
                "`!maze reset [mapId]`"
            );

        } catch (err) {
            console.error("❌ Erro em !maze:", err);
            return message.reply(`⚠️ Ocorreu um erro: ${err.message}`);
        }
    }
};