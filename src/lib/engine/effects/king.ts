/**
 * King effect handler (TRADE_HANDS)
 * Trade hands with another player
 */

import type { GameState, PlayerState } from '../../types';
import type { EffectContext, EffectResult } from './types';
import { addLog } from './utils';

export function applyTradeHands(context: EffectContext): EffectResult {
  const { state, action, activePlayer } = context;
  const targetPlayer = state.players.find(p => p.id === action.targetPlayerId)!;
  
  const temp = activePlayer.hand;
  activePlayer.hand = targetPlayer.hand;
  targetPlayer.hand = temp;

  addLog(`${activePlayer.name} and ${targetPlayer.name} traded hands`, state, activePlayer.id);

  return {
    message: `You traded hands with ${targetPlayer.name}`,
  };
}

/**
 * House rule: When King is played but no valid targets exist,
 * swap with the burned card
 */
export function applyTradeWithBurnedCard(
  activePlayer: PlayerState,
  state: GameState
): EffectResult {
  const burnedCard = state.burnedCard;
  
  if (!burnedCard) {
    addLog(`King had no effect (no burned card)`, state, activePlayer.id);
    return {
      message: 'King had no effect - no burned card available',
    };
  }

  // Swap player's card with the burned card
  const playerCard = activePlayer.hand[0];
  activePlayer.hand[0] = burnedCard;
  state.burnedCard = playerCard;

  addLog(`${activePlayer.name} swapped their card with the burned card`, state, activePlayer.id);

  return {
    message: 'You swapped your card with the burned card',
  };
}
