// src/commands/maze.js

// 🚨 CORREÇÃO: Removemos a importação de loadUser/saveUser.
import { rollMaze, useGoldDice, resetMaze } from "../../src/systems/mazeSystem.js";

export default {
  name: "maze",
  description: "Jogue no Maze, role o dado, use Gold Dice ou resete o mapa.",
  usage: "[roll | gold <mapId> <targetHouse> | reset]",
  
  // ⚠️ ATENÇÃO: Recebe o objeto 'user' do middleware do index.js
  async execute(message, args, user) { 
    
    const subcommand = (args[0] || "roll").toLowerCase();
    // mapId agora é o primeiro argumento para 'roll' e 'reset', e o segundo para 'gold'
    const mapId = parseInt(args[1]); 
    
    // As funções do mazeSystem devem modificar o objeto 'user' e retornar a mensagem de resultado.

    if (subcommand === "roll") {
        const currentMapId = mapId || 2; // Default 2 se não for especificado
        const result = rollMaze(user, currentMapId);
        return message.reply(`🎲 Rolagem concluída! ${result}`);
    }
    
    if (subcommand === "gold") {
        const goldMapId = mapId;
        const targetHouse = parseInt(args[2]); // args[2] é o índice da casa alvo
        
        if (!goldMapId) return message.reply("❌ Informe o ID do mapa para usar o Gold Dice (ex: `!maze gold 2 15`).");
        if (!targetHouse) return message.reply("❌ Informe a casa alvo para usar o Gold Dice (ex: `!maze gold 2 15`).");
        
        const result = useGoldDice(user, goldMapId, targetHouse);
        return message.reply(`✨ Gold Dice usado! ${result}`);
    }
    
    if (subcommand === "reset") {
        const currentMapId = mapId || 2; // Default 2 se não for especificado
        const result = resetMaze(user, currentMapId);
        return message.reply(`🔄 Reset concluído! ${result}`);
    }
    
    return message.reply("❌ Subcomando inválido. Use: `!maze roll [mapId]`, `!maze gold <mapId> <casa>` ou `!maze reset [mapId]`.");
  }
};
