/**
 * Priest effect handler (SEE_HAND)
 * Look at another player's hand
 */

import type { EffectContext, EffectResult } from './types';
import { addLog } from './utils';

export function applySeeHand(context: EffectContext): EffectResult {
  const { state, action, activePlayer } = context;
  const targetPlayer = state.players.find(
    (p) => p.id === action.targetPlayerId,
  )!;
  const revealedCard = targetPlayer.hand[0] || '';

  // Record this knowledge so AI players can use it in future decisions
  if (!activePlayer.knownCards) activePlayer.knownCards = {};
  activePlayer.knownCards[targetPlayer.id] = revealedCard;

  // Mark the target as exposed to the actor
  if (!targetPlayer.exposedToPlayerIds) targetPlayer.exposedToPlayerIds = [];
  if (!targetPlayer.exposedToPlayerIds.includes(activePlayer.id)) {
    targetPlayer.exposedToPlayerIds.push(activePlayer.id);
  }

  addLog(
    `${activePlayer.name} saw ${targetPlayer.name}'s hand`,
    state,
    activePlayer.id,
  );

  return {
    message: `You saw ${targetPlayer.name}'s hand`,
    revealedCard,
  };
}
