// src/commands/inventory.js
import { listInventory } from "../systems/inventorySystem.js";

export function inventoryCommand() {
  console.log(listInventory("Player"));
}