/**
 * Guard effect handler (GUESS_CARD)
 * Guess another player's card - if correct, they are eliminated
 */

import type { EffectContext, EffectResult } from './types';
import { getCardDefinition } from '../deck';
import { eliminatePlayer, addLog } from './utils';

export function applyGuessCard(context: EffectContext): EffectResult {
  const { state, action, activePlayer } = context;
  const targetPlayer = state.players.find(p => p.id === action.targetPlayerId)!;
  const guess = action.targetCardGuess!;
  const guessCardDef = getCardDefinition(guess);
  const guessName = guessCardDef?.name || guess;

  if (targetPlayer.hand.includes(guess)) {
    eliminatePlayer(
      targetPlayer,
      `${activePlayer.name} correctly guessed you had ${guessName}`,
      state
    );
    addLog(`${targetPlayer.name} was eliminated (had ${guessName})`, state, targetPlayer.id);
    
    return {
      message: `Correct guess! ${targetPlayer.name} is eliminated`,
      eliminatedPlayerId: targetPlayer.id,
    };
  } else {
    addLog(
      `${activePlayer.name} guessed ${targetPlayer.name} had ${guessName} (incorrectly)`,
      state,
      activePlayer.id
    );
    
    return {
      message: 'Incorrect guess',
    };
  }
}
