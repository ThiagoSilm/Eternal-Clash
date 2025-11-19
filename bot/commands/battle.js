// bot/commands/battle.js
import { spendEnergy, addXP, addGold, regenerateEnergy } from "../../src/systems/economySystem.js";

// -----------------------------
// Utilitários
// -----------------------------
const checkAvailable = deck => deck.filter(c=>c.hp>0&&c.cooldown<=0);

const applyEffects = (card,target,log)=>{
  if(card.effects.includes("bleed")){target.hp-=5;log.push(`   [BLEED] ${target.name} sofre 5 de dano.`);}
  if(card.effects.includes("poison")){target.hp-=3;log.push(`   [POISON] ${target.name} sofre 3 de dano.`);}
  if(card.effects.includes("stun")){target.stunned=true;log.push(`   [STUN] ${target.name} está atordoado e perde o próximo turno.`);}
};

const attack = (attacker,defender,log)=>{
  for(const card of attacker.board){
    if(card.hp<=0||card.stunned) {if(card.stunned) {card.stunned=false;log.push(`   [RECOVER] ${card.name} se recupera do stun.`);} continue;}
    const target = defender.board.find(c=>c.hp>0) || defender.guardian;
    if(!target) continue;
    let def=target.defense||0;if(target.effects?.includes("shield")) def*=2;
    const dmg=Math.max(card.attack-(card.effects.includes("pierce")?0:def),0);
    target.hp-=dmg;
    log.push(`   [ATK] ${card.name} ataca ${target.name}, causando ${dmg} de dano.`);
    applyEffects(card,target,log);
  }
};

const playCard=(player,index,log)=>{
  const card=player.deck[index];
  if(!card) return false;
  player.board.push(card);
  card.cooldown=card.maxCooldown;
  log.push(`   [PLAY] ${card.name} entra em campo!`);
  return true;
};

// -----------------------------
// Guardian Skills
// -----------------------------
const guardianSkills=[
  {name:"Golpe Supremo",type:"damage",value:60,cooldown:5},
  {name:"Cura",type:"heal",value:50,cooldown:6},
  {name:"Buff de Ataque",type:"buff",value:15,cooldown:4}
];

const useGuardianSkill=(player,enemy,skillIndex,log)=>{
  if(player.guardian.cooldowns[skillIndex]>0) return false;
  const skill=guardianSkills[skillIndex];
  switch(skill.type){
    case "damage": enemy.guardian.hp-=skill.value; log.push(`✨ [GUARDIAN] ${player.guardian.name} usa ${skill.name} causando ${skill.value} de dano!`); break;
    case "heal": player.guardian.hp=Math.min(player.guardian.maxHp,player.guardian.hp+skill.value); log.push(`✨ [GUARDIAN] ${player.guardian.name} usa ${skill.name} e recupera ${skill.value} HP!`); break;
    case "buff": player.board.forEach(c=>c.attack+=skill.value); log.push(`✨ [GUARDIAN] ${player.guardian.name} usa ${skill.name}, aumentando ATK das cartas em ${skill.value}!`); break;
  }
  player.guardian.cooldowns[skillIndex]=skill.cooldown;
  return true;
};

// -----------------------------
// Atualiza cooldowns do guardian
// -----------------------------
const updateGuardianCooldowns=(player)=>{
  player.guardian.cooldowns.forEach((cd,i)=>{if(cd>0) player.guardian.cooldowns[i]--;});
};

// -----------------------------
// Simulação interativa
// -----------------------------
async function simulateBattle(user,opponent,message){
  const log=[];let turn=1,win=false;
  const userDeck=user.deck?.map(c=>({...c}))||[];
  const userState={name:user.name,guardian:{...user.guardian,cooldowns:[0,0,0]},deck:userDeck,board:[]};
  const opponentState={name:opponent.name,guardian:{...opponent.guardian,cooldowns:[0,0,0]},deck:opponent.deck||[],board:[]};

  const battleMessage=await message.reply(`⚔️ Batalha iniciada: ${userState.name} vs ${opponentState.name}`);

  while(turn<=20 && userState.guardian.hp>0 && opponentState.guardian.hp>0){
    log.push(`\n--- Turno ${turn} ---`);

    // Atualiza cooldowns
    userState.deck.forEach(c=>{if(c.cooldown>0)c.cooldown--;});
    opponentState.deck.forEach(c=>{if(c.cooldown>0)c.cooldown--;});
    updateGuardianCooldowns(userState);
    updateGuardianCooldowns(opponentState);

    // Jogador escolhe ação
    const available=userState.deck.filter(c=>c.hp>0&&c.cooldown<=0);
    if(available.length>0){
      const cardList=available.map((c,i)=>`${i+1}: ${c.name} (ATK:${c.attack} HP:${c.hp})`).join("\n");
      const skillList=guardianSkills.map((s,i)=>`${i+1+available.length}: ${s.name} (CD:${userState.guardian.cooldowns[i]} turnos)`).join("\n");
      await battleMessage.edit(battleMessage.content+`\nEscolha sua ação:\n${cardList}\n${skillList}\nDigite o número correspondente.`);
      try{
        const filter=m=>m.author.id===message.author.id;
        const collected=await message.channel.awaitMessages({filter,max:1,time:30000,errors:['time']});
        const answer=parseInt(collected.first().content.trim())-1;
        if(answer<available.length) playCard(userState,userState.deck.findIndex(c=>c.id===available[answer].id),log);
        else useGuardianSkill(userState,opponentState,answer-available.length,log);
      }catch{log.push("⏱️ Tempo esgotado. Nenhuma ação selecionada.");}
    }

    // IA do oponente
    const oppAvail=opponentState.deck.filter(c=>c.hp>0&&c.cooldown<=0);
    if(oppAvail.length>0) playCard(opponentState,opponentState.deck.findIndex(c=>c.id===oppAvail.reduce((a,b)=>a.attack>=b.attack?a:b).id),log);
    const randomSkill=Math.floor(Math.random()*3);
    useGuardianSkill(opponentState,userState,randomSkill,log);

    // Ataques
    attack(userState,opponentState,log);
    attack(opponentState,userState,log);

    // Limpa cartas mortas
    userState.board=userState.board.filter(c=>c.hp>0);
    opponentState.board=opponentState.board.filter(c=>c.hp>0);

    log.push(`[Status] ${userState.name} HP:${userState.guardian.hp.toFixed(1)} | ${opponentState.name} HP:${opponentState.guardian.hp.toFixed(1)}`);
    await battleMessage.edit(battleMessage.content+"\n"+log.slice(-8).join("\n"));

    if(opponentState.guardian.hp<=0){win=true;break;}
    if(userState.guardian.hp<=0){win=false;break;}
    turn++;
  }

  const rewards=win?{xp:50+turn*5,gold:30+turn*3}:{xp:0,gold:0};
  log.push("\n--- Fim da Batalha ---");
  return {win,log,rewards};
}

// -----------------------------
// Comando Battle
// -----------------------------
export default {
  name:"battle",
  description:"Batalhe contra inimigos e ganhe XP e ouro.",
  async execute(message,args,user){
    if(!user) return message.reply("⚠️ Usuário não carregado.");
    user.name=user.name||message.author.username||"Heroi";
    user.guardian=user.guardian||{id:"G01",name:"Guardião Aliado",hp:10000,maxHp:10000,rageMax:100,specialEffect:"eff001",cooldowns:[0,0,0]};

    const regenMsg=regenerateEnergy(user);if(regenMsg) await message.reply(`⚡ ${regenMsg}`);
    const energyCost=4;if(!spendEnergy(user,energyCost)) return message.reply(`❌ Energia insuficiente. Precisa de **${energyCost}** de energia.`);

    const opponent={id:"cpu_shadow",name:"CPU - Oponente Sombrio",guardian:{id:"G02",name:"Guardião Sombrio",hp:400,maxHp:400,rageMax:100,specialEffect:"eff037",cooldowns:[0,0,0]},deck:[]};

    try{
      const battle=await simulateBattle(user,opponent,message);
      const finalMsg=battle.win
        ? `\n🏆 **Você venceu!**\n✨ XP ganho: **${battle.rewards.xp}**\n💰 Ouro ganho: **${battle.rewards.gold}**`
        : `\n😓 **Derrota!** Nenhuma recompensa.`;
      await message.channel.send(finalMsg);
      if(battle.win){addXP(user,battle.rewards.xp);addGold(user,battle.rewards.gold);}
    }catch(err){
      console.error("❌ Erro no simulateBattle:",err);
      return message.reply("⚠️ Erro interno ao processar a batalha.");
    }
  }
};