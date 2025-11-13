// src/systems/towerSystem.js
import { loadUser, saveUser } from "./userCacheSystem.js";
import { battle } from "./battleSystem.js";
import { giveCardToUser } from "./cardSystem.js";

/**
 * Inicializa ou reseta a torre do jogador
 */
export function initTower(user) {
  if (!user.tower) {
    user.tower = {
      currentFloor: 1,
      attemptsLeft: 3,
      rewardsCollected: [],
    };
    saveUser(user);
  }
  return user.tower;
}

/**
 * Reseta as tentativas diárias da torre
 */
export function resetTowerAttempts(user) {
  if (!user.tower) initTower(user);
  user.tower.attemptsLeft = 3;
  saveUser(user);
}

/**
 * Avança uma tentativa na torre
 * @param {Object} user 
 * @param {Number} floorsToAdvance 
 */
export function attemptTower(user, floorsToAdvance = 1) {
  if (!user.tower) initTower(user);
  
  if (user.tower.attemptsLeft <= 0)
    return "⚠️ Você não tem tentativas restantes para hoje.";
  
  const startFloor = user.tower.currentFloor;
  const maxFloor = 120;
  const floors = Math.min(floorsToAdvance, maxFloor - startFloor + 1);
  
  let totalXP = 0;
  let totalGold = 0;
  let cardsWon = [];
  
  for (let i = 0; i < floors; i++) {
    const floorNum = startFloor + i;
    
    // Calcula força do inimigo (força aumenta gradualmente)
    const enemyForce = 500 + floorNum * 50; // exemplo
    const playerForce = user.decks.main.reduce((acc, card) => acc + card.attack, 0);
    
    // Chama battleSystem para simular batalha
    const battleResult = battle(user.decks.main, { force: enemyForce });
    
    if (battleResult.win) {
      // Recompensas por casa
      const xp = 50 + floorNum * 5;
      const gold = 100 + floorNum * 10;
      
      totalXP += xp;
      totalGold += gold;
      
      // A cada 5 casas, recompensa extra
      if (floorNum % 5 === 0) {
        totalGold += 200;
        totalXP += 100;
        
        // Chance de carta e gema
        if (Math.random() < 0.5) {
          const card = giveCardToUser(user, Math.floor(Math.random() * 200) + 1); // exemplo
          cardsWon.push(card.name);
        }
        if (Math.random() < 0.3) {
          user.gems = (user.gems || 0) + 1;
        }
      }
      
      user.tower.currentFloor++;
    } else {
      // Se perder, para no último piso vencido
      break;
    }
  }
  
  user.tower.attemptsLeft--;
  saveUser(user);
  
  return `🏯 Torre: Avançou da casa ${startFloor} para ${user.tower.currentFloor - 1}.\n💰 Ouro ganho: ${totalGold}\n✨ XP ganho: ${totalXP}\n🎴 Cartas: ${cardsWon.join(", ") || "Nenhuma"}\n🟢 Tentativas restantes: ${user.tower.attemptsLeft}`;
}

/**
 * Visualiza progresso da torre
 */
export function viewTower(user) {
  if (!user.tower) initTower(user);
  return `🏯 Torre - Casa atual: ${user.tower.currentFloor}\n🟢 Tentativas restantes: ${user.tower.attemptsLeft}`;
}