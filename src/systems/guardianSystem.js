// src/systems/guardianSystem.js
//------------------------------------------------------------
// Guardian System - Gerenciamento de Guardiões
// Compatível com battleSystem e outros sistemas de combate
//------------------------------------------------------------

// ------------------ TEMPLATES DE GUARDIÕES ------------------
const GUARDIANS = [
  {
    id: "g001",
    name: "Fire Sentinel",
    level: 1,
    maxHp: 200,
    startEnergy: 0,
    energyMax: 100,
    passive: ["burnAura"], // efeito passivo
    active: {
      name: "Flame Strike",
      cost: 30,
      cooldown: 3,
      summon: { name: "Fire Elemental", hp: 50, atk: 20, turns: 3 }
    },
    ultimate: {
      name: "Inferno",
      cost: 100,
      summon: { name: "Inferno Spirit", hp: 100, atk: 50, turns: 2 },
      chargePerTurn: 10
    },
    effects: []
  },
  {
    id: "g002",
    name: "Ice Guardian",
    level: 1,
    maxHp: 180,
    startEnergy: 0,
    energyMax: 100,
    passive: ["slowAura"],
    active: {
      name: "Frost Shield",
      cost: 25,
      cooldown: 2,
      summon: { name: "Ice Shard", hp: 30, atk: 10, turns: 4 }
    },
    ultimate: {
      name: "Glacial Storm",
      cost: 100,
      summon: { name: "Glacier Titan", hp: 120, atk: 40, turns: 2 },
      chargePerTurn: 10
    },
    effects: []
  }
  // adicione mais guardiões aqui conforme necessário
];

// ------------------ FUNÇÃO GET GUARDIAN ------------------
/**
 * Retorna o template de guardião pelo ID
 * @param {string} id 
 * @returns {Object|null} Template do guardião
 */
export function getGuardian(id) {
  if (!id) return null;
  return GUARDIANS.find(g => g.id === id) || null;
}

// ------------------ FUNÇÃO PARA CRIAR INSTÂNCIA ------------------
/**
 * Cria uma instância de guardião para o combate
 * @param {string|Object} template - ID ou template direto
 * @param {string} ownerRole - "player" ou "enemy"
 */
export function createGuardian(template, ownerRole) {
  if (!template) return null;
  if (typeof template === "string") template = getGuardian(template);
  if (!template) return null;

  return {
    id: template.id,
    name: template.name || "Guardian",
    owner: ownerRole,
    level: template.level || 1,
    hp: template.maxHp || 0,
    maxHp: template.maxHp || 0,
    energy: template.startEnergy || 0,
    energyMax: template.energyMax || 100,
    passive: template.passive || [],
    active: template.active || null,
    ultimate: template.ultimate || null,
    cooldown: 0,
    ultimateCharge: 0,
    summons: [],
    effects: template.effects || []
  };
}