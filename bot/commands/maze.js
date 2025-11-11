import { enterMaze, resetMaze } from "../../src/systems/mazeSystem.js";

export default {
  name: "maze",
  description: "Explora o labirinto com seu Guardião.",
  async execute(message, args) {
    try {
      const action = args[0];
      const userId = message.author.id; // identifica o jogador pelo Discord
      
      let response;
      
      switch (action) {
        case "rolar":
          response = enterMaze(userId);
          break;
          
        case "resetar":
          response = resetMaze(userId);
          break;
          
        default:
          response = "🎲 **Comandos do Maze:**\n" +
            "`!maze rolar` → Rolar o dado e explorar\n" +
            "`!maze resetar` → Resetar o Maze";
      }
      
      if (!response || typeof response !== "string") {
        response = "⚠️ Algo deu errado ao processar o Maze. Tente novamente.";
      }
      
      await message.reply({
        content: response,
        allowedMentions: { repliedUser: false }
      });
    } catch (err) {
      console.error("Erro em !maze:", err);
      await message.reply("❌ Ocorreu um erro ao executar o comando `!maze`.");
    }
  }
};