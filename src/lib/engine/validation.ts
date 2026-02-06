/**
 * Move validation logic
 * Pure functions for validating game actions
 */

import type { GameState, GameAction, PlayerState } from '../types';
import { getCardDefinition } from './deck';

/**
 * Result of a validation check
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Find valid targets for a card that requires targeting
 */
export function getValidTargets(
  state: GameState,
  playerId: string,
  canTargetSelf: boolean
): PlayerState[] {
  return state.players.filter(p => {
    if (p.id === playerId && !canTargetSelf) return false;
    if (p.status === 'ELIMINATED') return false;
    if (p.status === 'PROTECTED' && p.id !== playerId) return false;
    return true;
  });
}

/**
 * Validate if the Countess rule is satisfied
 * If player has Countess + (King or Prince), must play Countess
 */
export function validateCountessRule(
  hand: string[],
  cardToPlay: string
): ValidationResult {
  const hasCountess = hand.includes('countess');
  const hasKing = hand.includes('king');
  const hasPrince = hand.includes('prince');
  
  if (hasCountess && (hasKing || hasPrince) && cardToPlay !== 'countess') {
    return { valid: false, error: 'Must play Countess when holding King or Prince' };
  }
  
  return { valid: true };
}

/**
 * Validate target selection for a card
 */
export function validateTarget(
  state: GameState,
  playerId: string,
  action: GameAction,
  canTargetSelf: boolean
): ValidationResult {
  const validTargets = getValidTargets(state, playerId, canTargetSelf);

  // If no valid targets exist, the card can be played with no effect
  if (validTargets.length === 0) {
    return { valid: true };
  }

  if (!action.targetPlayerId) {
    return { valid: false, error: 'Target player required' };
  }

  const targetPlayer = state.players.find(p => p.id === action.targetPlayerId);
  if (!targetPlayer) {
    return { valid: false, error: 'Invalid target player' };
  }

  // Check if target is eliminated
  if (targetPlayer.status === 'ELIMINATED') {
    return { valid: false, error: 'Cannot target eliminated player' };
  }

  // Check if target is protected (unless can target self and targeting self)
  if (targetPlayer.status === 'PROTECTED') {
    const isSelfTarget = targetPlayer.id === playerId;
    if (!isSelfTarget || !canTargetSelf) {
      return { valid: false, error: 'Cannot target protected player' };
    }
  }

  // Check if can target self
  if (action.targetPlayerId === playerId && !canTargetSelf) {
    return { valid: false, error: 'Cannot target yourself with this card' };
  }

  return { valid: true };
}

/**
 * Validate Guard-specific rules (cannot guess Guard)
 */
export function validateGuardGuess(
  cardId: string,
  targetCardGuess: string | undefined
): ValidationResult {
  if ((cardId === 'guard' || cardId === 'tillbakakaka') && 
      (targetCardGuess === 'guard' || targetCardGuess === 'tillbakakaka')) {
    return { valid: false, error: 'Cannot guess Guard' };
  }
  return { valid: true };
}

/**
 * Validate a complete card play action
 */
export function validateCardPlay(
  state: GameState,
  playerId: string,
  action: GameAction,
  activePlayer: PlayerState | null
): ValidationResult {
  // Check if it's the player's turn
  if (!activePlayer || activePlayer.id !== playerId) {
    return { valid: false, error: 'Not your turn' };
  }

  // Check if phase is correct
  if (state.phase !== 'WAITING_FOR_ACTION') {
    return { valid: false, error: 'Not in action phase' };
  }
  
  // Check if cardId is provided
  if (!action.cardId) {
    return { valid: false, error: 'Card ID required' };
  }

  // Check if player has the card
  if (!activePlayer.hand.includes(action.cardId)) {
    return { valid: false, error: 'Card not in hand' };
  }

  // Countess rule
  const countessResult = validateCountessRule(activePlayer.hand, action.cardId);
  if (!countessResult.valid) {
    return countessResult;
  }

  // Get card definition
  const cardDef = getCardDefinition(action.cardId);
  if (!cardDef) {
    return { valid: false, error: 'Unknown card' };
  }

  // Target validation - check if there are valid targets
  let hasValidTargets = true;
  if (cardDef.effect.requiresTargetPlayer) {
    const validTargets = getValidTargets(state, playerId, cardDef.effect.canTargetSelf ?? false);
    
    // If no valid targets exist, card can be played with no effect (no target/guess required)
    if (validTargets.length === 0) {
      hasValidTargets = false;
    } else {
      const targetResult = validateTarget(
        state,
        playerId,
        action,
        cardDef.effect.canTargetSelf ?? false
      );
      if (!targetResult.valid) {
        return targetResult;
      }
    }
  }

  // Only validate guard guess and target card guess if there are valid targets
  if (hasValidTargets) {
    // Guard guess validation
    const guardResult = validateGuardGuess(action.cardId, action.targetCardGuess ?? undefined);
    if (!guardResult.valid) {
      return guardResult;
    }

    // Check if targetCardGuess is required
    if (cardDef.effect.requiresTargetCardType && !action.targetCardGuess) {
      return { valid: false, error: 'Target card guess required' };
    }
  }

  return { valid: true };
}
