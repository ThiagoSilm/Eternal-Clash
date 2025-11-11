import { claimDailyEnergy } from "../../src/systems/dailyEnergySystem.js";
import { saveUser } from "../../src/systems/userSystem.js"; // ou userCacheSystem se for o caso

export default {
  name: "claimenergy",
  description: "Resgatar energia diária do jogador.",
  
  async execute(message, args, user) {
    // `user` já vem carregado pelo index.js via getOrCreateUser()
    const result = claimDailyEnergy(user);
    
    // caso o sistema altere o estado do jogador (energia, último resgate etc.)
    saveUser(user);
    
    await message.reply(result);
  }
};