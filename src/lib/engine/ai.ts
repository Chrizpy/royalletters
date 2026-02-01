import type { GameState, GameAction, PlayerState, Ruleset } from '../types';
import { getCardDefinition, getCardValue } from './deck';

/**
 * AI player decision-making engine
 * Implements a basic strategy for playing Love Letter
 */

/**
 * Get all valid target players for a given card
 */
function getValidTargets(
  state: GameState,
  playerId: string,
  canTargetSelf: boolean
): PlayerState[] {
  return state.players.filter((p) => {
    if (p.id === playerId && !canTargetSelf) return false;
    if (p.status === 'ELIMINATED') return false;
    if (p.status === 'PROTECTED' && p.id !== playerId) return false;
    return true;
  });
}

/**
 * Get possible card guesses for Guard (excludes Guard itself, and Spy if classic ruleset)
 */
function getPossibleGuesses(ruleset: Ruleset): string[] {
  const guesses = ['priest', 'baron', 'handmaid', 'prince', 'king', 'countess', 'princess'];
  if (ruleset === '2019') {
    // In 2019 edition, can also guess Spy and Chancellor
    guesses.push('spy', 'chancellor');
  }
  return guesses;
}

/**
 * Choose a card to guess for Guard based on simple probability
 * Considers what cards have been played (in discard piles) and burned cards
 */
function chooseGuardGuess(
  state: GameState,
  targetPlayer: PlayerState
): string {
  const possibleGuesses = getPossibleGuesses(state.ruleset);
  
  // Count cards that have been discarded or burned
  const seenCards: Record<string, number> = {};
  
  // Count discarded cards from all players
  for (const player of state.players) {
    for (const card of player.discardPile) {
      seenCards[card] = (seenCards[card] || 0) + 1;
    }
  }
  
  // Count burned face-up cards (for 2-player games)
  for (const card of state.burnedCardsFaceUp) {
    seenCards[card] = (seenCards[card] || 0) + 1;
  }
  
  // Get deck composition for the ruleset
  const deckComposition = state.ruleset === '2019' ? {
    spy: 2,
    guard: 6,
    priest: 2,
    baron: 2,
    handmaid: 2,
    prince: 2,
    chancellor: 2,
    king: 1,
    countess: 1,
    princess: 1,
  } : {
    guard: 5,
    priest: 2,
    baron: 2,
    handmaid: 2,
    prince: 2,
    king: 1,
    countess: 1,
    princess: 1,
  };
  
  // Calculate remaining cards
  const remainingCards: Array<{ cardId: string; count: number }> = [];
  
  for (const guess of possibleGuesses) {
    const totalCount = deckComposition[guess as keyof typeof deckComposition] || 0;
    const seenCount = seenCards[guess] || 0;
    const remaining = totalCount - seenCount;
    
    if (remaining > 0) {
      remainingCards.push({ cardId: guess, count: remaining });
    }
  }
  
  if (remainingCards.length === 0) {
    // Fallback: just guess priest (common and low-value)
    return 'priest';
  }
  
  // Weight towards higher-value cards (Princess, Countess, King, Prince)
  // as eliminating them is more valuable
  const weightedCards = remainingCards.map((card) => {
    const cardDef = getCardDefinition(card.cardId);
    const value = cardDef ? getCardValue(card.cardId, state.ruleset) : 1;
    // Weight = remaining count * card value (higher value cards are more valuable to guess)
    return { ...card, weight: card.count * value };
  });
  
  // Sort by weight descending
  weightedCards.sort((a, b) => b.weight - a.weight);
  
  // Return the highest weighted guess
  return weightedCards[0].cardId;
}

/**
 * Choose which card to play from hand
 */
function chooseCardToPlay(player: PlayerState, state: GameState): string {
  const hand = [...player.hand];
  
  // Countess rule: If player has Countess + (King or Prince), must play Countess
  const hasCountess = hand.includes('countess');
  const hasKing = hand.includes('king');
  const hasPrince = hand.includes('prince');
  
  if (hasCountess && (hasKing || hasPrince)) {
    return 'countess';
  }
  
  // Basic strategy: avoid playing Princess (auto-lose)
  const nonPrincessCards = hand.filter((c) => c !== 'princess');
  if (nonPrincessCards.length > 0) {
    // Prefer to play lower value cards first to avoid elimination in Baron comparisons
    nonPrincessCards.sort((a, b) => {
      const aValue = getCardValue(a, state.ruleset);
      const bValue = getCardValue(b, state.ruleset);
      return aValue - bValue;
    });
    return nonPrincessCards[0];
  }
  
  // If only Princess left, we have to play it
  return hand[0];
}

/**
 * Choose a target player for targeted cards
 * Prioritizes players with the most tokens (they're closest to winning)
 */
function chooseTarget(
  state: GameState,
  playerId: string,
  cardId: string
): string | undefined {
  const cardDef = getCardDefinition(cardId);
  if (!cardDef || !cardDef.effect.requiresTargetPlayer) {
    return undefined;
  }
  
  const canTargetSelf = cardDef.effect.canTargetSelf || false;
  const validTargets = getValidTargets(state, playerId, canTargetSelf);
  
  // Filter out self for most cards unless it's Prince and self is only option
  const otherTargets = validTargets.filter((p) => p.id !== playerId);
  
  if (otherTargets.length > 0) {
    // Prioritize targeting the player with the most tokens (closest to winning)
    // Sort by tokens descending, then take the first one
    const sortedByTokens = [...otherTargets].sort((a, b) => b.tokens - a.tokens);
    return sortedByTokens[0].id;
  }
  
  // If Prince and no other targets, can target self
  if (cardId === 'prince' && canTargetSelf) {
    const self = validTargets.find((p) => p.id === playerId);
    if (self) {
      return self.id;
    }
  }
  
  // No valid targets - card will be played with no effect
  return undefined;
}

/**
 * Main AI decision function: given the current game state and AI player,
 * returns the action the AI should take.
 */
export function decideAIMove(state: GameState, playerId: string): GameAction | null {
  const player = state.players.find((p) => p.id === playerId);
  if (!player || player.status === 'ELIMINATED') {
    return null;
  }
  
  // Handle Chancellor resolving phase
  if (state.phase === 'CHANCELLOR_RESOLVING') {
    return decideChancellorReturn(state, playerId);
  }
  
  if (state.phase !== 'WAITING_FOR_ACTION') {
    return null;
  }
  
  if (player.hand.length === 0) {
    return null;
  }
  
  // Choose which card to play
  const cardToPlay = chooseCardToPlay(player, state);
  
  // Choose target if needed
  const targetPlayerId = chooseTarget(state, playerId, cardToPlay);
  
  // Choose card guess for Guard
  let targetCardGuess: string | undefined;
  const cardDef = getCardDefinition(cardToPlay);
  if (cardDef?.effect.requiresTargetCardType && targetPlayerId) {
    const targetPlayer = state.players.find((p) => p.id === targetPlayerId);
    if (targetPlayer) {
      targetCardGuess = chooseGuardGuess(state, targetPlayer);
    }
  }
  
  return {
    type: 'PLAY_CARD',
    playerId,
    cardId: cardToPlay,
    targetPlayerId,
    targetCardGuess,
  };
}

/**
 * Decide which cards to return for Chancellor effect
 */
function decideChancellorReturn(state: GameState, playerId: string): GameAction | null {
  const player = state.players.find((p) => p.id === playerId);
  if (!player || player.hand.length < 2) {
    return null;
  }
  
  // Number of cards to return = hand size - 1 (keep exactly 1 card)
  const cardsToReturnCount = player.hand.length - 1;
  
  // Strategy: keep the highest value card (for round-end comparison)
  // Sort hand by value descending
  const sortedHand = [...player.hand].sort((a, b) => {
    const aValue = getCardValue(a, state.ruleset);
    const bValue = getCardValue(b, state.ruleset);
    return bValue - aValue;
  });
  
  // Keep the highest value card, return the rest (up to cardsToReturnCount)
  const cardsToReturn = sortedHand.slice(1, 1 + cardsToReturnCount);
  
  return {
    type: 'CHANCELLOR_RETURN',
    playerId,
    cardsToReturn,
  };
}

/**
 * Check if the active player is an AI
 */
export function isActivePlayerAI(state: GameState): boolean {
  const activePlayer = state.players[state.activePlayerIndex];
  return activePlayer?.isAI === true;
}

/**
 * Get the active AI player's ID if it's an AI's turn
 */
export function getActiveAIPlayerId(state: GameState): string | null {
  const activePlayer = state.players[state.activePlayerIndex];
  if (activePlayer?.isAI) {
    return activePlayer.id;
  }
  return null;
}
