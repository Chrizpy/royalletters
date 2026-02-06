/**
 * Player state utilities and helpers
 */

import type { PlayerState, GameConfig } from '../types';
import { shuffle } from './deck';
import { PLAYER_COLORS } from './constants';

/**
 * Configuration for creating a player
 */
export interface PlayerConfig {
  id: string;
  name: string;
  avatarId?: string;
  isHost?: boolean;
  isAI?: boolean;
}

/**
 * Create initial player states from config
 */
export function createPlayers(
  playerConfigs: PlayerConfig[],
  colorSeed: string
): PlayerState[] {
  // Shuffle colors to assign randomly
  const shuffledColors = shuffle([...PLAYER_COLORS], colorSeed);
  
  return playerConfigs.map((p, index) => ({
    id: p.id,
    name: p.name,
    avatarId: p.avatarId || 'default',
    color: shuffledColors[index % shuffledColors.length],
    hand: [],
    discardPile: [],
    tokens: 0,
    status: 'PLAYING' as const,
    isHost: p.isHost || false,
    isAI: p.isAI || false,
  }));
}

/**
 * Reset player states for a new round
 */
export function resetPlayersForRound(players: PlayerState[]): PlayerState[] {
  return players.map((p) => ({
    ...p,
    hand: [],
    discardPile: [],
    status: 'PLAYING' as const,
    eliminationReason: undefined,
  }));
}

/**
 * Get active (non-eliminated) players
 */
export function getActivePlayers(players: PlayerState[]): PlayerState[] {
  return players.filter(p => p.status !== 'ELIMINATED');
}

/**
 * Get players who have a specific card in their discard pile
 */
export function getPlayersWithCardInDiscard(
  players: PlayerState[],
  cardId: string,
  excludeEliminated = true
): PlayerState[] {
  return players.filter(p => {
    if (excludeEliminated && p.status === 'ELIMINATED') return false;
    return p.discardPile.includes(cardId);
  });
}

/**
 * Format a list of player names for display
 * e.g. ["Alice", "Bob", "Carol"] -> "Alice, Bob, and Carol"
 */
export function formatPlayerNames(names: string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return names.slice(0, -1).join(', ') + ', and ' + names[names.length - 1];
}
