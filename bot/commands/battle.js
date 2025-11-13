import { runBattle } from "../../src/systems/battleSystem.js";
import { spendEnergy, addXP, addGold, regenerateEnergy } from "../../src/systems/economySystem.js";

export default {
  name: "battle",
  description: "Batalhe contra inimigos e ganhe XP e ouro.",
  
  async execute(message, args, user) {
    if (!user) return message.reply("⚠️ Usuário não carregado. Reinicie o comando.");
    
    // 1. Regeneração automática de energia
    const regenMsg = regenerateEnergy(user);
    if (regenMsg) await message.reply(`⚡ ${regenMsg}`);
    
    const energyCost = 4;
    if (!spendEnergy(user, energyCost))
      return message.reply(`❌ Energia insuficiente. Você precisa de **${energyCost}** de energia.`);
    
    // 2. Oponente padrão
    const opponent = {
      id: "cpu_shadow",
      name: "CPU - Oponente Sombrio",
      cards: [
        { id: "shadow_beast", name: "Monstro das Sombras", hp: 120, attack: 35 },
        { id: "lesser_demon", name: "Demônio Menor", hp: 90, attack: 25 }
      ],
      guardianId: "G02"
    };
    
    // 3. Rodar batalha e exibir log
    let battle;
    try {
      battle = runBattle(user, opponent); // gera batalha
      const battleMessage = await displayBattleLog(message, battle); // log em tempo real
      
      // 4. Mensagem final com recompensas
      const rewards = battle.rewards;
      let finalMsg = battle.win ?
        `\n🏆 **Você venceu!**\n✨ XP ganho: **${rewards.xp}**\n💰 Ouro ganho: **${rewards.gold}**` :
        `\n😓 **Derrota!** Nenhuma recompensa recebida.`;
      
      await battleMessage.edit(battleMessage.content + finalMsg);
      
      if (battle.win) {
        addXP(user, rewards.xp);
        addGold(user, rewards.gold);
      }
      
    } catch (err) {
      console.error("❌ Erro no runBattle:", err);
      return message.reply("⚠️ Erro interno ao processar a batalha.");
    }
  }
};

// -----------------------------
// Função externa para exibir log
// -----------------------------
async function displayBattleLog(message, battle) {
  const battleMessage = await message.reply(`⚔️ Iniciando a batalha...\n🔄 Preparando o inimigo...`);
  
  for (const line of battle.log) {
    // Força linha como string
    const text = String(line);
    await battleMessage.edit(battleMessage.content + "\n" + text);
    await new Promise(r => setTimeout(r, 1200)); // delay para simular gameplay
  }
  
  return battleMessage;
}