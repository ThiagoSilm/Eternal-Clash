// src/systems/effectSystem.js

import { deepCloneSafe } from "./utils/helpers.js";
// Assumindo que EFFECTS e GUARDIAN_EFFECTS são carregados corretamente
import { EFFECTS, runEffect as runCardEffect } from "../config/effects.js";
import { GUARDIAN_EFFECTS } from "../config/guardianEffects.js";

// ======================================================
// ⚙️ TIPAGEM E CONSTANTES
// ======================================================

export const FACTIONS = {
  Faen: "Faen",
  Gorath: "Gorath",
  Human: "Human",
  Morrath: "Morrath",
};

/**
 * Define a ordem de execução das fases de efeito.
 */
const EFFECT_PHASES = ["buff", "damage", "special"];

/**
 * @typedef {object} GameEntity - Representa uma carta ou guardião em campo.
 * @property {string} id - ID do template (GuardianId ou CardId).
 * @property {string} [uniqueId] - ID único da instância (para cartas).
 * @property {string} faction - Facção da entidade.
 * @property {string[]} effects - Array de IDs de efeitos ativos.
 * @property {number} [level=1] - Nível da entidade.
 * @property {object[]} [perks] - Bônus permanentes (usados em applyFactionModifiers).
 */

/**
 * @typedef {object} PlayerState - Estado do jogador.
 * @property {string} id - ID do jogador.
 * @property {GameEntity} [guardian] - Guardião do jogador.
 * @property {GameEntity[]} [field=[]] - Cartas em campo.
 * @property {GameEntity[]} [hand=[]] - Cartas na mão.
 * @property {GameEntity[]} [graveyard=[]] - Cartas no cemitério.
 */

/**
 * @typedef {object} EffectContext
 * @property {GameEntity} subject - A entidade que possui o efeito sendo executado.
 * @property {PlayerState} owner - O jogador proprietário da entidade (subject).
 * @property {PlayerState} opponent - O jogador oponente.
 * @property {GameEntity} [target] - O alvo padrão (geralmente o oponente).
 * @property {GameEntity[]} allies - Array de entidades aliadas (geralmente owner.field).
 * @property {GameEntity[]} enemies - Array de entidades inimigas (geralmente opponent.field).
 * @property {function(string): void} pushLog - Função para registrar mensagens de log.
 * // Outros dados do turno/batalha passados via extraCtx...
 */

/**
 * @typedef {object} EffectConfig
 * @property {string} id
 * @property {('buff'|'damage'|'special')} [phase='special'] - Fase de execução.
 * @property {string[]} [trigger] - Triggers que ativam o efeito.
 * @property {object} [againstFaction] - Configuração de bônus contra facção (para cartas).
 */

// ======================================================
// 🔹 UTILIDADES
// ======================================================

/**
 * Calcula o valor base de um efeito, aplicando a escala de nível.
 * @param {object} eff - Objeto de configuração do efeito (de EFFECTS ou GUARDIAN_EFFECTS).
 * @param {number} [level=1] - Nível da entidade que possui o efeito.
 * @returns {number} O valor numérico do efeito.
 */
export function getEffectValue(eff, level = 1) {
  if (!eff || !eff.scaling) return 0;
  const base = eff.scaling.base || 0;
  const perLevel = eff.scaling.perLevel || 0;
  return base + perLevel * Math.max(0, level - 1);
}

// ------------------------------------------------------------------
// Encontra a configuração de um efeito, priorizando a busca.
function getEffectConfig(id) {
    return EFFECTS[id] || GUARDIAN_EFFECTS[id];
}
// ------------------------------------------------------------------

// ======================================================
// 🎯 EXECUTOR UNIFICADO DE EFEITOS
// ======================================================

/**
 * Executa um efeito pelo seu ID, tratando cartas e guardiões separadamente.
 * Inclui tratamento de erros interno.
 * @param {string} id - ID do efeito a ser executado.
 * @param {EffectContext} ctx - O contexto da batalha.
 */
function executeEffect(id, ctx) {
  const isCardEffect = !!EFFECTS[id];
  const isGuardianEffect = !!GUARDIAN_EFFECTS[id];

  if (isCardEffect) {
    // Assume que runCardEffect (importado) lida com o contexto
    runCardEffect(id, ctx);
  } else if (isGuardianEffect) {
    const eff = GUARDIAN_EFFECTS[id];
    if (typeof eff?.effect === "function") {
      eff.effect(ctx);
    } else {
      ctx.pushLog?.(`⚠️ Guardião sem função: ${id}`);
    }
  } else {
    ctx.pushLog?.(`⚠️ Efeito não encontrado: ${id}`);
  }
}

// ======================================================
// 🚀 RUN TRIGGER COM FASES (Export)
// ======================================================

/**
 * Coleta, enfileira e executa todos os efeitos ativos baseados em um trigger específico,
 * respeitando a ordem de fases (Buff -> Dano -> Especial).
 * @param {string} trigger - O gatilho que disparou os efeitos (ex: 'onStartTurn', 'onAttack').
 * @param {PlayerState} owner - O jogador cujo turno/ação está ocorrendo.
 * @param {PlayerState} opponent - O jogador oponente.
 * @param {object} [extraCtx={}] - Dados extras para o contexto de batalha.
 * @param {function(string): void} [pushLog=()=>{}] - Função para logar eventos.
 */
export function runEffectsTrigger(trigger, owner, opponent, extraCtx = {}, pushLog = () => {}) {
  if (!owner || typeof owner !== "object") return;
  
  // 1. Coleta todas as entidades ativas (em campo, mão, cemitério, guardião)
  const entities = [
    ...(owner.field || []),
    ...(owner.hand || []),
    ...(owner.graveyard || []),
  ];
  if (owner.guardian) entities.push(owner.guardian);
  
  // 2. Cria filas de execução por fase
  const phaseQueues = { buff: [], damage: [], special: [] };
  
  for (const subject of entities) {
    if (!subject || !Array.isArray(subject.effects)) continue;
    
    for (const effId of subject.effects) {
      const eff = getEffectConfig(effId);
      if (!eff) {
        pushLog?.(`⚠️ Efeito inválido na entidade ${subject.id}: ${effId}`);
        continue;
      }
      
      // Verifica se o efeito é acionado por este trigger
      if (Array.isArray(eff.trigger) && !eff.trigger.includes(trigger)) continue;
      
      // Define a fase de execução (default para carta é 'damage', para guardião é 'special')
      const defaultPhase = EFFECTS[effId] ? "damage" : "special";
      const phase = eff.phase || defaultPhase;
      
      if (EFFECT_PHASES.includes(phase)) {
        phaseQueues[phase].push({ effId, subject });
      } else {
        pushLog?.(`⚠️ Efeito ${effId} possui fase inválida: ${phase}`);
      }
    }
  }
  
  // 3. Executa as fases em ordem definida
  for (const phase of EFFECT_PHASES) {
    for (const { effId, subject } of phaseQueues[phase]) {
      // Cria o contexto de execução (deepClone para evitar mutações indesejadas do extraCtx)
      const ctx = {
        subject,
        owner,
        opponent,
        // Garante que target, allies e enemies tenham valores padrão úteis
        target: extraCtx?.target || opponent,
        allies: owner.field || [],
        enemies: opponent?.field || [],
        ...deepCloneSafe(extraCtx),
        pushLog,
      };
      
      try {
        executeEffect(effId, ctx);
      } catch (err) {
        console.error(`[effectSystem] Erro fatal no efeito ${effId} (Fase ${phase}):`, err);
        pushLog?.(`❌ Erro crítico no efeito ${effId}.`);
      }
    }
  }
}

// ======================================================
// 🛡️ MODIFICADORES DE FACÇÃO
// ======================================================

/**
 * Aplica modificadores de dano baseados em efeitos e vantagens de facção.
 * @param {GameEntity} attacker - Entidade atacante.
 * @param {GameEntity} defender - Entidade defensora.
 * @param {number} baseDamage - Dano base inicial.
 * @returns {{damage: number, reasons: string[]}} Dano final e lista de modificadores aplicados.
 */
export function applyFactionModifiers(attacker, defender, baseDamage) {
  let dmg = baseDamage || 0;
  const reasons = [];
  if (!attacker || !defender) return { damage: dmg, reasons };
  
  // 1. Modificadores de Efeitos (Effects)
  const effIds = Array.isArray(attacker.effects) ? attacker.effects : [];
  for (const id of effIds) {
    const eff = EFFECTS[id];
    // Verifica se é um efeito de carta com bônus de facção
    if (!eff || !eff.againstFaction) continue; 
    
    const cfg = eff.againstFaction;
    if (cfg.faction && cfg.faction === defender.faction) {
      const mult = typeof cfg.multiplier === "number" ? cfg.multiplier : 1;
      dmg = Math.floor(dmg * mult);
      reasons.push(`effect:${eff.id}@x${mult}`);
    }
  }
  
  // 2. Modificadores de Vantagens (Perks/Vantagens Permanentes)
  if (Array.isArray(attacker.perks)) {
    for (const p of attacker.perks) {
      if (p.againstFaction === defender.faction && typeof p.multiplier === "number") {
        dmg = Math.floor(dmg * p.multiplier);
        reasons.push(`perk:${p.id || p.type}@x${p.multiplier}`);
      }
    }
  }
  
  return { damage: dmg, reasons };
}

// ======================================================
// 🔍 VERIFICAÇÕES
// ======================================================

/**
 * Verifica se uma entidade possui um efeito ativo contra uma facção específica.
 * @param {GameEntity} entity - A entidade a ser verificada.
 * @param {string} faction - A facção alvo.
 * @returns {boolean} True se o efeito estiver ativo.
 */
export function entityHasFactionEffect(entity, faction) {
  if (!entity || !Array.isArray(entity.effects)) return false;
  
  return entity.effects.some(id => {
    const eff = EFFECTS[id]; // Apenas efeitos de cartas costumam ter againstFaction
    return eff?.againstFaction?.faction === faction;
  });
}
