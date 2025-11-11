import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { triggerEffects, processOverTimeEffects } from "./effectSystem.js";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const guardians = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/guardians.json")));

function getGuardian(id) {
  return guardians.find(g => g.id === id);
}

export function simulateBattle(player, opponent) {
  const log = [];
  const p1 = JSON.parse(JSON.stringify(player));
  const p2 = JSON.parse(JSON.stringify(opponent));
  
  let turn = 1;
  let autoMode = true;
  
  const g1 = getGuardian(p1.guardianId);
  const g2 = getGuardian(p2.guardianId);
  
  g1.currentHp = g1.hp;
  g2.currentHp = g2.hp;
  
  const aliveCards = team => team.filter(c => c.hp > 0);
  
  const applyPassive = (team, guardian) => {
    team.forEach(card => {
      if (guardian.passiveBonus.attackMultiplier)
        card.attack = Math.round(card.attack * guardian.passiveBonus.attackMultiplier);
    });
  };
  
  // Aplicar passivas iniciais
  applyPassive(p1.cards, g1);
  applyPassive(p2.cards, g2);
  
  while (aliveCards(p1.cards).length > 0 && aliveCards(p2.cards).length > 0 && g1.currentHp > 0 && g2.currentHp > 0 && turn <= 30) {
    log.push(`🕐 **Turno ${turn}**`);
    
    const attacker = turn % 2 === 1 ? p1 : p2;
    const defender = turn % 2 === 1 ? p2 : p1;
    const atkGuardian = turn % 2 === 1 ? g1 : g2;
    const defGuardian = turn % 2 === 1 ? g2 : g1;
    
    const atkCard = aliveCards(attacker.cards)[0];
    const defCard = aliveCards(defender.cards)[0];
    if (!atkCard || !defCard) break;
    
    // 🔹 Antes do ataque — buffs, preparações, ativações
    triggerEffects(attacker, "onAttackStart", log, attacker, defender);
    
    // 🔹 Cálculo de dano
    const dmg = Math.max(1, Math.round(atkCard.attack * (Math.random() * 0.5 + 0.75)));
    const reduced = defender.guardianId === 2 ? Math.round(dmg * 0.85) : dmg;
    
    defCard.hp -= reduced;
    defCard.lastDamage = reduced;
    log.push(`💥 ${atkCard.name} causou ${reduced} de dano em ${defCard.name} (${defCard.hp <= 0 ? "💀 morreu" : defCard.hp + " HP restante"})`);
    
    // 🔹 Efeitos "onHit" (cura, reflexo, etc.)
    triggerEffects(defender, "onHit", log, attacker, defender);
    
    // 🔹 Pós-ataque (burn, bleed, buffs temporários, etc.)
    triggerEffects(attacker, "afterAttack", log, attacker, defender);
    triggerEffects(defender, "afterDefense", log, defender, attacker);
    
    // 🔹 Ataque especial do guardião
    if (turn % atkGuardian.specialTurn === 0) {
      if (atkGuardian.name === "Guardião Solar") {
        defGuardian.currentHp -= 150;
        log.push(`☀️ ${atkGuardian.name} lançou ${atkGuardian.special}! -150 HP no Guardião inimigo`);
      } else if (atkGuardian.name === "Guardião Sombrio") {
        aliveCards(defender.cards).forEach(c => (c.hp -= 50));
        log.push(`🌑 ${atkGuardian.name} lançou ${atkGuardian.special}! -50 HP em todas as cartas inimigas`);
      } else if (atkGuardian.name === "Guardião dos Ventos") {
        atkCard.attack *= 2;
        log.push(`🌪️ ${atkGuardian.name} lançou ${atkGuardian.special}! Dano dobrado no próximo turno`);
      }
    }
    
    // 🔹 Dano contínuo (ex: queimaduras)
    processOverTimeEffects(attacker, log);
    processOverTimeEffects(defender, log);
    
    if (g1.currentHp <= 0 || g2.currentHp <= 0) break;
    
    if (turn >= 20 && autoMode) {
      log.push("⚙️ Ativando modo Skip Automático...");
      break;
    }
    
    turn++;
  }
  
  // Determinar vencedor
  const winner =
    g1.currentHp <= 0 ? "opponent" :
    g2.currentHp <= 0 ? "player" :
    aliveCards(p2.cards).length === 0 ? "player" :
    aliveCards(p1.cards).length === 0 ? "opponent" :
    "draw";
  
  if (winner === "player") log.push(`🏆 ${p1.name} venceu a batalha!`);
  else if (winner === "opponent") log.push(`💀 ${p2.name} venceu a batalha.`);
  else log.push("🤝 A batalha terminou em empate.");
  
  return { log, winner };
}