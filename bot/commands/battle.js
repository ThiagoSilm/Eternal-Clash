import { runBattle } from "../../src/systems/battleSystem.js";
import { spendEnergy, addXP, addGold, regenerateEnergy } from "../../src/systems/economySystem.js";

export default {
  name: "battle",
  description: "Batalhe contra inimigos e ganhe XP e ouro.",
  
  async execute(message, args, user) {
    if (!user) return message.reply("⚠️ Usuário não carregado. Reinicie o comando.");
    
    // 1️⃣ Regeneração automática de energia
    const regenMsg = regenerateEnergy(user);
    if (regenMsg) await message.reply(`⚡ ${regenMsg}`);
    
    // 2️⃣ Custo de energia
    const energyCost = 4;
    if (!spendEnergy(user, energyCost))
      return message.reply(`❌ Energia insuficiente. Você precisa de **${energyCost}** de energia.`);
    
    // 3️⃣ Preparar o oponente padrão (pode ser expandido para RNG ou NPCs)
    const opponent = {
      id: "cpu_shadow",
      name: "CPU - Oponente Sombrio",
      cards: [
        { id: "shadow_beast", name: "Monstro das Sombras", hp: 120, attack: 35, effects: ["eff013"] },
        { id: "lesser_demon", name: "Demônio Menor", hp: 90, attack: 25, effects: ["eff046"] }
      ],
      guardian: { id: "G02", name: "Guardião Sombrio", hp: 400, rageMax: 100, specialEffect: "eff037" }
    };
    
    // 4️⃣ Rodar batalha
    let battle;
    try {
      battle = runBattle(user, opponent, { autoMode: false }); // gera batalha
      const battleMessage = await displayBattleLog(message, battle); // exibe log em tempo real
      
      // 5️⃣ Mensagem final e recompensas
      const rewards = battle.rewards || { xp: 0, gold: 0 };
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
    const text = String(line);
    await battleMessage.edit(battleMessage.content + "\n" + text);
    await new Promise(r => setTimeout(r, 1200)); // delay para simular gameplay
  }
  
  return battleMessage;
}