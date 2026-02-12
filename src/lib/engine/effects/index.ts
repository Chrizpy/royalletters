/**
 * Effect Registry
 * Central export point for all card effect handlers
 */

import type { EffectType } from '../../types';
import type { EffectContext, EffectResult } from './types';

// Effect types and utilities
export type { EffectContext, EffectResult } from './types';
export { eliminatePlayer, addLog } from './utils';

// Individual effect handlers
export { applyGuessCard } from './guard';
export { applyGuessCardRevenge, applyRevengeGuess } from './tillbakakaka';
export { applySeeHand } from './priest';
export { applyCompareHands } from './baron';
export { applyProtection } from './handmaid';
export { applyForceDiscard } from './prince';
export { applyTradeHands, applyTradeWithBurnedCard } from './king';
export { applyConditionalDiscard } from './countess';
export { applyLoseIfDiscarded } from './princess';
export { applySpyBonus } from './spy';
export { applyChancellorDraw, applyChancellorReturn, validateChancellorReturn } from './chancellor';

import { applyGuessCard } from './guard';
import { applyGuessCardRevenge } from './tillbakakaka';
import { applySeeHand } from './priest';
import { applyCompareHands } from './baron';
import { applyProtection } from './handmaid';
import { applyForceDiscard } from './prince';
import { applyTradeHands } from './king';
import { applyConditionalDiscard } from './countess';
import { applyLoseIfDiscarded } from './princess';
import { applySpyBonus } from './spy';
import { applyChancellorDraw } from './chancellor';

/**
 * Effect handler registry — maps each EffectType to its handler function.
 */
export const effectHandlers: Record<EffectType, (context: EffectContext) => EffectResult> = {
  'GUESS_CARD': applyGuessCard,
  'GUESS_CARD_REVENGE': applyGuessCardRevenge,
  'SEE_HAND': applySeeHand,
  'COMPARE_HANDS': applyCompareHands,
  'PROTECTION': applyProtection,
  'FORCE_DISCARD': applyForceDiscard,
  'TRADE_HANDS': applyTradeHands,
  'CONDITIONAL_DISCARD': applyConditionalDiscard,
  'LOSE_IF_DISCARDED': applyLoseIfDiscarded,
  'SPY_BONUS': applySpyBonus,
  'CHANCELLOR_DRAW': applyChancellorDraw,
};
