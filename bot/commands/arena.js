// src/commands/arena.js
import { arenaStatus, arenaChallenge, arenaReward } from "../../src/systems/arenaSystem.js";

export default {
    name: "arena",
    description: "Comandos da Arena PvP: status, desafiar, baú",
    usage: "[status | challenge <oponente> | reward]",
    async execute(message, args, user) {
        const acao = args[0]?.toLowerCase();
        const oponente = args[1] ? parseInt(args[1]) : undefined;
        
        try {
            if (!acao) return message.reply("⚠️ Use: !arena status | challenge <oponente> | reward");
            
            if (acao === "status") {
                const msg = arenaStatus(user);
                return message.reply(msg);
            }
            
            if (acao === "challenge") {
                if (!oponente) return message.reply("⚠️ Informe o número do oponente.");
                const msg = await arenaChallenge(user, oponente);
                return message.reply(msg);
            }
            
            if (acao === "reward") {
                const msg = arenaReward(user);
                return message.reply(msg);
            }
            
            return message.reply("⚠️ Ação inválida. Use: status, challenge ou reward.");
        } catch (err) {
            return message.reply(`❌ ${err.message}`);
        }
    }
};