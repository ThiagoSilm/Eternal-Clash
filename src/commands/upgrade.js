// src/commands/upgrade.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { fuseCards, levelUpCard } from "../systems/xpSystem.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const usersPath = path.join(__dirname, "../../users/");

export async function handleUpgrade(userId, args = []) {
  const userFile = path.join(usersPath, `${userId}.json`);
  if (!fs.existsSync(userFile)) {
    console.log("Usuário não encontrado.");
    return;
  }

  const user = JSON.parse(fs.readFileSync(userFile, "utf-8"));
  const [action, baseId, sacrificeId] = args;

  switch (action) {
    case "fuse": {
      const result = fuseCards(user, baseId, sacrificeId);
      if (result.success) {
        fs.writeFileSync(userFile, JSON.stringify(user, null, 2));
        console.log(`🔥 ${result.message}`);
      } else {
        console.log(result.message);
      }
      break;
    }

    case "levelup": {
      const result = levelUpCard(user, baseId);
      if (result.success) {
        fs.writeFileSync(userFile, JSON.stringify(user, null, 2));
        console.log(`✨ ${result.message}`);
      } else {
        console.log(result.message);
      }
      break;
    }

    default:
      console.log("Uso: !upgrade fuse <cartaBaseId> <cartaSacrifícioId> | !upgrade levelup <cartaId>");
  }
}