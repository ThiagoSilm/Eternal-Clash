// src/commands/arena.js
import { arenaChallenge, arenaStatus, arenaReward } from "../systems/arenaSystem.js";

export function arenaCommand(args) {
  const username = "Player"; // no bot real, será dinâmico
  const sub = args[0];
  const target = args[1];
  
  switch (sub) {
    case "status":
      console.log(arenaStatus(username));
      break;
    case "lutar":
      if (!target) return console.log("⚔️ Use: !arena lutar <nomeDoOponente>");
      console.log(arenaChallenge(username, target));
      break;
    case "recompensa":
      console.log(arenaReward(username));
      break;
    default:
      console.log("🏆 Comandos da Arena:\n!arena status — Ver seu rank e pontos\n!arena lutar <nome> — Desafiar outro jogador\n!arena recompensa — Receber bônus do seu rank");
  }
}