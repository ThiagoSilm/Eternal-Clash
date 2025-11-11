// src/commands/events.js
import { claimDaily, getDailyStatus } from "../systems/dailySystem.js";
import { dailyDraw } from "../systems/drawSystem.js";

export function eventCommand(args) {
  const sub = args[0];
  const username = "Player"; // no bot real, será dinâmico
  
  switch (sub) {
    case "login":
      console.log(claimDaily(username));
      break;
    case "status":
      console.log(getDailyStatus(username));
      break;
    case "sorteio":
      console.log(dailyDraw(username));
      break;
    default:
      console.log("🎁 Comandos de Evento:\n!evento login — Coletar recompensa diária\n!evento status — Ver sequência de login\n!evento sorteio — Girar a sorte do dia");
  }
}