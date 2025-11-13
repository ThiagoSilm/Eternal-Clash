// src/systems/clanSystem.js

import { spendCurrency, addXp } from "./economySystem.js";
// Usaremos um 'mock' para o sistema de dados de clã, que deve ser persistente (como um arquivo clans.json ou um banco de dados)
import { CLAN_DATA_MOCK } from "../data/clanDataMock.js"; // Novo arquivo mock

// ----------------------------------------------------
// 🔹 FUNÇÕES DE DADOS (MOCK) (Inalteradas)
// ----------------------------------------------------

/** Carrega todos os dados dos clãs (mock) */
function loadClanData() {
  // Retorna uma cópia profunda para evitar modificação do mock original
  return JSON.parse(JSON.stringify(CLAN_DATA_MOCK));
}

/** Salva os dados dos clãs (mock) */
function saveClanData(data) {
  // Em uma aplicação real, salvaria no disco/DB.
  // Aqui, apenas atualizamos o mock para simular a persistência durante a sessão.
  Object.keys(CLAN_DATA_MOCK).forEach(key => delete CLAN_DATA_MOCK[key]);
  Object.assign(CLAN_DATA_MOCK, data);
}

/** Helpers */
function generateClanId() {
  return Math.random().toString(36).substring(2, 9).toUpperCase();
}

function getClanXpToLevelUp(level) {
  return 1000 + (level * 500);
}

// ----------------------------------------------------
// 🔹 LÓGICA DO SISTEMA DE CLÃS
// ----------------------------------------------------

/**
 * Cria um novo clã. (Inalterada)
 * @param {object} user O objeto usuário.
 * @param {string} clanName O nome do clã.
 * @returns {string} Mensagem de resposta.
 */
export function createClan(user, clanName) {
  if (user.clanId) {
    return "❌ Você já é membro de um clã. Saia dele primeiro.";
  }
  if (clanName.length < 3) {
    return "❌ O nome do clã deve ter pelo menos 3 caracteres.";
  }
  
  const allClans = loadClanData();
  const normalizedName = clanName.toLowerCase();
  
  // Checar se o nome já existe
  if (Object.values(allClans).some(c => c.name.toLowerCase() === normalizedName)) {
    return `❌ O clã "${clanName}" já existe. Escolha outro nome.`;
  }
  
  // Custo de criação (ex: 5000 Ouro)
  const creationCost = 5000;
  // 🎯 Usa spendCurrency (lança erro se falhar, ou retorna false se não usar throw)
  if (!spendCurrency(user, 'gold', creationCost)) {
    return `💰 Você precisa de ${creationCost} Ouro para criar um clã.`;
  }
  
  const newClan = {
    id: generateClanId(),
    name: clanName,
    level: 1,
    xp: 0,
    gold: 0,
    members: [{
      userId: user.id,
      username: user.username || "Jogador",
      role: "LIDER",
      donated: 0,
      joinedAt: new Date().toISOString(), // Adiciona joinedAt para consistência
    }],
    createdAt: new Date().toISOString(),
  };
  
  allClans[newClan.id] = newClan;
  user.clanId = newClan.id; 
  saveClanData(allClans);
  
  return `🎉 Clã **${clanName}** criado com sucesso! Você é o LÍDER. ${creationCost} Ouro gasto.`;
}

/**
 * Entra em um clã existente. (Inalterada, adicionado joinedAt)
 * @param {object} user O objeto usuário.
 * @param {string} clanNameOrId O nome ou ID do clã.
 * @returns {string} Mensagem de resposta.
 */
export function joinClan(user, clanNameOrId) {
  if (user.clanId) {
    return "❌ Você já é membro de um clã.";
  }
  if (!clanNameOrId) {
    return "❌ Informe o nome ou ID do clã para entrar.";
  }
  
  const allClans = loadClanData();
  const targetClan = Object.values(allClans).find(c =>
    c.name.toLowerCase() === clanNameOrId.toLowerCase() || c.id === clanNameOrId.toUpperCase()
  );
  
  if (!targetClan) {
    return `❌ Clã "${clanNameOrId}" não encontrado.`;
  }
  
  // Lógica de limite de membros (ex: 10 membros por clã)
  if (targetClan.members.length >= 10) {
    return "❌ O clã está cheio. Tente outro.";
  }
  
  targetClan.members.push({
    userId: user.id,
    username: user.username || "Jogador",
    role: "MEMBRO",
    donated: 0,
    joinedAt: new Date().toISOString(), // Adiciona joinedAt
  });
  
  user.clanId = targetClan.id;
  saveClanData(allClans);
  
  return `🤝 Você entrou no clã **${targetClan.name}**!`;
}

/**
 * Sai do clã atual do usuário.
 * @param {object} user O objeto usuário.
 * @returns {string} Mensagem de resposta.
 */
export function leaveClan(user) {
  if (!user.clanId) {
    return "❌ Você não é membro de nenhum clã.";
  }
  
  const allClans = loadClanData();
  const targetClan = allClans[user.clanId];
  
  if (!targetClan) {
    user.clanId = null; // Limpa o ID se o clã não for encontrado (segurança)
    return "⚠️ Erro: Seu clã não foi encontrado. Membro removido do seu perfil.";
  }
  
  const wasLeader = targetClan.members.find(m => m.userId === user.id)?.role === "LIDER";
  
  // Remove o usuário da lista de membros
  targetClan.members = targetClan.members.filter(m => m.userId !== user.id);
  
  // Se o usuário era o líder e era o último membro, o clã é deletado
  if (targetClan.members.length === 0) {
    delete allClans[user.clanId];
    user.clanId = null;
    saveClanData(allClans);
    return `👋 Você saiu do clã **${targetClan.name}**. O clã foi dissolvido.`;
  }
  
  // 🎯 CORREÇÃO: Se o usuário era o líder, transfere a liderança para o membro restante mais antigo
  if (wasLeader) {
    // Ordena pelo 'joinedAt' (mais antigo primeiro) para escolher o novo líder
    targetClan.members.sort((a, b) => new Date(a.joinedAt) - new Date(b.joinedAt));
    
    // O primeiro membro remanescente é o novo líder
    const newLeader = targetClan.members[0];
    newLeader.role = "LIDER";
    
    saveClanData(allClans);
    return `👋 Você saiu do clã **${targetClan.name}**. A liderança foi transferida para ${newLeader.username}.`;
  }
  
  user.clanId = null;
  saveClanData(allClans);
  return `👋 Você saiu do clã **${targetClan.name}**.`;
}

/**
 * Doa recursos para o clã. (Inalterada)
 * @param {object} user O objeto usuário.
 * @param {number} amount A quantia de ouro a doar.
 * @returns {string} Mensagem de resposta.
 */
export function donateToClan(user, amount) {
  if (!user.clanId) {
    return "❌ Você deve pertencer a um clã para doar.";
  }
  if (amount <= 0) {
    return "❌ A quantia deve ser positiva.";
  }
  
  const allClans = loadClanData();
  const targetClan = allClans[user.clanId];
  
  if (!targetClan) {
    user.clanId = null;
    return "⚠️ Clã não encontrado. Seu perfil foi corrigido.";
  }
  
  // Custo/Recurso da doação: usaremos Ouro
  // 🎯 Usa spendCurrency (lança erro se falhar, ou retorna false se não usar throw)
  if (!spendCurrency(user, 'gold', amount)) {
    return `💰 Você não tem ${amount} Ouro para doar.`;
  }
  
  // 1. Atualiza XP e Nível do Clã
  targetClan.gold += amount;
  const xpGain = Math.floor(amount / 10); // 10% do ouro em XP
  targetClan.xp += xpGain;
  
  // Lógica de Subida de Nível (loop para garantir subidas múltiplas)
  let levelUpMessage = "";
  while (targetClan.xp >= getClanXpToLevelUp(targetClan.level)) {
    const requiredXp = getClanXpToLevelUp(targetClan.level);
    targetClan.xp -= requiredXp;
    targetClan.level += 1;
    levelUpMessage += `\n🎉 **${targetClan.name}** subiu para o Nível ${targetClan.level}!`;
  }
  
  // 2. Atualiza o registro do membro
  const member = targetClan.members.find(m => m.userId === user.id);
  if (member) {
    member.donated += amount;
  }
  
  saveClanData(allClans);
  return `💖 Você doou **${amount} Ouro** ao clã **${targetClan.name}**.\nClã ganhou **${xpGain} XP**!${levelUpMessage}`;
}

/**
 * Obtém informações detalhadas de um clã. (Inalterada)
 * @param {string} clanNameOrId O nome ou ID do clã.
 * @returns {string} Mensagem de resposta.
 */
export function getClanInfo(clanNameOrId) {
  const allClans = loadClanData();
  const targetClan = Object.values(allClans).find(c =>
    c.name.toLowerCase() === clanNameOrId.toLowerCase() || c.id === clanNameOrId.toUpperCase()
  );
  
  if (!targetClan) {
    return `❌ Clã "${clanNameOrId}" não encontrado.`;
  }
  
  const membersList = targetClan.members
    // 🎯 Ordena: Líder primeiro, depois por doação
    .sort((a, b) => {
        if (a.role === 'LIDER' && b.role !== 'LIDER') return -1;
        if (b.role === 'LIDER' && a.role !== 'LIDER') return 1;
        return b.donated - a.donated;
    })
    .map(m => ` • ${m.role === 'LIDER' ? '👑' : '🔸'} ${m.username} (Doado: ${m.donated} G)`)
    .join('\n');
  
  const xpNeeded = getClanXpToLevelUp(targetClan.level);
  
  return `
🏰 **Informações do Clã ${targetClan.name} [${targetClan.id}]**
---
✨ **Nível:** ${targetClan.level}
⭐ **XP:** ${targetClan.xp}/${xpNeeded}
💰 **Tesouro:** ${targetClan.gold} Ouro
👥 **Membros:** ${targetClan.members.length}/10

**Membros (Líder/Doação):**
${membersList}
`;
}

/**
 * Obtém o ranking global de clãs (TOP 10). (Inalterada)
 * @returns {Array<object>} Lista de clãs ranqueados.
 */
export function getClanRankings() {
  const allClans = loadClanData();
  
  return Object.values(allClans)
    .sort((a, b) => {
      // Critério: 1. Nível, 2. XP total
      if (b.level !== a.level) return b.level - a.level;
      return b.xp - a.xp;
    })
    .slice(0, 10);
}
