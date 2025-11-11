// src/commands/battle.js
import { simulateBattle } from "../systems/battleSystem.js";
import { loadUser, saveUser, spendEnergy, addXp, addGold, regenerateEnergy } from "../systems/economySystem.js";

export default function battleCommand(args) {
  const player = loadUser("Player");
  const opponent = {
    name: "CPU - Oponente Sombrio",
    cards: [
      { name: "Monstro das Sombras", hp: 120, attack: 35 },
      { name: "Demônio Menor", hp: 90, attack: 25 }
    ],
    guardianId: 2
  };
  
  const regenMsg = regenerateEnergy(player);
  if (regenMsg) console.log(regenMsg);
  
  if (!spendEnergy(player, 4)) {
    console.log("❌ Você não tem energia suficiente (precisa de 4).");
    return;
  }
  
  const result = simulateBattle(player, opponent);
  result.log.forEach(line => console.log(line));
  
  if (result.winner === "player") {
    const xpGain = 1500;
    const goldGain = 800;
    addXp(player, xpGain);
    addGold(player, goldGain);
    console.log(`💰 Ganhou ${xpGain} XP e ${goldGain} de ouro!`);
  } else {
    console.log("😓 Derrota — nenhuma recompensa recebida.");
  }
  
  saveUser(player);
}