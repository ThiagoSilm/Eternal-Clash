// src/commands/clan.js
import { createClan, joinClan, leaveClan, donateToClan, getClanInfo } from "../systems/clanSystem.js";

export function clanCommand(args) {
  const sub = args[0];
  const username = "Player"; // trocar pelo username real no bot
  
  switch (sub) {
    case "criar":
      console.log(createClan(username, args.slice(1).join(" ")));
      break;
    case "entrar":
      console.log(joinClan(username, args.slice(1).join(" ")));
      break;
    case "sair":
      console.log(leaveClan(username));
      break;
    case "doar":
      console.log(donateToClan(username, parseInt(args[1])));
      break;
    case "info":
      console.log(getClanInfo(args.slice(1).join(" ")));
      break;
    default:
      console.log("🏰 Comandos do Clã:\n!clan criar <nome>\n!clan entrar <nome>\n!clan sair\n!clan doar <quantia>\n!clan info <nome>");
  }
}