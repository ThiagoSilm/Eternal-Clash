// src/systems/effectSystem.js (REVISADO)

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// --- Configuração e Carregamento de Efeitos ---

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const EFFECTS_PATH = path.join(__dirname, "../../data/effects.json"); 

let EFFECTS = [];
try {
  EFFECTS = JSON.parse(fs.readFileSync(EFFECTS_PATH, "utf-8"));
} catch (e) {
  console.error(`Erro ao carregar effects.json em ${EFFECTS_PATH}:`, e.message);
  EFFECTS = [];
}

/** Retorna a definição completa de um efeito pelo seu ID. */
export function getEffectById(id) { 
    return EFFECTS.find(e => e.id === id); 
}

// --- Funções Auxiliares ---

function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }

/**
 * Executa a lógica JavaScript contida em eff.action,
 * injetando o contexto necessário.
 * * @param {object} eff - A definição do efeito (do effects.json).
 * @param {object} subject - A carta/guardião INSTÂNCIA que está ativando.
 * @param {object} owner - O combatente proprietário (com .cards, .graveyard, etc.).
 * @param {object} opponent - O combatente adversário.
 * @param {object} context - O objeto de alvo (ex: a carta que foi atacada).
 * @param {function} pushLog - Função para adicionar mensagens ao log de batalha.
 * @param {object} [rng=Math] - O gerador de números aleatórios (usando Math se não injetado).
 */
export function executeEffect(eff, subject, owner, opponent, context = null, pushLog = () => {}, rng = Math) {
  // 🎯 CORREÇÃO: Mantemos rng=Math como fallback para facilitar o uso de Math.random() 
  // dentro do 'with (ctx)' caso nenhum gerador seedable seja passado.

  if (!eff) return null;
  
  // Cria um objeto de contexto único e completo para o escopo da função dinâmica.
  const executionContext = {
    // Aliases comuns
    subject: subject,     
    target: context,      
    owner: owner,         
    opponent: opponent,   
    // Utilitários
    rng: rng, // Passa Math ou um gerador seedable
    pushLog: pushLog,
    deepClone: deepClone,
    // Acesso direto aos dados internos
    graveyard: owner.graveyard, 
    allCards: owner.cards.concat(opponent.cards), 
  };

  try {
    // 1. Condição (eff.condition)
    if (eff.condition) {
      const condFn = new Function('ctx', `with (ctx) { return (${eff.condition}); }`);
      const ok = !!condFn(executionContext);
      if (!ok) return null;
    }

    // 2. Ação (eff.action - Execução Dinâmica)
    if (eff.action) {
      // Usa um único formato robusto para execução, injetando o contexto.
      const actionFn = new Function('ctx', `with (ctx) { ${eff.action}; }`);
      actionFn(executionContext);

      pushLog(`✨ ${subject.name ?? subject.id} ativou: ${eff.name ?? eff.id}`);
    }

    // 3. Efeitos de Próximo Turno (eff.nextTurnEffect)
    if (eff.nextTurnEffect) {
      owner.overTime = owner.overTime || [];
      // Usamos deepClone para garantir que o objeto seja novo e não referencie o eff
      owner.overTime.push(deepClone(eff.nextTurnEffect)); 
      pushLog(`⏳ ${subject.name ?? subject.id} agendou efeito de próximo turno: ${eff.nextTurnEffect.name || eff.nextTurnEffect.id}`);
    }

    return true;
  } catch (err) {
    pushLog(`⚠️ ERRO ao executar efeito ${eff.id} de ${subject.name}: ${err.message}`);
    return null;
  }
}

/**
 * Percorre todas as cartas e o guardião e ativa os efeitos correspondentes a um gatilho.
 */
export function runEffectsTrigger(trigger, owner, opponent, context = null, pushLog = () => {}, rng = Math) {
  
  // 1. Efeitos de Cartas em Campo
  for (const card of (owner.cards || []).filter(c => (c.hp ?? 0) > 0)) {
    if (card.silenced) continue;
    
    // O array de efeitos (card.effects) deve conter os IDs de efeitos da definição (template)
    for (const eid of (card.effects || [])) {
      const eff = getEffectById(eid);
      if (!eff || eff.type !== trigger) continue;
      
      // Passamos a INSTÂNCIA da carta como 'subject'
      executeEffect(eff, card, owner, opponent, context, pushLog, rng); 
    }
  }

  // 2. Efeitos do Guardião (Se o guardião for uma entidade de batalha)
  if (owner.guardian && owner.guardian.effects && owner.guardian.effects.length) {
    for (const eid of owner.guardian.effects) {
      const eff = getEffectById(eid);
      if (!eff || eff.type !== trigger) continue;
      
      // Passamos a INSTÂNCIA do guardião como 'subject'
      executeEffect(eff, owner.guardian, owner, opponent, context, pushLog, rng); 
    }
  }
}
