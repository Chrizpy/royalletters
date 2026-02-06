/**
 * Baron effect handler (COMPARE_HANDS)
 * Compare hands with another player - lower card is eliminated
 */

import type { EffectContext, EffectResult } from './types';
import { getCardDefinition, getCardValue } from '../deck';
import { eliminatePlayer, addLog } from './utils';

export function applyCompareHands(context: EffectContext): EffectResult {
  const { state, action, activePlayer } = context;
  const targetPlayer = state.players.find(p => p.id === action.targetPlayerId)!;
  
  const activeCard = activePlayer.hand[0];
  const targetCard = targetPlayer.hand[0];

  if (!activeCard || !targetCard) {
    return {
      message: 'Comparison failed - missing cards',
    };
  }

  const activeValue = getCardValue(activeCard, state.ruleset);
  const targetValue = getCardValue(targetCard, state.ruleset);
  const activeCardDef = getCardDefinition(activeCard);
  const targetCardDef = getCardDefinition(targetCard);

  if (activeValue < targetValue) {
    eliminatePlayer(
      activePlayer,
      `Lost Baron comparison to ${targetPlayer.name} (your ${activeCardDef?.name || activeCard} vs their ${targetCardDef?.name || targetCard})`,
      state
    );
    addLog(`${activePlayer.name} was eliminated (lower card)`, state, activePlayer.id);
    
    return {
      message: `You lost the comparison and are eliminated`,
      eliminatedPlayerId: activePlayer.id,
    };
  } else if (targetValue < activeValue) {
    eliminatePlayer(
      targetPlayer,
      `Lost Baron comparison to ${activePlayer.name} (your ${targetCardDef?.name || targetCard} vs their ${activeCardDef?.name || activeCard})`,
      state
    );
    addLog(`${targetPlayer.name} was eliminated (lower card)`, state, targetPlayer.id);
    
    return {
      message: `${targetPlayer.name} had lower card and is eliminated`,
      eliminatedPlayerId: targetPlayer.id,
    };
  } else {
    addLog('Comparison was a tie', state, activePlayer.id);
    
    return {
      message: 'Tie - no one eliminated',
    };
  }
}
