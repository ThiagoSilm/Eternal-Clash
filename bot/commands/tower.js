// src/commands/tower.js

import { spendTowerAttempt, getTowerStatus, getFloorEnemy, getFloorReward } from "../../src/systems/towerSystem.js";
import { battleSystem } from "../../src/systems/battleSystem.js";
import { addXp, addGold } from "../../src/systems/economySystem.js";

export default {
  name: "tower",
  description: "Desafie a Torre Infinita para ganhar recompensas épicas!",
  usage: "[status | challenge]",
  
  async execute(message, args, user) {
    const sub = args[0]?.toLowerCase() || 'status';
    
    // Garante que a estrutura tower exista
    if (!user.tower) user.tower = { floor: 1, attempts: 3 }; 
    
    try {
      if (sub === 'status') {
        // 1. STATUS
        const status = getTowerStatus(user);
        return message.reply(`🏰 **Status da Torre:**\n${status}`);
        
      } else if (sub === 'challenge' || sub === 'c') {
        // 2. DESAFIO
        
        // A. Verifica tentativas
        if (user.tower.attempts <= 0) {
          return message.reply("❌ Você não tem tentativas de Torre. Volte amanhã ou compre mais!");
        }
        
        const currentFloor = user.tower.floor;
        
        // B. Prepara o inimigo e gasta a tentativa
        const opponent = getFloorEnemy(currentFloor);
        spendTowerAttempt(user); // Funções do towerSystem devem decrementar user.tower.attempts

        // C. Simula a Batalha (reutilizando battleSystem)
        const result = battleSystem(user, opponent);
        
        let response = `\n**--- ⚔️ ANDAR ${currentFloor}: ${opponent.name} ⚔️ ---**\n`;
        response += result.log.slice(0, 5).join("\n") + "\n... (Finalizado em " + result.turns + " turnos)\n";

        // D. Recompensas
        if (result.winner === "player") {
          const rewards = getFloorReward(currentFloor);
          
          // Adiciona recompensas (modifica o objeto 'user')
          addXp(user, rewards.xp);
          addGold(user, rewards.gold);
          // (Outros itens/cartas seriam adicionados aqui)
          
          // Avança para o próximo andar
          user.tower.floor += 1; 

          response += `\n🎉 **SUCESSO!** Andar ${currentFloor} conquistado!`;
          response += `\n🎁 **Recompensas:** +${rewards.xp} XP, +${rewards.gold} Ouro.`;
          response += `\nSeu próximo desafio é o **Andar ${user.tower.floor}**.`;
          
        } else {
          response += "\n😓 **DERROTA.** Suas cartas não foram páreo para este andar.";
          response += "\nVocê perdeu uma tentativa. Tente novamente ou melhore suas cartas!";
        }
        
        // O index.js fará o salvamento automático.
        return message.reply(response);
        
      } else {
        return message.reply(
          "🏰 **Comandos da Torre:**\n" +
          "`!tower status` — Ver seu andar atual e tentativas.\n" +
          "`!tower challenge` — Iniciar o desafio do próximo andar (custo: 1 tentativa)."
        );
      }
      
    } catch (err) {
      console.error("❌ Erro no comando tower:", err);
      await message.reply("⚠️ Ocorreu um erro ao processar o desafio da Torre.");
    }
  }
};
