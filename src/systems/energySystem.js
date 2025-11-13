// src/systems/energySystem.js

// Exemplo de dados do usuário
// user = { id, energy, maxEnergy }

export function getEnergyStatus(user) {
  const { energy, maxEnergy } = user;

  return `🔋 Energia atual: ${energy}/${maxEnergy}`;
}