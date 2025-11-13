// src/systems/effectSystem.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const EFFECTS_PATH = path.join(__dirname, "../../data/effects.json");

let EFFECTS = [];
try {
  if (fs.existsSync(EFFECTS_PATH)) {
    EFFECTS = JSON.parse(fs.readFileSync(EFFECTS_PATH, "utf-8") || "[]");
  } else {
    console.warn(`[effectSystem] effects.json not found at ${EFFECTS_PATH} — carregando array vazio.`);
    EFFECTS = [];
  }
} catch (e) {
  console.error(`[effectSystem] Erro ao carregar effects.json em ${EFFECTS_PATH}:`, e.message);
  EFFECTS = [];
}

export function getEffectById(id) {
  if (!id) return null;
  return EFFECTS.find(e => e && e.id === id) || null;
}

function deepClone(obj) {
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch {
    return obj;
  }
}

function normalizeRng(rng) {
  if (!rng) return { rand: () => Math.random() };
  if (typeof rng.rand === "function") return rng;
  if (typeof rng.random === "function") return { rand: (...a) => rng.random(...a) };
  return { rand: () => Math.random() };
}

/**
 * Executa um efeito (estrutura de effect.json)
 */
export function executeEffect(eff, subject, owner, opponent, context = null, pushLog = () => {}, rng = null) {
  if (!eff) return null;
  const safeRng = normalizeRng(rng);
  
  // Monta contexto completo para os efeitos
  const executionContext = {
    subject, // Carta ou guardião que disparou
    owner, // Combatant dono da carta
    opponent, // Combatant adversário
    target: context, // Alvo explícito (carta ou guardião)
    allies: owner?.field || [], // Aliados no campo
    enemies: opponent?.field || [], // Inimigos no campo
    allCards: ([]).concat(
      owner?.field || [], owner?.hand || [], owner?.graveyard || [],
      opponent?.field || [], opponent?.hand || [], opponent?.graveyard || []
    ),
    rng: safeRng,
    pushLog,
    deepClone,
    graveyard: owner?.graveyard || [],
  };
  
  try {
    // Condição (opcional)
    if (eff.condition && typeof eff.condition === "string" && eff.condition.trim()) {
      try {
        const condFn = new Function("ctx", `with (ctx) { return (${eff.condition}); }`);
        const ok = condFn(executionContext);
        if (!ok) return false; // Condição falhou
      } catch (e) {
        pushLog(`⚠️ ERRO ao avaliar condição do efeito ${eff.id}: ${e.message}`);
        return null;
      }
    }
    
    // Ação (opcional)
    if (eff.action && typeof eff.action === "string" && eff.action.trim()) {
      try {
        // Remove qualquer export que possa ter sobrado
        const cleanAction = eff.action.replace(/export\s+function\s+\w+\s*\([^)]*\)\s*{/, "").replace(/}$/, "").trim();
        const actionFn = new Function("ctx", `with (ctx) { ${cleanAction}; }`);
        actionFn(executionContext);
        pushLog(`✨ ${subject?.name ?? subject?.id ?? "Entidade"} ativou: ${eff.name ?? eff.id}`);
      } catch (e) {
        pushLog(`⚠️ ERRO na ação do efeito ${eff.id}: ${e.message}`);
      }
    }
    
    // nextTurnEffect (para overTime)
    if (eff.nextTurnEffect && typeof eff.nextTurnEffect === "object") {
      owner.overTime = owner.overTime || [];
      owner.overTime.push(deepClone(eff.nextTurnEffect));
      pushLog(`⏳ ${subject?.name ?? subject?.id} agendou efeito de próximo turno: ${eff.nextTurnEffect.name ?? eff.nextTurnEffect.id}`);
    }
    
    return true;
  } catch (err) {
    pushLog(`⚠️ ERRO ao executar efeito ${eff.id} em ${subject?.name ?? subject?.id}: ${err.message}`);
    return null;
  }
}

/**
 * Dispara todos os efeitos de um trigger
 */
export function runEffectsTrigger(trigger, owner, opponent, context = null, pushLog = () => {}, rng = null) {
  if (!owner || typeof owner !== "object") return;
  
  const safePush = typeof pushLog === "function" ? pushLog : () => {};
  
  function processEntityEffects(entity, entityOwner) {
    if (!entity || !Array.isArray(entity.effects)) return;
    for (const eid of entity.effects) {
      if (!eid) continue;
      const eff = getEffectById(eid);
      if (!eff) {
        safePush(`⚠️ Efeito "${eid}" não encontrado (provável erro de dados).`);
        continue;
      }
      if (eff.type !== trigger) continue;
      executeEffect(eff, entity, entityOwner, opponent, context, safePush, rng);
    }
  }
  
  // Field
  (owner.field || []).forEach(card => processEntityEffects(card, owner));
  // Hand
  (owner.hand || []).forEach(card => processEntityEffects(card, owner));
  // Guardian
  if (owner.guardian && Array.isArray(owner.guardian.effects)) {
    owner.guardian.effects.forEach(eid => processEntityEffects({ ...owner.guardian, effects: [eid] }, owner));
  }
}