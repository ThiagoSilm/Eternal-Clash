// src/commands/tower.js
import { enterTower, getTowerStatus } from "../systems/towerSystem.js";

export function towerCommand(args) {
  const sub = args[0];
  const username = "Player"; // substituir no bot real
  
  switch (sub) {
    case "entrar":
      console.log(enterTower(username));
      break;
    case "resetar":
      console.log(resetTower(username));
      break;
    case "status":
      console.log(getTowerStatus(username));
      break;
    default:
      console.log("🗼 Comandos da Tower:\n!tower entrar — Desafiar o andar atual\n!tower resetar — Voltar ao início\n!tower status — Ver seu progresso");
  }
}