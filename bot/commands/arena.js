// src/commands/arena.js
import { SlashCommandBuilder } from "discord.js";
import { arenaStatus, arenaChallenge, arenaReward } from "../../src/systems/arenaSystem.js";

// Exporta named exports para garantir compatibilidade
export const data = new SlashCommandBuilder()
    .setName("arena")
    .setDescription("Comandos da Arena PvP")
    .addStringOption(option =>
        option.setName("acao")
            .setDescription("O que deseja fazer")
            .setRequired(true)
            .addChoices(
                { name: "Status", value: "status" },
                { name: "Desafiar", value: "challenge" },
                { name: "Baú", value: "reward" }
            )
    )
    .addIntegerOption(option =>
        option.setName("oponente")
            .setDescription("Número do oponente (apenas para desafiar)")
            .setRequired(false)
    );

export async function execute(interaction, client, user) {
    const acao = interaction.options.getString("acao");
    const oponente = interaction.options.getInteger("oponente");

    try {
        switch (acao) {
            case "status": {
                const msg = arenaStatus(user);
                return interaction.reply({ content: msg, ephemeral: true });
            }
            case "challenge": {
                if (!oponente) return interaction.reply({ content: "⚠️ Informe o número do oponente.", ephemeral: true });
                const msg = await arenaChallenge(user, oponente);
                return interaction.reply({ content: msg });
            }
            case "reward": {
                const msg = arenaReward(user);
                return interaction.reply({ content: msg });
            }
            default:
                return interaction.reply({ content: "⚠️ Ação inválida.", ephemeral: true });
        }
    } catch (err) {
        return interaction.reply({ content: `❌ ${err.message}`, ephemeral: true });
    }
}