// src/commands/claimEnergy.js
import { saveUser } from "../../src/systems/userSystem.js";
import { addEnergy } from "../../src/systems/economySystem.js";

export default {
  name: "claimenergy",
  description: "Resgatar energia diária do jogador.",
  
  async execute(message, args, user) {
    const today = new Date().toDateString();
    
    if (!user.dailyClaims) user.dailyClaims = {};
    
    if (user.dailyClaims.energy === today) {
      await message.reply("⚡ Você já coletou sua energia hoje. Tente novamente amanhã!");
      return;
    }
    
    const energyAmount = 30;
    
    if (!addEnergy(user, energyAmount)) {
      await message.reply("⚠️ Não foi possível adicionar energia. Verifique se há limite máximo.");
      return;
    }
    
    user.dailyClaims.energy = today;
    saveUser(user);
    
    await message.reply(`⚡ Você coletou +${energyAmount} de energia!`);
  }
};