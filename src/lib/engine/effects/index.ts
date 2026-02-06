/**
 * Effect Registry
 * Central export point for all card effect handlers
 */

// Effect types and utilities
export type { EffectContext, EffectResult, EffectHandler, EffectUtils } from './types';
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
