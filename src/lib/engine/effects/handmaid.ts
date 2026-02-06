/**
 * Handmaid effect handler (PROTECTION)
 * Gain protection until your next turn
 */

import type { EffectContext, EffectResult } from './types';

export function applyProtection(context: EffectContext): EffectResult {
  const { activePlayer } = context;
  activePlayer.status = 'PROTECTED';
  
  return {
    message: 'You are protected until your next turn',
  };
}
