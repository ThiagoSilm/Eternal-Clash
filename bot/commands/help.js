export default {
  name: "help",
  description: "Mostra todos os comandos disponíveis do bot.",
  async execute(message) {
    const helpMessage = `
🎮 **Eternal Clash - Lista de Comandos**

🃏 **Cards**
\`!cards evoluir <indiceCarta> [XP]\` — Evolui a carta escolhida  
\`!cards meld <indiceCarta> <indiceDoadora>\` — Transfere habilidade da doadora  

⚔️ **Battle**
\`!battle\` — Batalhe contra inimigos da campanha  

🎲 **Maze**
\`!maze rolar\` — Rola o dado e explora  
\`!maze resetar\` — Reseta o Maze  

🏰 **Clan**
\`!clan criar <nome>\` — Cria um clã  
\`!clan entrar <nome>\` — Entra em um clã  
\`!clan sair\` — Sai do clã  
\`!clan doar <quantia>\` — Doa recursos ao clã  
\`!clan info <nome>\` — Mostra informações do clã  

📘 **Deck**
\`!deck add <n>\` — Adiciona carta ao deck  
\`!deck remove <n>\` — Remove carta do deck  
\`!deck view\` — Mostra cartas do deck  

⚡ **Energy**
\`!energy\` — Mostra status da energia  
\`!claimenergy\` — Resgata energia diária  

🏯 **Tower**
\`!tower start\` — Começa a torre  
\`!tower status\` — Mostra o progresso da torre  

🪄 **Summon**
\`!summon <tipo> [quantidade]\` — Invoca cartas pelo altar  

🎰 **Lucky Spin**
\`!luckyspin\` — Gira a roda da sorte por gemas  

🎁 **Events**
\`!events login\` — Coleta recompensa diária  
\`!events status\` — Mostra sequência de login  
\`!events sorteio\` — Gira a sorte do dia  

📦 **Inventory**
\`!inventory\` — Mostra itens e cartas do inventário  

📊 **Status**
\`!status\` — Exibe progresso e informações do jogador  

💡 **Help**
\`!help\` — Mostra esta mensagem de ajuda  
`;
    
    await message.reply({
      content: helpMessage,
      allowedMentions: { repliedUser: false }
    });
  }
};