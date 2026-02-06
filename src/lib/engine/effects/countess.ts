/**
 * Countess effect handler (CONDITIONAL_DISCARD)
 * No effect when played - the Countess rule is enforced in validation
 */

import type { EffectContext, EffectResult } from './types';

export function applyConditionalDiscard(_context: EffectContext): EffectResult {
  // Countess has no effect when played
  return {
    message: 'Countess played',
  };
}
