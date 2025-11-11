import { enterTower, getTowerStatus } from "../../src/systems/towerSystem.js";

export default {
  name: "tower",
  description: "Suba a torre enfrentando desafios e batalhas.",
  async execute(message, args) {
    const userId = message.author.id;
    const sub = (args[0] || "").toLowerCase();
    
    let response;
    
    switch (sub) {
      case "entrar":
        response = enterTower(userId);
        break;
        
      case "resetar":
        response = resetTower(userId);
        break;
        
      case "status":
        response = getTowerStatus(userId);
        break;
        
      default:
        response = "🗼 **Comandos da Tower:**\n" +
          "`!tower entrar` — Desafiar o andar atual\n" +
          "`!tower resetar` — Voltar ao início\n" +
          "`!tower status` — Ver seu progresso";
    }
    
    await message.reply(response);
  }
};