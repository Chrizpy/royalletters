/**
 * Types and interfaces for card effect handlers
 */

import type { GameState, GameAction, PlayerState } from '../../types';

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
export type EliminatePlayerFn = (player: PlayerState, reason: string) => void;

/**
 * Helper function type for adding log entries
 */
export type AddLogFn = (
  message: string,
  state: GameState,
  actorId?: string,
  cardId?: string,
) => void;
