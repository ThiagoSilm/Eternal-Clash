import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { fuseCards, levelUpCard } from "../../src/systems/xpSystem.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const usersPath = path.join(__dirname, "../../users/");

export default {
  name: "upgrade",
  description: "Funde ou evolui cartas do jogador.",
  async execute(message, args = []) {
    const userId = message.author.id;
    const userFile = path.join(usersPath, `${userId}.json`);
    
    if (!fs.existsSync(userFile)) {
      await message.reply("❌ Usuário não encontrado.");
      return;
    }
    
    const user = JSON.parse(fs.readFileSync(userFile, "utf-8"));
    const [action, baseIdRaw, sacrificeIdRaw] = args;
    
    if (!action) {
      await message.reply("❌ Uso inválido. Use `!upgrade fuse <cartaBaseId> <cartaSacrifícioId>` ou `!upgrade levelup <cartaId>`.");
      return;
    }
    
    let response = "";
    let updated = false;
    
    switch (action.toLowerCase()) {
      case "fuse": {
        if (!baseIdRaw || !sacrificeIdRaw) {
          response = "❌ Use: `!upgrade fuse <cartaBaseId> <cartaSacrifícioId>`";
          break;
        }
        const result = fuseCards(user, baseIdRaw, sacrificeIdRaw);
        response = result.message;
        updated = result.success;
        break;
      }
      
      case "levelup": {
        if (!baseIdRaw) {
          response = "❌ Use: `!upgrade levelup <cartaId>`";
          break;
        }
        const result = levelUpCard(user, baseIdRaw);
        response = result.message;
        updated = result.success;
        break;
      }
      
      default:
        response = "❌ Comando inválido. Use `!upgrade fuse <cartaBaseId> <cartaSacrifícioId>` ou `!upgrade levelup <cartaId>`";
    }
    
    if (updated) {
      fs.writeFileSync(userFile, JSON.stringify(user, null, 2));
      response = "✅ " + response;
    }
    
    await message.reply(response);
  }
};