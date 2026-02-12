import type { PlayerState } from '../types';

/**
 * Reorder all players for clockwise display in a 2-column grid.
 * The grid fills left-to-right, but we want visual clockwise order starting from local player:
 * - Top-left: local player (always first)
 * - Top-right: next player clockwise
 * - Then down the right column
 * - Then along bottom (right to left)
 * - Then up the left column
 *
 * For example, with 4 players where local is at index 0:
 * Turn order: [Local, P1, P2, P3]
 * Desired visual (clockwise):
 *   Local  P1
 *   P3     P2
 * Grid positions 0,1,2,3 should map to players: Local, P1, P3, P2
 */
export function reorderPlayersClockwise(
  players: PlayerState[],
  localPlayerId: string,
): PlayerState[] {
  if (players.length <= 2) {
    return players;
  }

  const localIndex = players.findIndex((p) => p.id === localPlayerId);
  if (localIndex === -1) return players;

  const count = players.length;
  const cols = 2;
  const reordered: PlayerState[] = [];

  // Map each grid position to the correct player in clockwise order
  for (let gridPos = 0; gridPos < count; gridPos++) {
    const row = Math.floor(gridPos / cols);
    const col = gridPos % cols;

    let playerOffset: number; // Offset from local player in turn order

    if (gridPos === 0) {
      // Top-left is always the local player
      playerOffset = 0;
    } else if (row === 0) {
      // Top row after local player: continue clockwise (next player in turn order)
      playerOffset = col;
    } else if (col === 1) {
      // Right column going down: continue in turn order
      playerOffset = row + 1;
    } else {
      // Left column going up from bottom
      playerOffset = count - row;
    }

    const playerIndex = (localIndex + playerOffset) % count;
    reordered.push(players[playerIndex]);
  }

  return reordered;
}
