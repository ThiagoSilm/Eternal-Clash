// src/commands/claimEnergy.js

// 🚨 CORREÇÃO: Removemos a importação de saveUser. O salvamento é delegado ao index.js.
import { addEnergy } from "../../src/systems/economySystem.js";

export default {
  name: "claimenergy",
  description: "Resgatar energia diária do jogador.",
  
  // O objeto 'user' é passado corretamente pelo middleware
  async execute(message, args, user) {
    const today = new Date().toDateString();
    
    // Inicializa a estrutura de claims se necessário
    if (!user.dailyClaims) user.dailyClaims = {};
    
    // 1. Verifica se já coletou hoje
    if (user.dailyClaims.energy === today) {
      await message.reply("⚡ Você já coletou sua energia diária. Tente novamente amanhã!");
      return;
    }
    
    const energyAmount = 30;
    
    // 2. Adiciona a energia (a função addEnergy deve modificar o objeto 'user')
    const success = addEnergy(user, energyAmount);
    
    if (!success) {
      // Retorno da função addEnergy indicando que o limite foi atingido, por exemplo.
      await message.reply("⚠️ Sua energia está no máximo! Gaste um pouco para poder coletar a energia diária.");
      return;
    }
    
    // 3. Marca a coleta de hoje
    user.dailyClaims.energy = today;
    
    // O index.js (middleware) fará o markUserDirty(user) automaticamente após a execução.
    await message.reply(`⚡ Você coletou **+${energyAmount}** de energia!`);
  }
};
