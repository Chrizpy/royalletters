/**
 * Prince effect handler (FORCE_DISCARD)
 * Force a player to discard their hand and draw a new card
 */

import type { EffectContext, EffectResult } from './types';
import { eliminatePlayer, addLog } from './utils';

export function applyForceDiscard(context: EffectContext): EffectResult {
  const { state, action, activePlayer } = context;
  const targetPlayer = state.players.find(p => p.id === action.targetPlayerId)!;
  
  const discardedCard = targetPlayer.hand.shift();
  if (discardedCard) {
    targetPlayer.discardPile.push(discardedCard);
    addLog(`${targetPlayer.name} discarded ${discardedCard}`, state, targetPlayer.id, discardedCard);

    // If Princess was discarded, target is eliminated
    if (discardedCard === 'princess') {
      eliminatePlayer(
        targetPlayer,
        `${activePlayer.name} forced you to discard Princess`,
        state
      );
      addLog(`${targetPlayer.name} was eliminated (discarded Princess)`, state, targetPlayer.id);
      
      return {
        message: `${targetPlayer.name} discarded Princess and is eliminated`,
        eliminatedPlayerId: targetPlayer.id,
      };
    }

    // Draw new card
    const newCard = state.deck.shift();
    if (newCard) {
      targetPlayer.hand.push(newCard);
      addLog(`${targetPlayer.name} drew a new card`, state, targetPlayer.id);
    }
  }

  return {
    message: `${targetPlayer.name} discarded and drew a new card`,
  };
}
