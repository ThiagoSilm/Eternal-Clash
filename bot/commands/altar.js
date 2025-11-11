// commands/altar.js
import { invokeCard, invokeBooster } from "../src/systems/altarSystem.js";

export default {
  name: "altar",
  description: "Usa o altar para invocar cartas ou boosters mágicos.",
  
  async execute(message, args, user) {
    const sub = args[0];
    let response;
    
    switch (sub) {
      case "invocar": {
        const type = args[1] || "gold";
        const amount = parseInt(args[2]) || 1;
        response = await invokeCard(user, type, amount);
        break;
      }
      
      case "booster": {
        const boosterName = args.slice(1).join(" ");
        if (!boosterName)
          response = "❌ Use: `!altar booster <nomeDoBooster>`";
        else
          response = await invokeBooster(user, boosterName);
        break;
      }
      
      default:
        response = "🔮 **Comandos do Altar:**\n" +
          "`!altar invocar <gold|cupon|gem> [quantidade]`\n" +
          "`!altar booster <nomeDoBooster>`";
    }
    
    await message.channel.send(response);
  }
};