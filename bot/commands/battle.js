import { simulateBattle } from "../../src/systems/battleSystem.js";
import { spendEnergy, addXp, addGold, regenerateEnergy } from "../../src/systems/economySystem.js";
import { saveUser } from "../../src/systems/userSystem.js"; // ajusta conforme o nome do arquivo que salva o user

export default {
  name: "battle",
  description: "Batalhe contra inimigos e ganhe XP e ouro.",
  
  async execute(message, args, user) {
    // O usuário já vem carregado do cache pelo index principal
    const player = user;
    
    // Oponente simples (pode expandir depois)
    const opponent = {
      name: "CPU - Oponente Sombrio",
      cards: [
        { name: "Monstro das Sombras", hp: 120, attack: 35 },
        { name: "Demônio Menor", hp: 90, attack: 25 }
      ],
      guardianId: 2
    };
    
    // Regenera energia automática (caso o jogador esteja sem)
    const regenMsg = regenerateEnergy(player);
    let response = regenMsg ? `${regenMsg}\n` : "";
    
    // Checa energia
    if (!spendEnergy(player, 4)) {
      await message.reply(response + "❌ Você não tem energia suficiente (precisa de 4).");
      return;
    }
    
    // Simula a batalha
    const result = simulateBattle(player, opponent);
    response += result.log.join("\n") + "\n";
    
    // Recompensas
    if (result.winner === "player") {
      const xpGain = 1500;
      const goldGain = 800;
      addXp(player, xpGain);
      addGold(player, goldGain);
      response += `🏆 **Vitória!** Você ganhou **${xpGain} XP** e **${goldGain} ouro**!`;
    } else {
      response += "😓 Derrota — nenhuma recompensa recebida.";
    }
    
    // Salva progresso
    saveUser(player);
    
    // Responde ao jogador
    await message.reply(response);
  }
};