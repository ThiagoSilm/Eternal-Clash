// src/commands/energy.js

import { getEnergyStatus } from "../src/systems/energySystem.js";
// 🚨 CORREÇÃO: Removemos a importação de getOrCreateUser, pois o usuário já é garantido pelo index.js.

export default {
  name: "energy",
  description: "Verifique o status atual da sua energia.",
  
  // ⚠️ ATENÇÃO: Adicionamos o objeto 'user' para receber o dado do middleware
  async execute(message, args, user) {
    // O usuário já está garantido e carregado (ou criado) pelo index.js.
    
    try {
      // ⚠️ CORREÇÃO: Passamos o objeto 'user' para a função de status
      const response = getEnergyStatus(user); 
      
      await message.reply({ content: response, allowedMentions: { repliedUser: false } });
      
      // Comando de leitura, não precisa de markUserDirty.
      
    } catch (err) {
      console.error("❌ Erro ao checar energia:", err);
      await message.reply("⚠️ Ocorreu um erro ao verificar sua energia.");
    }
  }
};
