// src/commands/battle.js

import { battleSystem } from "../src/systems/battleSystem.js"; // ⚠️ Assumindo battleSystem é o nome correto
import { spendEnergy, addXp, addGold, regenerateEnergy } from "../src/systems/economySystem.js";
// 🚨 CORREÇÃO: Removemos a importação de saveUser, pois o salvamento é delegado ao index.js.

export default {
  name: "battle",
  description: "Batalhe contra inimigos e ganhe XP e ouro.",
  
  // O objeto 'user' é passado corretamente pelo middleware
  async execute(message, args, user) {
    // Referência o objeto 'user' para clareza no contexto da batalha
    const player = user;
    
    // 1. Configuração do Oponente (Simplificado)
    const opponent = {
      name: "CPU - Oponente Sombrio",
      cards: [
        { name: "Monstro das Sombras", hp: 120, attack: 35 },
        { name: "Demônio Menor", hp: 90, attack: 25 }
      ],
      guardianId: 2 // Usado se houver lógica de Guardião no sistema de batalha
    };
    
    // 2. Gerenciamento de Energia
    const regenMsg = regenerateEnergy(player); // Tenta regenerar se o cooldown tiver passado
    let response = regenMsg ? `⚡ ${regenMsg}\n` : "";
    
    const energyCost = 4;
    if (!spendEnergy(player, energyCost)) {
      await message.reply(response + `❌ Você não tem energia suficiente (precisa de ${energyCost}).`);
      return;
    }
    
    // 3. Simulação da Batalha
    // ⚠️ ATENÇÃO: Corrigido para usar battleSystem
    const result = battleSystem(player, opponent); 
    
    // O log de batalha pode ser muito longo; é melhor enviá-lo separadamente ou resumido
    const battleLogSummary = result.log.slice(0, 5).join("\n") + "\n... (Finalizado em " + result.turns + " turnos)\n";
    response += `\n**--- ⚔️ INÍCIO DA BATALHA ⚔️ ---**\n${battleLogSummary}\n`;
    
    // 4. Recompensas
    if (result.winner === "player") {
      const xpGain = 1500;
      const goldGain = 800;
      
      // Funções modificam o objeto 'player' (que é 'user')
      addXp(player, xpGain);
      addGold(player, goldGain);
      
      response += `🏆 **Vitória!** Você ganhou **${xpGain} XP** e **${goldGain} ouro**!`;
    } else {
      response += "😓 Derrota — nenhuma recompensa significativa recebida.";
    }
    
    // 🚨 CORREÇÃO: A chamada saveUser(player) foi removida.
    // O index.js fará o markUserDirty(user) e salvará automaticamente.
    
    // 5. Responde ao jogador
    await message.reply({ content: response, allowedMentions: { repliedUser: false } });
  }
};
