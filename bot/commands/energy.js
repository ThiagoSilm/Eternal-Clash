// src/commands/energy.js

import { getEnergyStatus } from "../../src/systems/energySystem.js";

export default {
  name: "energy",
  description: "Verifique o status atual da sua energia.",
  
  async execute(message, args, user) {
    // Proteção — caso algum erro no middleware ocorra
    if (!user) {
      return message.reply("❌ Erro interno: usuário não carregado.");
    }
    
    try {
      // Sistema de energia não deve modificar nada (somente leitura)
      const response = getEnergyStatus(user);
      
      await message.reply({
        content: response,
        allowedMentions: { repliedUser: false }
      });
      
    } catch (err) {
      console.error("❌ Erro ao checar energia:", err);
      await message.reply("⚠️ Ocorreu um erro ao verificar sua energia.");
    }
  },
};