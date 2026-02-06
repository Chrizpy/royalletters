/**
 * Spy effect handler (SPY_BONUS)
 * No immediate effect - bonus token is awarded at round end
 */

import type { EffectContext, EffectResult } from './types';
import { addLog } from './utils';

export function applySpyBonus(context: EffectContext): EffectResult {
  const { state, activePlayer } = context;
  
  addLog(`${activePlayer.name} played Spy`, state, activePlayer.id);
  
  return {
    message: 'Spy played - you may gain a token at round end if you are the only one with a Spy in your discard pile',
  };
}
