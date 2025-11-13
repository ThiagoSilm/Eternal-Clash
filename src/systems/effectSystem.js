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

// --- Limpeza de "export function ..." em todos os efeitos carregados ---
function cleanEffectAction(actionStr) {
  if (!actionStr || typeof actionStr !== "string") return actionStr;
  return actionStr
    .replace(/export\s+function\s+\w+\s*\([^)]*\)\s*{/, "")
    .replace(/}$/, "")
    .trim();
}

EFFECTS.forEach(eff => {
  if (eff && eff.action) {
    eff.action = cleanEffectAction(eff.action);
  }
});

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
  // Aceita:
  // - objeto com rand()
  // - objeto com random()
  // - Math
  if (!rng) return { rand: () => Math.random() };
  if (typeof rng.rand === "function") return rng;
  if (typeof rng.random === "function") return { rand: (...a) => rng.random(...a) };
  return { rand: () => Math.random() };
}

/**
 * Executa um efeito (estrutura de efeito vinda de effects.json).
 * - eff: objeto de efeito (de getEffectById)
 * - subject: entidade que "dispara" o efeito (carta/guardian)
 * - owner: combatant que possui o subject
 * - opponent: combatant adversário
 * - context: alvo/objeto extra (por exemplo: target card)
 * - pushLog: função para registrar logs (string)
 * - rng: objeto com .rand()
 */
export function executeEffect(eff, subject, owner, opponent, context = null, pushLog = () => {}, rng = null) {
  if (!eff) return null;
  const safeRng = normalizeRng(rng);
  
  // Monta o contexto que as strings (condition/action) podem usar
  const executionContext = {
    subject, // carta/guardian que disparou
    owner, // combatant dono (player/opponent)
    opponent, // combatant adversário
    target: context, // alvo explícito (pode ser null)
    rng: safeRng, // use rng.rand()
    pushLog,
    deepClone,
    graveyard: owner?.graveyard || [],
    allCards: ([]).concat(owner?.field || [], owner?.hand || [], owner?.graveyard || [], opponent?.field || [], opponent?.hand || [], opponent?.graveyard || [])
  };
  
  try {
    // Condição (opcional) — se existir, avalia e aborta caso false
    if (eff.condition && typeof eff.condition === "string" && eff.condition.trim()) {
      try {
        // Cria função de condição. usamos 'with' para facilitar a referência a executionContext (mantive o pattern original)
        const condFn = new Function("ctx", `with (ctx) { return (${eff.condition}); }`);
        const ok = condFn(executionContext);
        if (!ok) {
          return false; // condição não satisfeita -> nada a fazer
        }
      } catch (e) {
        pushLog(`⚠️ ERRO ao avaliar condição do efeito ${eff.id}: ${e.message}`);
        return null;
      }
    }
    
    // Ação (opcional) — executa o código definido no effect.action
    if (eff.action && typeof eff.action === "string" && eff.action.trim()) {
      try {
        const actionFn = new Function("ctx", `with (ctx) { ${eff.action}; }`);
        actionFn(executionContext);
        // Log padrão de ativação
        pushLog(`✨ ${subject?.name ?? subject?.id ?? "Entidade"} ativou: ${eff.name ?? eff.id}`);
      } catch (e) {
        // Não propaga — registra e continua
        pushLog(`⚠️ ERRO na ação do efeito ${eff.id}: ${e.message}`);
      }
    }
    
    // nextTurnEffect (agendado para overTime do owner)
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
 * Varre as entidades relevantes do combatant (field, hand, guardian)
 * e executa efeitos cujo 'type' corresponde ao trigger.
 *
 * - trigger: string (ex: "onEnterField", "onAttackStart", "onHit", "onTurnStart", "onTurnEnd", "onDeath", ...)
 * - owner: combatant (obj com field[], hand[], guardian, etc.)
 * - opponent: combatant adversário
 * - context: contexto extra (por exemplo: a carta que entrou no campo)
 * - pushLog: função de log
 * - rng: objeto RNG (passa pra executeEffect)
 */
export function runEffectsTrigger(trigger, owner, opponent, context = null, pushLog = () => {}, rng = null) {
  if (!owner || typeof owner !== "object") return;
  
  // Normaliza pushLog (evita crashes)
  const safePush = typeof pushLog === "function" ? pushLog : () => {};
  
  // Helper interno para processar uma entidade (card/guardian)
  function processEntityEffects(entity, entityOwner) {
    if (!entity || !Array.isArray(entity.effects)) return;
    for (const eid of entity.effects) {
      if (!eid) continue;
      const eff = getEffectById(eid);
      if (!eff) {
        safePush(`⚠️ Efeito "${eid}" não encontrado (provável erro de dados).`);
        continue;
      }
      // O campo 'type' no efeito indica o gatilho (trigger) para disparo
      if (eff.type !== trigger) continue;
      executeEffect(eff, entity, entityOwner, opponent, context, safePush, rng);
    }
  }
  
  // Varre cartas no field (mais comum)
  const field = Array.isArray(owner.field) ? owner.field : [];
  for (const card of field) {
    processEntityEffects(card, owner);
  }
  
  // Também varre cartas na mão (alguns efeitos podem residir na mão)
  const hand = Array.isArray(owner.hand) ? owner.hand : [];
  for (const card of hand) {
    processEntityEffects(card, owner);
  }
  
  // Graveyard não dispara triggers normalmente — omitido por padrão.
  // Opcional: se quiser triggers no grave, habilite aqui.
  
  // Guardian (efeitos do guardião)
  if (owner.guardian && Array.isArray(owner.guardian.effects)) {
    for (const eid of owner.guardian.effects) {
      const eff = getEffectById(eid);
      if (!eff) {
        safePush(`⚠️ Efeito do Guardião "${eid}" não encontrado.`);
        continue;
      }
      if (eff.type !== trigger) continue;
      executeEffect(eff, owner.guardian, owner, opponent, context, safePush, rng);
    }
  }
}