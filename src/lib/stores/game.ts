import { writable, get } from 'svelte/store';
import { GameEngine } from '../engine/game';
import type { GameState, GameAction, ActionResult, Ruleset } from '../types';

// Game engine instance (singleton for the session)
let engine: GameEngine | null = null;

// Reactive game state store
export const gameState = writable<GameState | null>(null);

// Whether the game has started
export const gameStarted = writable<boolean>(false);

// Revealed card (for Priest effect) - includes viewer to ensure only the right player sees it
export const revealedCard = writable<{ cardId: string; playerName: string; viewerPlayerId: string } | null>(null);

/**
 * Initialize the game engine with players
 */
export function initGame(players: Array<{ id: string; name: string; isHost?: boolean }>, ruleset: Ruleset = 'classic') {
  engine = new GameEngine();
  engine.init({ players, ruleset });
  gameState.set(engine.getState());
}

/**
 * Get the game engine instance
 */
export function getEngine(): GameEngine | null {
  return engine;
}

/**
 * Start a new round
 */
export function startRound() {
  if (!engine) return;
  engine.startRound();
  engine.drawPhase();
  gameState.set(engine.getState());
  gameStarted.set(true);
}

/**
 * Draw phase - active player draws a card
 */
export function drawCard() {
  if (!engine) return;
  const state = engine.getState();
  if (state.phase === 'TURN_START') {
    engine.drawPhase();
    gameState.set(engine.getState());
  }
}

/**
 * Apply a player action (play card)
 */
export function applyAction(action: GameAction): ActionResult | undefined {
  if (!engine) return;
  
  const result = engine.applyMove(action);
  const newState = engine.getState();
  
  // Handle Priest reveal - store the revealed card info with who should see it
  if (result.revealedCard) {
    const targetPlayer = newState.players.find(p => p.id === action.targetPlayerId);
    revealedCard.set({
      cardId: result.revealedCard,
      playerName: targetPlayer?.name || 'Unknown',
      viewerPlayerId: action.playerId  // Only the player who played Priest should see this
    });
  }
  
  // Auto-draw for next player if needed
  if (newState.phase === 'TURN_START') {
    engine.drawPhase();
  }
  
  gameState.set(engine.getState());
  return result;
}

/**
 * Clear the revealed card (after user acknowledges)
 */
export function clearRevealedCard() {
  revealedCard.set(null);
}

/**
 * Set game state (for syncing from host)
 */
export function setGameState(state: GameState) {
  if (!engine) {
    engine = new GameEngine();
  }
  engine.setState(state);
  gameState.set(state);
  
  if (state.phase !== 'LOBBY') {
    gameStarted.set(true);
  }
}

/**
 * Get current game state
 */
export function getGameState(): GameState | null {
  return get(gameState);
}

/**
 * Reset the game
 */
export function resetGame() {
  engine = null;
  gameState.set(null);
  gameStarted.set(false);
}
