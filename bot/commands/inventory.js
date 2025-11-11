import { listInventory } from "../../src/systems/inventorySystem.js";

export default {
  name: "inventory",
  description: "Mostra todos os itens e cartas do inventário do jogador.",
  async execute(message) {
    try {
      const userId = message.author.id;
      const response = listInventory(userId);
      
      // Garante que a resposta não estoure o limite de 2000 caracteres do Discord
      if (response.length > 1900) {
        await message.reply("📦 Seu inventário é muito grande para ser mostrado inteiro. Tente filtrar por tipo ou número de página (em breve).");
        return;
      }
      
      await message.reply({
        content: response,
        allowedMentions: { repliedUser: false }
      });
    } catch (err) {
      console.error("Erro ao listar inventário:", err);
      await message.reply("⚠️ Ocorreu um erro ao carregar seu inventário.");
    }
  }
};