// src/commands/tower.js

// 🟢 CORREÇÃO 1: Caminho de importação
import { spendTowerAttempt, getTowerStatus, getFloorEnemy, getFloorReward } from "../../src/systems/towerSystem.js";
import { battleSystem } from "../../src/systems/battleSystem.js";
import { addXP, addGold } from "../../src/systems/economySystem.js";

export default {
  name: "tower",
  description: "Desafie a Torre Infinita para ganhar recompensas épicas!",
  usage: "[status | challenge]",
  
  async execute(message, args, user) {
    // 🟢 MELHORIA 1: Garante que a estrutura tower exista logo no início
    if (!user.tower) user.tower = { floor: 1, attempts: 3 }; 
    
    const sub = args[0]?.toLowerCase() || 'status';

    try {
      if (sub === 'status') {
        // 1. STATUS
        // Nota: Assumimos que getTowerStatus(user) retorna uma string formatada.
        const status = getTowerStatus(user);
        return message.reply(`🏰 **Status da Torre de Batalha:**\n${status}`);
        
      } else if (sub === 'challenge' || sub === 'c') {
        // 2. DESAFIO
        
        // A. Verifica tentativas
        if (user.tower.attempts <= 0) {
          return message.reply("❌ Você não tem tentativas de Torre. Volte amanhã ou compre mais!");
        }
        
        const currentFloor = user.tower.floor;
        
        // B. Prepara o inimigo e gasta a tentativa
        const opponent = getFloorEnemy(currentFloor);
        
        // 🟢 GARANTIA: Gasta a tentativa ANTES da batalha
        spendTowerAttempt(user); 

        // C. Simula a Batalha (reutilizando battleSystem)
        // Nota: Assumimos que user.cards é o deck que o usuário usa na batalha.
        const result = battleSystem(user, opponent);
        
        let response = `\n**--- ⚔️ ANDAR ${currentFloor}: ${opponent.name} (PvP: ${opponent.isPlayer ? 'Sim' : 'Não'}) ⚔️ ---**\n`;
        // Exibe o resumo do log
        response += result.log.slice(0, 5).join("\n") + "\n... (Batalha concluída em " + result.turns + " turnos)\n";

        // D. Recompensas
        if (result.winner === "player") {
          const rewards = getFloorReward(currentFloor);
          
          // Adiciona recompensas (modifica o objeto 'user' e funções devem marcar dirty)
          addXP(user, rewards.xp);
          addGold(user, rewards.gold);
          // 💡 Ponto de Extensão: Adicionar logicamente recompensas de cartas/itens aqui.
          
          // Avança para o próximo andar (Modificação direta no user, que será salvo)
          user.tower.floor += 1; 

          response += `\n🎉 **SUCESSO!** Andar ${currentFloor} conquistado!`;
          response += `\n🎁 **Recompensas:** +${rewards.xp} XP, +${rewards.gold} Ouro.`;
          response += `\nSeu próximo desafio é o **Andar ${user.tower.floor}**.`;
          
        } else {
          // A tentativa já foi gasta acima, não precisa de lógica extra aqui.
          response += "\n😓 **DERROTA.** Suas cartas não foram páreo para este andar.";
          response += "\nVocê perdeu uma tentativa. Tente novamente ou melhore suas cartas!";
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
