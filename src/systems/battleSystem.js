/**
 * src/systems/battleSystem.js
 * * Core logic for the battle mechanics, including turn order, attack calculation, 
 * and handling card effects and status changes.
 * * NOTE: The 'action' properties in effects are executed using eval().
 */
import { EFFECTS_DATA } from '../config/effects.js';

// Convert EFFECTS_DATA array into a Map for O(1) lookups
const effectsMap = new Map(EFFECTS_DATA.map(e => [e.id, e]));

/**
 * Initializes the Battle System.
 * @returns {object} The Battle System module.
 */
export function BattleSystem() {
  
  // --- Public methods for system interaction ---
  
  /**
   * Finds an effect by its ID.
   * @param {string} effectId 
   * @returns {object | undefined} The effect data object.
   */
  const getEffectById = (effectId) => {
    return effectsMap.get(effectId);
  };
  
  /**
   * Applies a specific effect on a card, executing the JavaScript 'action' string.
   * @param {object} effect The effect object from EFFECTS_DATA.
   * @param {object} card The card that is the source of the effect.
   * @param {object} context Global and local variables accessible within the effect's action.
   * * Context typically includes: 
   * { target, allies, enemies, damage, attacker, game, grave, board }
   */
  const applyEffect = (effect, card, context = {}) => {
    if (!effect || !effect.action) {
      console.warn(`Attempted to apply invalid or null effect for card: ${card.id}`);
      return;
    }
    
    console.log(`Applying effect [${effect.name}] on card ${card.id} (Type: ${effect.type})`);
    
    // Prepare context variables for eval()
    const { target, allies, enemies, damage, attacker, game, grave, board } = context;
    
    // The card variable MUST be the source card, which is passed in explicitly
    // eslint-disable-next-line no-eval
    try {
      eval(effect.action);
    } catch (error) {
      console.error(`Error executing effect action for ${effect.id} (${effect.name}):`, error);
    }
  };
  
  /**
   * Triggers all passive effects of a given type for all cards in a list.
   * @param {string} effectType The trigger type (e.g., 'onAttackStart', 'afterTurn').
   * @param {object[]} cardList The list of cards to check for effects.
   * @param {object} context The execution context for the effect.
   * @returns {void}
   */
  const triggerEffects = (effectType, cardList, context = {}) => {
    for (const card of cardList) {
      if (!card.effects || card.hp <= 0) continue;
      
      for (const effectId of card.effects) {
        const effect = getEffectById(effectId);
        
        if (effect && effect.type === effectType) {
          // Pass the full context, including who the source card is
          applyEffect(effect, card, context);
        }
      }
    }
  };
  
  /**
   * Processes turn-end status effects (Poison, Burn, Curse, DoT, etc.).
   * @param {object} card The card whose status effects are being processed.
   * @returns {void}
   */
  const processStatusEffects = (card) => {
    if (!card.status) return;
    
    let damageDealt = 0;
    let log = '';
    
    // --- Handle DOT (Damage Over Time) ---
    if (card.status.dot && card.status.dot.damage > 0) {
      const dotDamage = card.status.dot.damage;
      card.hp -= dotDamage;
      damageDealt += dotDamage;
      card.status.dot.turns -= 1;
      log += ` | DOT: ${dotDamage} (${card.status.dot.turns} turns left)`;
      if (card.status.dot.turns <= 0) delete card.status.dot;
    }
    
    // --- Handle Burn (Placeholder: Simple 5% max HP damage) ---
    if (card.status.burn) {
      const burnDamage = card.maxHp * 0.05 * card.status.burn; // 5% per stack
      card.hp -= burnDamage;
      damageDealt += burnDamage;
      log += ` | Burn: ${burnDamage} dmg (Stacks: ${card.status.burn})`;
      // Burn usually doesn't count down automatically, it's removed by external effects or time
    }
    
    // --- Handle Poison (Placeholder: Simple 3% max HP damage per turn, decreasing stacks) ---
    if (card.status.poison) {
      const poisonDamage = card.maxHp * 0.03 * card.status.poison;
      card.hp -= poisonDamage;
      damageDealt += poisonDamage;
      card.status.poison -= 1;
      log += ` | Poison: ${poisonDamage} dmg (Turns left: ${card.status.poison})`;
      if (card.status.poison <= 0) delete card.status.poison;
    }
    
    // --- Handle Curse (Placeholder: Simple 10% max HP damage, permanent until removed) ---
    if (card.status.curse) {
      const curseDamage = card.maxHp * 0.10;
      card.hp -= curseDamage;
      damageDealt += curseDamage;
      log += ` | Curse: ${curseDamage} dmg`;
      // Curse is usually permanent or removed by cleanse effects
    }
    
    if (damageDealt > 0) {
      console.log(`Status effects applied to ${card.id}: Total ${damageDealt.toFixed(1)} damage.${log}`);
    }
    
    // Cleanup: remove temporary status flags
    delete card.status.skipTurn;
    delete card.status.stun;
    delete card.status.evade;
    delete card.status.silence;
    delete card.status.spellBlocked;
    
    // Ensure HP doesn't drop below zero instantly if status effect kills
    if (card.hp < 0) card.hp = 0;
  };
  
  // --- Main Battle/Turn Functions (Simplified for demonstration) ---
  
  const startBattle = (boardState, guardian) => {
    console.log("Battle Started. Initializing turn 1.");
    // In a real game, this would set up turn order, draw initial hands, etc.
    const allCards = [...boardState.playerBoard, ...boardState.enemyBoard];
    
    // Example of a global effect check (e.g., Grave Lock on game start)
    triggerEffects('onBattleStart', allCards, { game: boardState });
    
    return {
      turn: 1,
      activePlayer: 'player',
      board: allCards,
      playerBoard: boardState.playerBoard,
      enemyBoard: boardState.enemyBoard,
      guardian: guardian
    };
  };
  
  /**
   * Simulates a card attacking a target.
   * @param {object} attackerCard The attacking card.
   * @param {object} targetCard The target card.
   * @param {object} context The current game context (boards, etc.)
   * @returns {number} The actual damage dealt.
   */
  const performAttack = (attackerCard, targetCard, context) => {
    if (attackerCard.hp <= 0 || targetCard.hp <= 0) return 0;
    
    // 1. Trigger 'onAttackStart' effects (Attack buffs, Stun/Poison/Burn application)
    triggerEffects('onAttackStart', [attackerCard], { card: attackerCard, target: targetCard, ...context });
    
    let attackPower = attackerCard.attack || 0;
    let defenseValue = targetCard.defense || 0;
    
    // 2. Damage Calculation (Basic: Attack - Defense, minimum 1 damage)
    let rawDamage = Math.max(1, attackPower - defenseValue);
    
    // 3. Trigger 'onDefense' effects (Shields, damage modification before applying)
    triggerEffects('onDefense', [targetCard], { card: targetCard, attacker: attackerCard, damage: rawDamage, ...context });
    
    // Account for shield
    if (targetCard.shield > 0) {
      const shieldAbsorbed = Math.min(rawDamage, targetCard.shield);
      rawDamage -= shieldAbsorbed;
      targetCard.shield -= shieldAbsorbed;
    }
    
    // 4. Apply Damage
    targetCard.hp -= rawDamage;
    targetCard.hp = Math.max(0, targetCard.hp);
    
    // Store last damage on the target for 'onHit' effects that need it (like Mirror Shield)
    targetCard.lastDamage = rawDamage;
    
    console.log(`> ${attackerCard.name} attacked ${targetCard.name}. DMG: ${rawDamage.toFixed(1)} (HP Left: ${targetCard.hp.toFixed(1)})`);
    
    // 5. Trigger 'onHit' effects (Reflect, Counter, Stun chance post-hit)
    triggerEffects('onHit', [targetCard], { card: targetCard, attacker: attackerCard, damage: rawDamage, ...context });
    
    // 6. Trigger 'afterDefense' effects (Heal after being hit, Rage boost)
    triggerEffects('afterDefense', [targetCard], { card: targetCard, attacker: attackerCard, damage: rawDamage, ...context });
    
    return rawDamage;
  };
  
  
  return {
    getEffectById,
    applyEffect,
    triggerEffects,
    processStatusEffects,
    startBattle,
    performAttack
  };
}