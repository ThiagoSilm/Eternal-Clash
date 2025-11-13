// src/commands/maze.js

import { rollMaze, useGoldDice, resetMaze, getCurrentMapId } from "../../src/systems/mazeSystem.js";

export default {
    name: "maze",
    description: "Jogue no Maze, role o dado, use Gold Dice ou resete o mapa.",
    usage: "[roll | gold <mapId> <targetHouse> | reset]",
    
    async execute(message, args, user) {
        
        const sub = (args[0] || "roll").toLowerCase();
        
        // Função segura para validar IDs numéricos
        const toInt = (v) => {
            const n = parseInt(v);
            return Number.isInteger(n) && n > 0 ? n : null;
        };
        
        // Sempre tenta usar o mapId atual se não foi passado
        const mapIdArg = toInt(args[1]);
        const effectiveMapId = mapIdArg || getCurrentMapId(user) || 1;
        
        try {
            
            // -----------------------------
            // 🎲 ROLL
            // -----------------------------
            if (sub === "roll") {
                
                const result = rollMaze(user, effectiveMapId);
                
                return message.reply({
                    content: `🎲 **Rolagem Executada**\n${result}`,
                    allowedMentions: { repliedUser: false }
                });
            }
            
            // -----------------------------
            // ✨ GOLD DICE
            // -----------------------------
            if (sub === "gold") {
                
                const goldMapId = mapIdArg;
                const targetHouse = toInt(args[2]);
                
                if (!goldMapId)
                    return message.reply("❌ Informe: `!maze gold <mapId> <casa>`");
                
                if (!targetHouse)
                    return message.reply("❌ Informe a **casa alvo**: `!maze gold 2 15`");
                
                const result = useGoldDice(user, goldMapId, targetHouse);
                
                return message.reply({
                    content: `✨ **Gold Dice Usado**\n${result}`,
                    allowedMentions: { repliedUser: false }
                });
            }
            
            // -----------------------------
            // 🔄 RESET
            // -----------------------------
            if (sub === "reset") {
                
                const result = resetMaze(user, effectiveMapId);
                
                return message.reply({
                    content: `🔄 **Maze Resetado**\n${result}`,
                    allowedMentions: { repliedUser: false }
                });
            }
            
            // -----------------------------
            // ❓ Subcomando inválido
            // -----------------------------
            return message.reply(
                "❌ Subcomando inválido.\nUse:\n" +
                "`!maze roll [mapId]`\n" +
                "`!maze gold <mapId> <casa>`\n" +
                "`!maze reset [mapId]`"
            );
            
        } catch (err) {
            console.error("❌ Erro em !maze:", err);
            return message.reply("⚠️ Ocorreu um erro ao processar o Maze.");
        }
    }
};