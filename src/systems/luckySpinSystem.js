// src/systems/luckySpinSystem.js

// 1. IMPORTAÇÕES CORRIGIDAS (Usando os sistemas modulares)
import { loadUser, saveUserData } from "./userSystem.js"; // Ciclo de vida do usuário
import { addGold, addXP, addGems, spendGold } from "./economySystem.js"; // Economia
import { giveCardToUser, getCardList } from "./cardSystem.js"; // Funções de Cartas
import { getRandomCardIdByRarity } from "./summonSystem.js"; // Assumindo uma função de RNG de alto nível
// import boosters from "../data/boosters.json" assert { type: "json" }; // Removido para centralizar RNG no SummonSystem

// --- CONFIGURAÇÕES E ITENS (MANTIDAS) ---
const spinItemsNormal = [
  { type: "gold", value: 200, chance: 25 },
  { type: "gold", value: 500, chance: 20 },
  { type: "xp", value: 100, chance: 20 },
  { type: "xp", value: 250, chance: 10 },
  { type: "card", value: 3, chance: 20 }, // Valor alterado para Rarity 3
  { type: "gems", value: 1, chance: 5 }
];

const spinItemsMega = [
  { type: "gold", value: 500, chance: 15 },
  { type: "gold", value: 1000, chance: 10 },
  { type: "xp", value: 200, chance: 15 },
  { type: "xp", value: 500, chance: 10 },
  { type: "card", value: 4, chance: 25 }, // Valor alterado para Rarity 4
  { type: "gems", value: 5, chance: 10 },
  { type: "lottery", value: null, chance: 10 },
  { type: "guardian", value: null, chance: 5 }
];

// --- HELPERS ---

function rollItem(items) {
  const roll = Math.random() * 100;
  let accumulated = 0;
  for (const item of items) {
    accumulated += item.chance;
    if (roll <= accumulated) return item;
  }
  return items[0];
}

// Assumindo que o CardSystem tem a lista de guardians (filtrada ou não)
function getAllGuardianIds() {
    // Para simplificar, assumimos que guardians são cartas de ID alto ou tipo específico
    const allCards = getCardList(); 
    return allCards.filter(c => c.type === 'guardian').map(g => g.id);
}


function executeSpin(userId, user, isMega = false) {
  const items = isMega ? spinItemsMega : spinItemsNormal;
  const selected = rollItem(items);
  let message = "";
  let levelUpMsg = null; // Para capturar a mensagem de Level Up do XP

  switch (selected.type) {
    case "gold":
      addGold(userId, selected.value); // 1. CORREÇÃO: Usa addGold
      message = `${selected.value} de ouro 💰`;
      break;
    case "xp":
      levelUpMsg = addXP(userId, selected.value); // 1. CORREÇÃO: Usa addXP (capturando Level Up)
      message = `${selected.value} XP ✨`;
      break;
    case "gems":
      addGems(userId, selected.value); // 1. CORREÇÃO: Usa addGems
      message = `${selected.value} gema(s) 💎`;
      break;
    case "card":
      // 3. CORREÇÃO: RNG simplificado para usar a Raridade do item como valor.
      const rarity = selected.value || 3;
      // Assume-se que getRandomCardIdByRarity (do SummonSystem) escolhe a carta
      const cardId = getRandomCardIdByRarity(rarity); 
      const card = giveCardToUser(user, cardId); 
      message = `Carta: ${card.name} (${rarity}★) 🎴`;
      break;
    case "lottery":
      if (Math.random() < 0.5) {
        // Carta R5 garantida
        const cardId5 = getRandomCardIdByRarity(5); 
        const card5 = giveCardToUser(user, cardId5);
        message = `🎰 Loteria! Carta 5★: ${card5.name}`;
      } else {
        const gemsPrize = 50;
        addGems(userId, gemsPrize); // 1. CORREÇÃO: Usa addGems
        message = `🎰 Loteria! ${gemsPrize} gemas 💎`;
      }
      break;
    case "guardian":
      const allGuardians = getAllGuardianIds();
      // Filtragem correta: apenas guardians que o usuário não possui
      const available = allGuardians.filter(gId => !user.guardians?.includes(gId)); 
      
      if (available.length === 0) {
        message = "Nenhum Guardian disponível para receber 😅";
      } else {
        const guardianId = available[Math.floor(Math.random() * available.length)];
        if (!user.guardians) user.guardians = [];
        user.guardians.push(guardianId);
        message = `🛡️ Guardian obtido (ID: ${guardianId})!`;
      }
      break;
    default:
        message = "Nenhum item válido foi sorteado 🤨";
  }

  // Se houve Level Up, anexa a mensagem
  if (levelUpMsg) {
      message += `\n${levelUpMsg}`;
  }

  return message;
}

export function spinLucky(userId, count = 1) {
  const user = loadUser(userId); // 3. CORREÇÃO: Usa loadUser do userSystem
  
  if (!user.luckySpinCount) user.luckySpinCount = 0;
  const messages = [];
  
  // 2. CORREÇÃO: Checa e gasta ouro corretamente.
  const cost = 100;

  for (let i = 0; i < count; i++) {
    const isMega = (user.luckySpinCount + 1) % 10 === 0;
    
    if (!isMega) {
        // Checa e tenta gastar ouro. Se falhar, quebra o loop.
        if (!spendGold(userId, cost)) {
             messages.push("💰 Ouro insuficiente para continuar girando.");
             break;
        }
    }

    const msg = executeSpin(userId, user, isMega);
    messages.push(isMega ? `🌟 Mega Spin! ${msg}` : `🎉 Spin! ${msg}`);
    user.luckySpinCount += 1;
  }

  const spinsLeft = 10 - (user.luckySpinCount % 10);
  messages.push(`---`);
  messages.push(`🌀 Giros até o próximo Mega Spin: ${spinsLeft}`);

  saveUserData(user); // 3. CORREÇÃO: Usa saveUserData do userSystem
  return messages.join("\n");
}
