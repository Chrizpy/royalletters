/**
 * Chancellor effect handler (CHANCELLOR_DRAW)
 * Draw 2 cards, keep 1, return 2 to bottom of deck
 */

import type { GameState, PlayerState, GameAction } from '../../types';
import type { EffectContext, EffectResult } from './types';
import { addLog } from './utils';

export function applyChancellorDraw(context: EffectContext): EffectResult {
  const { state, activePlayer } = context;
  
  // Draw up to 2 cards from the deck
  const drawnCards: string[] = [];
  for (let i = 0; i < 2; i++) {
    const card = state.deck.shift();
    if (card) {
      activePlayer.hand.push(card);
      drawnCards.push(card);
    }
  }
  
  if (drawnCards.length === 0) {
    // No cards to draw - Chancellor has no effect
    addLog(`Chancellor had no effect (deck empty)`, state, activePlayer.id);
    return {
      message: 'Chancellor had no effect - deck is empty',
    };
  }
  
  // Store drawn cards info and change phase
  state.chancellorCards = drawnCards;
  state.phase = 'CHANCELLOR_RESOLVING';
  
  addLog(
    `${activePlayer.name} drew ${drawnCards.length} card${drawnCards.length !== 1 ? 's' : ''} with Chancellor`,
    state,
    activePlayer.id
  );
  
  // Calculate how many cards to return (hand size - 1 to keep exactly 1)
  const cardsToReturnCount = activePlayer.hand.length - 1;
  
  return {
    message: `Drew ${drawnCards.length} card${drawnCards.length !== 1 ? 's' : ''}. Select ${cardsToReturnCount} card${cardsToReturnCount !== 1 ? 's' : ''} to return to the bottom of the deck.`,
    skipTurnAdvance: true,
  };
}

/**
 * Validate Chancellor return action
 */
export function validateChancellorReturn(
  playerId: string,
  action: GameAction,
  state: GameState,
  activePlayer: PlayerState | null
): { valid: boolean; error?: string } {
  if (!activePlayer || activePlayer.id !== playerId) {
    return { valid: false, error: 'Not your turn' };
  }
  
  if (state.phase !== 'CHANCELLOR_RESOLVING') {
    return { valid: false, error: 'Not in Chancellor resolving phase' };
  }
  
  // Number of cards to return depends on how many were drawn
  // Player must keep exactly 1 card, so they return (hand size - 1) cards
  const cardsToReturnCount = activePlayer.hand.length - 1;
  
  if (!action.cardsToReturn || action.cardsToReturn.length !== cardsToReturnCount) {
    return { valid: false, error: `Must return exactly ${cardsToReturnCount} card(s)` };
  }
  
  // Verify all cards to return are in player's hand
  const handCopy = [...activePlayer.hand];
  for (const cardId of action.cardsToReturn) {
    const index = handCopy.indexOf(cardId);
    if (index === -1) {
      return { valid: false, error: 'Card not in hand' };
    }
    handCopy.splice(index, 1);
  }
  
  return { valid: true };
}

/**
 * Apply Chancellor return action
 */
export function applyChancellorReturn(
  action: GameAction,
  state: GameState,
  activePlayer: PlayerState
): EffectResult {
  const cardsToReturn = action.cardsToReturn!;
  
  // Remove cards from hand first
  for (const cardId of cardsToReturn) {
    const index = activePlayer.hand.indexOf(cardId);
    if (index !== -1) {
      activePlayer.hand.splice(index, 1);
    }
  }
  
  // Add to bottom of deck in reverse order so first-selected ends up at very bottom
  // (push appends to end, so we reverse to get correct order)
  for (const cardId of [...cardsToReturn].reverse()) {
    state.deck.push(cardId);
  }
  
  // Clear chancellor state
  state.chancellorCards = undefined;
  
  const returnCount = cardsToReturn.length;
  addLog(
    `${activePlayer.name} returned ${returnCount} card${returnCount !== 1 ? 's' : ''} to the deck`,
    state,
    activePlayer.id
  );
  
  return {
    message: 'Cards returned to deck',
  };
}
