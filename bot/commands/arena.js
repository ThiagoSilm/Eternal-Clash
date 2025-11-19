// src/commands/arena.js
import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { arenaStatus, arenaChallenge, arenaReward } from "../../src/systems/arenaSystem.js";

export default {
    data: new SlashCommandBuilder()
        .setName("arena")
        .setDescription("Comandos da Arena PvP: status, desafiar oponentes e coletar recompensas")
        .addStringOption(option =>
            option.setName("acao")
                .setDescription("O que deseja fazer")
                .setRequired(true)
                .addChoices(
                    { name: "Status", value: "status" },
                    { name: "Desafiar", value: "challenge" },
                    { name: "Baú", value: "reward" }
                ))
        .addIntegerOption(option =>
            option.setName("oponente")
                .setDescription("Número do oponente (para desafiar)")
                .setRequired(false)),
    async execute(interaction, client, user) {
        const acao = interaction.options.getString("acao");
        const oponente = interaction.options.getInteger("oponente");

        try {
            if (acao === "status") {
                const statusMsg = arenaStatus(user);
                return interaction.reply({ content: statusMsg, ephemeral: true });
            }

            if (acao === "challenge") {
                if (!oponente) {
                    return interaction.reply({ content: "⚠️ Você precisa informar o número do oponente.", ephemeral: true });
                }
                const battleMsg = await arenaChallenge(user, oponente);
                return interaction.reply({ content: battleMsg });
            }

            if (acao === "reward") {
                const rewardMsg = arenaReward(user);
                return interaction.reply({ content: rewardMsg });
            }

        } catch (err) {
            return interaction.reply({ content: `❌ ${err.message}`, ephemeral: true });
        }
    }
};