/**
 * Game constants and configuration values
 */

/**
 * Color palette for player colors (distinct, readable on dark backgrounds)
 */
export const PLAYER_COLORS = [
  '#00D4FF',  // Cyan
  '#FFD93D',  // Gold
  '#32CD32',  // Lime Green
  '#A855F7',  // Purple
  '#FF69B4',  // Hot Pink
  '#FF8C42',  // Orange
] as const;

/**
 * Number of tokens needed to win based on player count
 * Per official Love Letter rules
 */
export const TOKENS_TO_WIN_MAP: Record<number, number> = {
  2: 6,
  3: 5,
  4: 4,
  5: 3,
  6: 3,
};

/**
 * Get the number of tokens needed to win for a given player count
 */
export function getTokensToWin(playerCount: number): number {
  return TOKENS_TO_WIN_MAP[playerCount] ?? 4;
}
