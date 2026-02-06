/**
 * Types and interfaces for card effect handlers
 */

import type { GameState, GameAction, ActionResult, PlayerState, EffectType } from '../../types';

/**
 * Context passed to effect handlers
 */
export interface EffectContext {
  state: GameState;
  action: GameAction;
  activePlayer: PlayerState;
  targetPlayer?: PlayerState;
}

/**
 * Interface that all card effect handlers must implement
 */
export interface EffectHandler {
  /**
   * The effect type this handler processes
   */
  readonly effectType: EffectType;

  /**
   * Apply the card effect
   * @param context The effect context with state, action, and players
   * @returns The action result with updated state
   */
  apply(context: EffectContext): EffectResult;
}

/**
 * Result of applying an effect
 * Similar to ActionResult but without success (effects are always "successful" once validated)
 */
export interface EffectResult {
  message: string;
  revealedCard?: string;
  eliminatedPlayerId?: string;
  /** If true, turn should not advance after this effect */
  skipTurnAdvance?: boolean;
}

/**
 * Helper function type for eliminating a player
 */
export type EliminatePlayerFn = (
  player: PlayerState,
  reason: string,
  state: GameState
) => void;

/**
 * Helper function type for adding log entries
 */
export type AddLogFn = (
  message: string,
  state: GameState,
  actorId?: string,
  cardId?: string
) => void;

/**
 * Shared utilities passed to effect handlers
 */
export interface EffectUtils {
  eliminatePlayer: EliminatePlayerFn;
  addLog: AddLogFn;
}
