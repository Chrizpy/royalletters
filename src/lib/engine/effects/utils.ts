/**
 * Shared utility functions for effect handlers
 */

import type { GameState, PlayerState, LogEntry } from '../../types';

/**
 * Eliminate a player with a given reason
 * Moves all cards from hand to discard pile and sets status
 */
export function eliminatePlayer(
  player: PlayerState,
  reason: string,
  _state: GameState
): void {
  // Move all cards from hand to discard pile
  while (player.hand.length > 0) {
    const card = player.hand.shift()!;
    player.discardPile.push(card);
  }
  player.status = 'ELIMINATED';
  player.eliminationReason = reason;
}

/**
 * Add a log entry to the game state
 */
export function addLog(
  message: string,
  state: GameState,
  actorId?: string,
  cardId?: string
): void {
  const entry: LogEntry = {
    timestamp: Date.now(),
    message,
    actorId,
    cardId,
  };
  state.logs.push(entry);
}
