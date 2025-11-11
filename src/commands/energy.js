// src/commands/energy.js
import { getEnergyStatus } from "../systems/energySystem.js";

export function energyCommand() {
  console.log(getEnergyStatus("Player"));
}