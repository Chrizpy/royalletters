/**
 * Tillbakakaka (Cookie Guard) effect handler (GUESS_CARD_REVENGE)
 * Like Guard, but if wrong, target gets a revenge guess
 */

import type { GameState, PlayerState, GameAction } from '../../types';
import type { EffectContext, EffectResult } from './types';
import { getCardDefinition } from '../deck';
import { eliminatePlayer, addLog } from './utils';

export function applyGuessCardRevenge(context: EffectContext): EffectResult {
  const { state, action, activePlayer } = context;
  const targetPlayer = state.players.find(p => p.id === action.targetPlayerId)!;
  const guess = action.targetCardGuess!;
  const guessCardDef = getCardDefinition(guess);
  const guessName = guessCardDef?.name || guess;

  if (targetPlayer.hand.includes(guess)) {
    // Correct guess - eliminate target (no revenge)
    eliminatePlayer(
      targetPlayer,
      `${activePlayer.name} correctly guessed you had ${guessName} (with Guard 🍪)`,
      state
    );
    addLog(`${targetPlayer.name} was eliminated (had ${guessName})`, state, targetPlayer.id);
    
    return {
      message: `Correct guess! ${targetPlayer.name} is eliminated`,
      eliminatedPlayerId: targetPlayer.id,
    };
  } else {
    // Incorrect guess - target gets a revenge guess!
    addLog(
      `${activePlayer.name} guessed ${targetPlayer.name} had ${guessName} (incorrectly) - 🍪 revenge time!`,
      state,
      activePlayer.id
    );
    
    // Set up revenge guess state
    state.revengeGuess = {
      revengerId: targetPlayer.id,
      targetId: activePlayer.id,
    };
    state.phase = 'WAITING_FOR_REVENGE_GUESS';
    
    return {
      message: `Incorrect guess! ${targetPlayer.name} gets a revenge guess!`,
      skipTurnAdvance: true,
    };
  }
}

/**
 * Apply the revenge guess from the targeted player
 */
export function applyRevengeGuess(
  action: GameAction,
  state: GameState
): EffectResult & { success: boolean } {
  // Validate revenge guess
  if (state.phase !== 'WAITING_FOR_REVENGE_GUESS') {
    return {
      success: false,
      message: 'Not in revenge guess phase',
    };
  }

  if (!state.revengeGuess) {
    return {
      success: false,
      message: 'No revenge guess pending',
    };
  }

  if (action.playerId !== state.revengeGuess.revengerId) {
    return {
      success: false,
      message: 'Not your revenge guess',
    };
  }

  // Cannot guess guard or tillbakakaka on revenge
  if (action.targetCardGuess === 'guard' || action.targetCardGuess === 'tillbakakaka') {
    return {
      success: false,
      message: 'Cannot guess Guard',
    };
  }

  const revenger = state.players.find(p => p.id === state.revengeGuess!.revengerId)!;
  const target = state.players.find(p => p.id === state.revengeGuess!.targetId)!;
  const guess = action.targetCardGuess!;
  const guessCardDef = getCardDefinition(guess);
  const guessName = guessCardDef?.name || guess;

  // Clear revenge state
  state.revengeGuess = undefined;

  if (target.hand.includes(guess)) {
    // Correct revenge guess - eliminate the original guesser!
    eliminatePlayer(
      target,
      `${revenger.name}'s revenge guess correctly identified you had ${guessName}`,
      state
    );
    addLog(`🍪 Revenge! ${revenger.name} correctly guessed ${target.name} had ${guessName}`, state, revenger.id);
    
    return {
      success: true,
      message: `Revenge successful! ${target.name} is eliminated`,
      eliminatedPlayerId: target.id,
    };
  } else {
    addLog(`🍪 ${revenger.name}'s revenge guess of ${guessName} was incorrect`, state, revenger.id);
    
    return {
      success: true,
      message: 'Revenge guess incorrect',
    };
  }
}
