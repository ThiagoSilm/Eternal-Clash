// src/commands/help.js

export default {
  name: "help",
  description: "Mostra todos os comandos disponíveis do bot.",
  async execute(message) {
    
    // Lista de todos os 22 comandos implementados e revisados, categorizados.
    const helpMessage = `
**⚔️ Eternal Clash - Lista de Comandos (22 no total)**

---
📈 **1. Status & Progressão**
*Seu painel de controle e informações vitais.*

\`!status\` — Exibe Nível, Ouro, Rank e status de todos os recursos.
\`!energy\` — Verifica o status atual da sua energia e regeneração.

---
💰 **2. Economia & Ganhos**
*Como coletar recursos, gastar e obter renda.*

\`!dailyquest [status | claim]\` — Verifica/resgata missões diárias.
\`!events [login | sorteio]\` — Coleta recompensa de login e tenta a sorte.
\`!claimenergy\` — Resgate diário de energia bônus.

\`!shop [list | buy <id>]\` — Compra itens e recursos na loja.
\`!luckyspin [spin | status]\` — Gira a Roda da Sorte por prêmios.
\`!sell <idx...>\` — Vende cartas do seu inventário por Ouro.

---
🃏 **3. Coleção & Gestão**
*Gerencie seu inventário, decks e cartas.*

\`!altar <tipo> [qntd]\` — Invoca cartas no altar (Gold, Gem, Booster, etc.).
\`!search <nome>\` — Busca cartas no seu inventário pelo nome.

\`!inventory [list | deck]\` — Gerencia e lista cartas no seu inventário/decks.
\`!items [list | use]\` — Gerencia e usa itens consumíveis (poções, boosters).
\`!card <idx>\` — Mostra detalhes completos de uma carta pelo índice.
\`!upgrade <main> <sacrifices>\` — Upa cartas sacrificando outras e gastando ouro.

\`!setdeck [save | equip | list]\` — Salva e alterna entre decks.
\`!guardian [select | info | list]\` — Gerencia seu Guardião principal.

---
⚔️ **4. Batalha & Competição**
*Comandos para lutar e progredir no jogo.*

\`!battle\` — Inicia uma batalha PvE (ganha XP/Ouro).
\`!arena [status | lutar | recompensa]\` — Desafia outros jogadores no Rank.
\`!tower [status | challenge]\` — Desafia a Torre Infinita para recompensas.

\`!maze [roll | gold | reset]\` — Joga no minigame do labirinto (ganha recompensas).

---
🤝 **5. Social & Clã**

\`!clan [criar | entrar | doar | info | ranking]\` — Comandos de gestão de clãs.

---
⚙️ **6. Geral**
\`!help\` — Mostra esta mensagem de ajuda detalhada.
`;
    
    await message.reply({
      content: helpMessage,
      allowedMentions: { repliedUser: false }
    });
  }
};
