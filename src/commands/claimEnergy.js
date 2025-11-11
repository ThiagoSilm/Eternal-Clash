// src/commands/claimEnergy.js
import { claimDailyEnergy } from "../systems/dailyEnergySystem.js";

export function claimEnergyCommand() {
  console.log(claimDailyEnergy("Player"));
}