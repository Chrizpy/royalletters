/**
 * Princess effect handler (LOSE_IF_DISCARDED)
 * If you play or discard the Princess, you are eliminated
 */

import type { EffectContext, EffectResult } from './types';
import { addLog } from './utils';

export function applyLoseIfDiscarded(context: EffectContext): EffectResult {
  const { state, activePlayer } = context;
  
  // If Princess is discarded (played), player is eliminated
  activePlayer.status = 'ELIMINATED';
  activePlayer.eliminationReason = 'You played the Princess';
  addLog(`${activePlayer.name} was eliminated (played Princess)`, state, activePlayer.id);
  
  return {
    message: 'You played Princess and are eliminated',
    eliminatedPlayerId: activePlayer.id,
  };
}
