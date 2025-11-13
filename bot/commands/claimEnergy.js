// src/commands/claimEnergy.js

import { addEnergy } from "../../src/systems/economySystem.js";

export default {
  name: "claimenergy",
  description: "Resgatar energia diária do jogador.",
  
  async execute(message, args, user) {
    
    if (!user) {
      return message.reply("❌ Erro interno: usuário não carregado.");
    }
    
    const today = new Date().toDateString();
    
    // Garante a estrutura interna
    if (!user.dailyClaims) user.dailyClaims = {};
    
    // Caso já tenha coletado hoje
    if (user.dailyClaims.energy === today) {
      return message.reply("⚡ Você já coletou sua energia diária hoje. Tente novamente amanhã!");
    }
    
    const energyAmount = 30;
    
    // addEnergy deve modificar user.energy e retornar true/false
    const success = addEnergy(user, energyAmount);
    
    if (!success) {
      return message.reply(
        "⚠️ Sua energia já está no máximo. Gaste um pouco antes de resgatar a energia diária."
      );
    }
    
    // Registra a coleta diária
    user.dailyClaims.energy = today;
    
    // Salvamento automático feito pelo index.js
    return message.reply(
      `⚡ Você recebeu **+${energyAmount}** de energia!`
    );
  },
};