// src/systems/clanSystem.js
//------------------------------------------------------------
// SISTEMA DE CLÃ — EXPANSÃO COMPLETA
//------------------------------------------------------------

import { spendCurrency, addXP, addGold } from "./economySystem.js";
import { CLAN_DATA_MOCK } from "../data/clanDataMock.js";

//------------------------------------------------------------
// 🔹 Funções Mock
//------------------------------------------------------------
function loadClanData() {
  return JSON.parse(JSON.stringify(CLAN_DATA_MOCK));
}

function saveClanData(data) {
  Object.keys(CLAN_DATA_MOCK).forEach(k => delete CLAN_DATA_MOCK[k]);
  Object.assign(CLAN_DATA_MOCK, data);
}

const genId = () => Math.random().toString(36).substring(2, 8).toUpperCase();
const clanXPReq = lvl => 1000 + lvl * 500;

//------------------------------------------------------------
// 🔥 CONFIG NOVA
//------------------------------------------------------------
const MAX_BASE_MEMBERS = 10;
const MAX_UPGRADES = 5;

const CASTLE_UPGRADES = {
  treasury: { cost: 2000, buff: 0.05 },   // +5% gold ganho pelo clã
  training: { cost: 2500, buff: 0.03 },   // +3% XP dos membros
  shrine:   { cost: 3000, buff: 0.02 },   // +2% dmg no PvP clan war
};

const WEEKLY_QUESTS = [
  { id: "donate_5k", desc: "Doar 5000 ouro ao clã", req: 5000, reward: 20 },
  { id: "kill_50",   desc: "Vencer 50 batalhas", req: 50, reward: 15 },
  { id: "xp_3k",     desc: "Ganhar 3000 XP total", req: 3000, reward: 20 },
];

//------------------------------------------------------------
// 🔥 Criação do Clã
//------------------------------------------------------------
export function createClan(user, name) {
  if (user.clanId) return "❌ Já está em um clã.";
  if (name.length < 3) return "❌ Nome muito curto.";

  const all = loadClanData();
  if (Object.values(all).some(c => c.name.toLowerCase() === name.toLowerCase()))
    return `❌ O clã "${name}" já existe.`;

  if (!spendCurrency(user, "gold", 5000))
    return "💰 Você precisa de 5000 ouro.";

  const clan = {
    id: genId(),
    name,
    level: 1,
    xp: 0,
    gold: 0,
    tokens: 0,
    members: [{
      userId: user.id,
      username: user.username,
      role: "LIDER",
      donated: 0,
      joinedAt: new Date().toISOString()
    }],
    upgrades: { treasury: 0, training: 0, shrine: 0 },
    skills: { passive: "Nenhuma" },
    weekly: WEEKLY_QUESTS.map(q => ({ ...q, progress: 0, done: false })),
    logs: [],
    createdAt: new Date().toISOString(),
    wars: []
  };

  all[clan.id] = clan;
  user.clanId = clan.id;
  saveClanData(all);
  return `🏰 Clã **${name}** criado!`;
}

//------------------------------------------------------------
// 🔥 Entrar no Clã
//------------------------------------------------------------
export function joinClan(user, tag) {
  if (user.clanId) return "❌ Já está em um clã.";
  const all = loadClanData();
  const clan = Object.values(all).find(
    c => c.id === tag.toUpperCase() || c.name.toLowerCase() === tag.toLowerCase()
  );
  if (!clan) return "❌ Clã não encontrado.";

  const cap = MAX_BASE_MEMBERS + clan.level;
  if (clan.members.length >= cap) return "❌ Clã cheio.";

  clan.members.push({
    userId: user.id,
    username: user.username,
    role: "MEMBRO",
    donated: 0,
    joinedAt: new Date().toISOString()
  });

  user.clanId = clan.id;
  saveClanData(all);
  return `🤝 Entrou no clã **${clan.name}**!`;
}

//------------------------------------------------------------
// 🔥 Doação (melhorada) → dá Tokens, XP e progresso de quests
//------------------------------------------------------------
export function donateToClan(user, amount) {
  if (!user.clanId) return "❌ Entre em um clã.";
  if (amount <= 0) return "❌ Quantia inválida.";

  const all = loadClanData();
  const clan = all[user.clanId];
  if (!clan) return "❌ Clã não encontrado.";

  if (!spendCurrency(user, "gold", amount))
    return "💰 Ouro insuficiente.";

  const xp = Math.floor(amount / 10);
  clan.gold += amount;
  clan.xp += xp;
  clan.tokens += Math.floor(amount / 500);

  const m = clan.members.find(m => m.userId === user.id);
  m.donated += amount;

  // progresso em quests
  const q = clan.weekly.find(q => q.id === "donate_5k");
  if (q && !q.done) {
    q.progress += amount;
    if (q.progress >= q.req) {
      q.done = true;
      clan.tokens += q.reward;
    }
  }

  // level up
  let msg = "";
  while (clan.xp >= clanXPReq(clan.level)) {
    clan.xp -= clanXPReq(clan.level);
    clan.level++;
    msg += `\n⬆️ Clã subiu para **Nível ${clan.level}**!`;
  }

  clan.logs.push({
    type: "donation",
    user: user.username,
    amount,
    date: new Date().toISOString()
  });

  saveClanData(all);
  return `💖 Doou **${amount} ouro** (+${xp} XP)!${msg}`;
}

//------------------------------------------------------------
// 🔥 Upgrades do Castelo
//------------------------------------------------------------
export function upgradeClanBuilding(user, building) {
  if (!user.clanId) return "❌ Entre em um clã.";
  const all = loadClanData();
  const clan = all[user.clanId];

  const data = CASTLE_UPGRADES[building];
  if (!data) return "❌ Upgrade inválido.";
  if (clan.upgrades[building] >= MAX_UPGRADES)
    return "❌ Este upgrade está no máximo.";

  const cost = data.cost * (clan.upgrades[building] + 1);
  if (clan.tokens < cost) return "❌ Tokens insuficientes.";

  clan.tokens -= cost;
  clan.upgrades[building]++;
  clan.logs.push({
    type: "upgrade",
    building,
    level: clan.upgrades[building],
    date: new Date().toISOString()
  });

  saveClanData(all);
  return `🛠️ ${building} agora é **Nível ${clan.upgrades[building]}**!`;
}

//------------------------------------------------------------
// 🔥 Iniciar guerra entre clãs (PvP entre membros)
//------------------------------------------------------------
export function startClanWar(user, targetTag) {
  if (!user.clanId) return "❌ Sem clã.";
  const all = loadClanData();
  const clanA = all[user.clanId];
  const clanB = Object.values(all).find(c => c.id === targetTag);

  if (!clanB) return "❌ Clã alvo inexistente.";
  if (clanA.id === clanB.id) return "❌ Não pode guerrear consigo.";

  const war = {
    id: genId(),
    clans: [clanA.id, clanB.id],
    score: { [clanA.id]: 0, [clanB.id]: 0 },
    startedAt: new Date().toISOString()
  };

  clanA.wars.push(war);
  clanB.wars.push(war);
  saveClanData(all);

  return `⚔️ Guerra iniciada entre **${clanA.name}** e **${clanB.name}**!`;
}

//------------------------------------------------------------
// 🔥 Info do Clã
//------------------------------------------------------------
export function getClanInfo(tag) {
  const all = loadClanData();
  const clan = Object.values(all).find(
    c => c.id === tag.toUpperCase() || c.name.toLowerCase() === tag.toLowerCase()
  );
  if (!clan) return "❌ Clã não existe.";

  const cap = MAX_BASE_MEMBERS + clan.level;
  const members = clan.members
    .sort((a, b) => b.donated - a.donated)
    .map(m => ` • ${m.role === "LIDER" ? "👑" : "🔸"} ${m.username} (${m.donated}G)`);

  return `
🏰 **${clan.name} [${clan.id}]**
Nível: ${clan.level}
XP: ${clan.xp}/${clanXPReq(clan.level)}
Gold: ${clan.gold} | Tokens: ${clan.tokens}
Membros: ${clan.members.length}/${cap}

🛠️ Upgrades:
${Object.entries(clan.upgrades).map(([k,v]) => ` - ${k}: Nível ${v}`).join("\n")}

📜 Quests Semanais:
${clan.weekly.map(q => ` - ${q.desc}: ${q.progress}/${q.req} ${q.done ? "✔" : ""}`).join("\n")}

👥 Membros:
${members.join("\n")}
`;
}

//------------------------------------------------------------
// 🔥 Ranking
//------------------------------------------------------------
export function getClanRankings() {
  const all = loadClanData();
  return Object.values(all)
    .sort((a,b) => b.level - a.level || b.xp - a.xp)
    .slice(0, 10);
}