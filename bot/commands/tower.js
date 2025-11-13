import { spendTowerAttempt, getTowerStatus, getFloorEnemy, getFloorReward } from "../../src/systems/towerSystem.js";
import { battleSystem } from "../../src/systems/battleSystem.js";
import { addXP, addGold } from "../../src/systems/economySystem.js";

export default {
  name: "tower",
  description: "Desafie a Torre Infinita para ganhar recompensas épicas!",
  usage: "[status | challenge]",
  
  async execute(message, args, user) {
    // 🟢 GARANTIA: A inicialização da estrutura tower é melhor tratada dentro do towerSystem, 
    // mas mantemos esta linha como fallback de segurança.
    if (!user.tower) user.tower = { floor: 1, attempts: 3 };
    
    const sub = args[0]?.toLowerCase() || 'status';
    
    try {
      if (sub === 'status') {
        // 1. STATUS
        const status = getTowerStatus(user);
        return message.reply(`🏰 **Status da Torre de Batalha:**\n${status}`);
        
      } else if (sub === 'challenge' || sub === 'c') {
        // 2. DESAFIO
        
        // A. Verifica e gasta a tentativa (spendTowerAttempt faz a inicialização diária)
        if (!spendTowerAttempt(user)) {
          return message.reply("❌ Você não tem tentativas de Torre. Volte amanhã ou compre mais!");
        }
        
        const currentFloor = user.tower.floor;
        
        // B. Prepara o inimigo (usando o andar que o usuário estava PRESTES a lutar)
        const opponent = getFloorEnemy(currentFloor);
        
        // C. Simula a Batalha
        const result = battleSystem(user, opponent);
        
        let response = `\n**--- ⚔️ ANDAR ${currentFloor}: ${opponent.name} ⚔️ ---**\n`;
        // Exibe o resumo do log
        response += result.log.slice(0, 5).join("\n") + "\n... (Batalha concluída em " + result.turns + " turnos)\n";
        
        // D. Recompensas e Progressão
        if (result.winner === "player") {
          const rewards = getFloorReward(currentFloor);
          
          // Adiciona recompensas
          addXP(user, rewards.xp);
          addGold(user, rewards.gold);
          
          // Avança para o próximo andar
          user.tower.floor += 1;
          
          response += `\n🎉 **SUCESSO!** Andar ${currentFloor} conquistado!`;
          response += `\n🎁 **Recompensas:** +${rewards.xp} XP, +${rewards.gold} Ouro.`;
          response += `\nSeu próximo desafio é o **Andar ${user.tower.floor}**.`;
          
        } else {
          // A tentativa já foi gasta.
          response += "\n😓 **DERROTA.** Suas cartas não foram páreo para este andar.";
          response += `\nVocê perdeu uma tentativa. Tentativas restantes: ${user.tower.attempts}.`;
        }
        
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
      // Incluir detalhes do erro apenas se for seguro (em produção, evite mostrar detalhes do erro)
      await message.reply("⚠️ Ocorreu um erro interno ao processar o desafio da Torre.");
    }
  }
};