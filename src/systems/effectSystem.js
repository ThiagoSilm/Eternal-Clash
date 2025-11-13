import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

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

export function getEffectById(id) {
  return EFFECTS.find(e => e.id === id) || null;
}

function deepClone(obj) {
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch {
    return obj; // fallback simples
  }
}

export function executeEffect(eff, subject, owner, opponent, context = null, pushLog = () => {}, rng = Math) {
  if (!eff) return null;
  if (!rng || typeof rng.random !== "function") rng = Math;
  
  const executionContext = {
    subject,
    target: context,
    owner,
    opponent,
    rng,
    pushLog,
    deepClone,
    graveyard: owner.graveyard || [],
    allCards: (owner.cards || []).concat(opponent.cards || [])
  };
  
  try {
    if (eff.condition) {
      const condFn = new Function('ctx', `with (ctx) { return (${eff.condition}); }`);
      if (!condFn(executionContext)) return null;
    }
    
    if (eff.action) {
      try {
        const actionFn = new Function('ctx', `with (ctx) { ${eff.action}; }`);
        actionFn(executionContext);
        pushLog(`✨ ${subject.name ?? subject.id} ativou: ${eff.name ?? eff.id}`);
      } catch (err) {
        pushLog(`⚠️ ERRO na ação de ${subject.name ?? subject.id}: ${err.message}`);
      }
    }
    
    if (eff.nextTurnEffect) {
      owner.overTime = owner.overTime || [];
      owner.overTime.push(deepClone(eff.nextTurnEffect));
      pushLog(`⏳ ${subject.name ?? subject.id} agendou efeito de próximo turno: ${eff.nextTurnEffect.name || eff.nextTurnEffect.id}`);
    }
    
    return true;
  } catch (err) {
    pushLog(`⚠️ ERRO ao executar efeito ${eff.id} de ${subject.name ?? subject.id}: ${err.message}`);
    return null;
  }
}

export function runEffectsTrigger(trigger, owner, opponent, context = null, pushLog = () => {}, rng = Math) {
  const ownerCards = owner.cards || [];
  for (const card of ownerCards.filter(c => (c.hp ?? 0) > 0 && !c.silenced)) {
    for (const eid of card.effects || []) {
      const eff = getEffectById(eid);
      if (!eff || eff.type !== trigger) continue;
      executeEffect(eff, card, owner, opponent, context, pushLog, rng);
    }
  }
  
  const guardian = owner.guardian;
  if (guardian && Array.isArray(guardian.effects)) {
    for (const eid of guardian.effects) {
      const eff = getEffectById(eid);
      if (!eff || eff.type !== trigger) continue;
      executeEffect(eff, guardian, owner, opponent, context, pushLog, rng);
    }
  }
}