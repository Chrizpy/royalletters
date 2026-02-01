import { writable, get } from 'svelte/store';
import { GameEngine } from '../engine/game';
import { decideAIMove, isActivePlayerAI, getActiveAIPlayerId } from '../engine/ai';
import type { GameState, GameAction, ActionResult, Ruleset } from '../types';

// Game engine instance (singleton for the session)
let engine: GameEngine | null = null;

// Pause timer duration in seconds (shared constant)
export const PAUSE_TIMER_SECONDS = 10;

// Reactive game state store
export const gameState = writable<GameState | null>(null);

// Whether the game has started
export const gameStarted = writable<boolean>(false);

// Revealed card (for Priest effect) - includes viewer to ensure only the right player sees it
export const revealedCard = writable<{ cardId: string; playerName: string; viewerPlayerId: string } | null>(null);

// Modal timer remaining seconds (updated from host tick messages)
// This is the single source of truth for the timer display
export const modalTimerRemaining = writable<number | null>(null);

// Game pause state - simplified to just track if paused and why
export interface GamePauseState {
  isPaused: boolean;
  reason: 'priest_reveal' | 'elimination' | null;
  targetPlayerId: string | null;  // The player who should see the modal
}

export const gamePaused = writable<GamePauseState>({
  isPaused: false,
  reason: null,
  targetPlayerId: null,
});

/**
 * Pause the game for a specific reason
 * The host will manage the timer and send ticks
 */
export function pauseGame(reason: 'priest_reveal' | 'elimination', targetPlayerId: string): void {
  gamePaused.set({
    isPaused: true,
    reason,
    targetPlayerId,
  });
  modalTimerRemaining.set(PAUSE_TIMER_SECONDS);
}

/**
 * Resume the game (called when modal is dismissed or timeout expires)
 */
export function resumeGame(): void {
  gamePaused.set({
    isPaused: false,
    reason: null,
    targetPlayerId: null,
  });
  modalTimerRemaining.set(null);
}

/**
 * Update the modal timer remaining (called when tick message is received)
 */
export function updateModalTimer(remainingSeconds: number | null): void {
  modalTimerRemaining.set(remainingSeconds);
}

/**
 * Check if the game is currently paused
 */
export function isGamePaused(): boolean {
  return get(gamePaused).isPaused;
}

/**
 * Initialize the game engine with players
 */
export function initGame(players: Array<{ id: string; name: string; isHost?: boolean; isAI?: boolean }>, ruleset: Ruleset = 'classic') {
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
 * Returns the result with additional pause info for the host to handle AI scheduling
 */
export function applyAction(action: GameAction): ActionResult | undefined {
  if (!engine) return;
  
  const result = engine.applyMove(action);
  const newState = engine.getState();
  
  // Handle Priest reveal - store the revealed card info with who should see it
  // The host will manage the pause timer and send ticks
  if (result.revealedCard) {
    const targetPlayer = newState.players.find(p => p.id === action.targetPlayerId);
    revealedCard.set({
      cardId: result.revealedCard,
      playerName: targetPlayer?.name || 'Unknown',
      viewerPlayerId: action.playerId  // Only the player who played Priest should see this
    });
    // Pause the game for the Priest reveal - target is the player who played Priest
    pauseGame('priest_reveal', action.playerId);
  }
  
  // Handle elimination - pause the game so the eliminated player sees their modal
  if (result.eliminatedPlayerId) {
    pauseGame('elimination', result.eliminatedPlayerId);
  }
  
  // Auto-draw for next player if needed
  if (newState.phase === 'TURN_START') {
    engine.drawPhase();
  }
  
  gameState.set(engine.getState());
  return result;
}

/**
 * Clear the revealed card (after user acknowledges) and resume the game
 */
export function clearRevealedCard() {
  revealedCard.set(null);
  resumeGame();
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

/**
 * Check if it's currently an AI player's turn
 */
export function checkIfAITurn(): boolean {
  const state = get(gameState);
  if (!state) return false;
  return isActivePlayerAI(state);
}

/**
 * Get AI move for the current active AI player
 * Returns null if not an AI's turn or no valid move
 */
export function getAIMove(): GameAction | null {
  const state = get(gameState);
  if (!state) return null;
  
  const aiPlayerId = getActiveAIPlayerId(state);
  if (!aiPlayerId) return null;
  
  return decideAIMove(state, aiPlayerId);
}

/**
 * Execute AI move if it's an AI's turn
 * Returns the result of the action, or undefined if not applicable
 */
export function executeAIMove(): ActionResult | undefined {
  const move = getAIMove();
  if (!move) return undefined;
  
  return applyAction(move);
}
