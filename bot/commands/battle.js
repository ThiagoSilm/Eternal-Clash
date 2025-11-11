'import { simulateBattle } from "../../src/systems/battleSystem.js";
import { loadUser, saveUser, spendEnergy, addXp, addGold, regenerateEnergy } from "../../src/systems/economySystem.js";

export default {
  name: "battle",
  description: "Batalhe contra inimigos ou CPU e ganhe XP e ouro.",
  async execute(message, args) {
    const userId = message.author.id;
    const player = loadUser(userId);
    
    // Definição do oponente (pode ser expandida depois para diferentes oponentes)
    const opponent = {
      name: "CPU - Oponente Sombrio",
      cards: [
        { name: "Monstro das Sombras", hp: 120, attack: 35 },
        { name: "Demônio Menor", hp: 90, attack: 25 }
      ],
      guardianId: 2
    };
    
    // Regeneração de energia automática
    const regenMsg = regenerateEnergy(player);
    let response = regenMsg ? `${regenMsg}\n` : "";
    
    // Verifica se o jogador tem energia suficiente
    if (!spendEnergy(player, 4)) {
      await message.reply(response + "❌ Você não tem energia suficiente (precisa de 4).");
      return;
    }
    
    // Simula a batalha
    const result = simulateBattle(player, opponent);
    response += result.log.join("\n") + "\n";
    
    // Distribui recompensas
    if (result.winner === "player") {
      const xpGain = 1500;
      const goldGain = 800;
      addXp(player, xpGain);
      addGold(player, goldGain);
      response += `💰 Vitória! Ganhou ${xpGain} XP e ${goldGain} de ouro!`;
    } else {
      response += "😓 Derrota — nenhuma recompensa recebida.";
    }
    
    // Salva o progresso do jogador
    saveUser(player);
    
    // Envia toda a resposta de uma vez
    await message.reply(response);
  }
};import { simulateBattle } from "../src/systems/battleSystem.js";
import { spendEnergy, addXp, addGold, regenerateEnergy } from "../src/systems/economySystem.js";
import { saveUser } from "../src/systems/userSystem.js"; // ajusta conforme o nome do arquivo que salva o user

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