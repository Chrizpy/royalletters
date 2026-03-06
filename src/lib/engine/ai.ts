import type { GameState, GameAction, PlayerState, Ruleset } from '../types';
import { getCardDefinition, getCardValue, createDeck } from './deck';
import { getValidTargets } from './validation';
import {
  GUARD,
  PRIEST,
  BARON,
  HANDMAID,
  PRINCE,
  KING,
  COUNTESS,
  PRINCESS,
  SPY,
  CHANCELLOR,
} from './cardIds';

/**
 * AI player decision-making engine
 * Implements a strategy for playing Love Letter that uses card knowledge
 * gained from Priest plays and other public information.
 */

/** Module-level cache: deck composition never changes for a given ruleset */
const deckCompositionCache: Partial<Record<Ruleset, Record<string, number>>> =
  {};

/**
 * Get deck composition for a ruleset by counting cards in a created deck
 */
function getDeckComposition(ruleset: Ruleset): Record<string, number> {
  const cached = deckCompositionCache[ruleset];
  if (cached) {
    return cached;
  }

  const deck = createDeck(ruleset);
  const composition: Record<string, number> = {};
  for (const card of deck) {
    composition[card] = (composition[card] || 0) + 1;
  }
  deckCompositionCache[ruleset] = composition;
  return composition;
}

/**
 * Get possible card guesses for Guard (excludes Guard and tillbakakaka, and Spy if classic ruleset)
 */
function getPossibleGuesses(ruleset: Ruleset): string[] {
  const guesses = [PRIEST, BARON, HANDMAID, PRINCE, KING, COUNTESS, PRINCESS];
  if (ruleset === '2019' || ruleset === 'house') {
    // In 2019/house edition, can also guess Spy and Chancellor
    guesses.push(SPY, CHANCELLOR);
  }
  return guesses;
}

/**
 * Choose a card to guess for Guard/revenge based on probability and known information.
 * If the actor already knows the target's card (via Priest), use that directly.
 */
function chooseGuardGuess(
  state: GameState,
  targetPlayer: PlayerState,
  actorPlayer: PlayerState,
): string {
  const possibleGuesses = getPossibleGuesses(state.ruleset);

  // If we KNOW the target's card (from a previous Priest play), use it — guaranteed kill
  const knownCard = actorPlayer.knownCards?.[targetPlayer.id];
  if (knownCard && possibleGuesses.includes(knownCard)) {
    return knownCard;
  }

  // Fall back to probability-based guessing
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

  // Get deck composition for the ruleset dynamically
  const deckComposition = getDeckComposition(state.ruleset);

  // Calculate remaining cards
  const remainingCards: Array<{ cardId: string; count: number }> = [];

  for (const guess of possibleGuesses) {
    const totalCount =
      deckComposition[guess as keyof typeof deckComposition] || 0;
    const seenCount = seenCards[guess] || 0;
    const remaining = totalCount - seenCount;

    if (remaining > 0) {
      remainingCards.push({ cardId: guess, count: remaining });
    }
  }

  if (remainingCards.length === 0) {
    // Fallback: just guess priest (common and low-value)
    return PRIEST;
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
 * Get targetable opponents (not self, not protected, not eliminated).
 */
function getTargetableOpponents(
  state: GameState,
  playerId: string,
): PlayerState[] {
  return getValidTargets(state, playerId, false).filter(
    (p) => p.id !== playerId,
  );
}

/**
 * Choose which card to play from hand, using strategic priorities:
 * 1. Mandatory Countess rule
 * 2. Play Guard when we know a target's card (guaranteed kill)
 * 3. Play Baron when we know a target has a lower card (guaranteed win)
 * 4. Play Handmaid when exposed — protection prevents opponents acting on their knowledge
 * 5. Play Prince on self only for high-value exposed cards (≥5, i.e. King+)
 * 6. Play King to steal a known higher card
 * 7. Default: avoid Princess; prefer lower-value cards
 */
function chooseCardToPlay(player: PlayerState, state: GameState): string {
  const hand = [...player.hand];

  // Countess rule: must play Countess when holding King or Prince
  const hasCountess = hand.includes(COUNTESS);
  const hasKing = hand.includes(KING);
  const hasPrince = hand.includes(PRINCE);

  if (hasCountess && (hasKing || hasPrince)) {
    return COUNTESS;
  }

  // Never deliberately play Princess (auto-lose)
  const playableCards = hand.filter((c) => c !== PRINCESS);
  if (playableCards.length === 0) {
    return PRINCESS; // No choice
  }

  const opponents = getTargetableOpponents(state, player.id);
  const isExposed = (player.exposedToPlayerIds?.length ?? 0) > 0;

  // Priority 1: Play Guard if we KNOW an opponent's card — guaranteed elimination
  if (playableCards.includes(GUARD) && opponents.length > 0) {
    const possibleGuesses = getPossibleGuesses(state.ruleset);
    const hasKnownTarget = opponents.some((p) => {
      const known = player.knownCards?.[p.id];
      return known !== undefined && possibleGuesses.includes(known);
    });
    if (hasKnownTarget) {
      return GUARD;
    }
  }

  // Priority 2: Play Baron if we know an opponent holds a LOWER card than ours
  if (playableCards.includes(BARON) && opponents.length > 0) {
    const myOtherCard = playableCards.find((c) => c !== BARON);
    if (myOtherCard) {
      const myValue = getCardValue(myOtherCard, state.ruleset);
      const hasWeakerTarget = opponents.some((p) => {
        const known = player.knownCards?.[p.id];
        return known !== undefined && getCardValue(known, state.ruleset) < myValue;
      });
      if (hasWeakerTarget) {
        return BARON;
      }
    }
  }

  // Priority 3: Play Handmaid when exposed — gains full-round protection, nullifying opponent knowledge.
  // This is always better than self-Princing to discard the Handmaid.
  if (playableCards.includes(HANDMAID) && isExposed) {
    return HANDMAID;
  }

  // Priority 4: Play Prince on self when a HIGH-VALUE card is exposed (value ≥ 5).
  // Only worthwhile for King-level cards that an opponent would specifically Guard-guess.
  // Low-value cards (Guard, Priest, Handmaid, Baron) are not worth discarding to escape.
  if (playableCards.includes(PRINCE) && isExposed) {
    const cardToDiscard = playableCards.find((c) => c !== PRINCE);
    const discardValue = cardToDiscard
      ? getCardValue(cardToDiscard, state.ruleset)
      : 0;
    if (
      cardToDiscard &&
      cardToDiscard !== PRINCESS &&
      cardToDiscard !== HANDMAID &&
      discardValue >= 5
    ) {
      return PRINCE;
    }
  }

  // Priority 5: Play King to steal a known card that is better than ours
  if (playableCards.includes(KING) && opponents.length > 0) {
    const myOtherCard = playableCards.find((c) => c !== KING);
    if (myOtherCard) {
      const myValue = getCardValue(myOtherCard, state.ruleset);
      const hasBetterTarget = opponents.some((p) => {
        const known = player.knownCards?.[p.id];
        return known !== undefined && getCardValue(known, state.ruleset) > myValue;
      });
      if (hasBetterTarget) {
        return KING;
      }
    }
  }

  // Default: play the lowest-value non-Princess card
  playableCards.sort((a, b) => {
    const aValue = getCardValue(a, state.ruleset);
    const bValue = getCardValue(b, state.ruleset);
    return aValue - bValue;
  });
  return playableCards[0];
}

/**
 * Choose a target player for the given card, using card knowledge where available.
 *
 * - Guard: target the player whose card we know (for a certain kill)
 * - Baron: target the player we know has a lower card than ours
 * - Prince: target self when card is exposed; otherwise target highest-token player
 * - King: target the player whose card we know is higher than ours
 * - Others: target the player closest to winning (most tokens)
 */
function chooseTarget(
  state: GameState,
  playerId: string,
  cardId: string,
): string | undefined {
  const cardDef = getCardDefinition(cardId);
  if (!cardDef || !cardDef.effect.requiresTargetPlayer) {
    return undefined;
  }

  const canTargetSelf = cardDef.effect.canTargetSelf || false;
  const validTargets = getValidTargets(state, playerId, canTargetSelf);
  const player = state.players.find((p) => p.id === playerId)!;
  const opponents = validTargets.filter((p) => p.id !== playerId);

  // --- Guard: prefer the opponent whose card we know (certain elimination) ---
  if (cardId === GUARD && opponents.length > 0) {
    const possibleGuesses = getPossibleGuesses(state.ruleset);
    const knownTarget = opponents.find((p) => {
      const known = player.knownCards?.[p.id];
      return known !== undefined && possibleGuesses.includes(known);
    });
    if (knownTarget) return knownTarget.id;
  }

  // --- Baron: prefer an opponent we know has a lower card than ours ---
  if (cardId === BARON && opponents.length > 0) {
    const myOtherCard = player.hand.find((c) => c !== BARON);
    if (myOtherCard) {
      const myValue = getCardValue(myOtherCard, state.ruleset);
      const weakTarget = opponents
        .filter((p) => {
          const known = player.knownCards?.[p.id];
          return known !== undefined && getCardValue(known, state.ruleset) < myValue;
        })
        .sort((a, b) => b.tokens - a.tokens)[0]; // Among weak targets, pick highest-token
      if (weakTarget) return weakTarget.id;
    }
  }

  // --- Prince: self-target only when a HIGH-VALUE card (≥5) has been exposed ---
  if (cardId === PRINCE && canTargetSelf) {
    const isExposed = (player.exposedToPlayerIds?.length ?? 0) > 0;
    if (isExposed) {
      const cardToDiscard = player.hand.find((c) => c !== PRINCE);
      const discardValue = cardToDiscard
        ? getCardValue(cardToDiscard, state.ruleset)
        : 0;
      if (
        cardToDiscard &&
        cardToDiscard !== PRINCESS &&
        cardToDiscard !== HANDMAID &&
        discardValue >= 5
      ) {
        return player.id;
      }
    }
  }

  // --- King: prefer an opponent whose card we know is better than ours ---
  if (cardId === KING && opponents.length > 0) {
    const myOtherCard = player.hand.find((c) => c !== KING);
    if (myOtherCard) {
      const myValue = getCardValue(myOtherCard, state.ruleset);
      const richTarget = opponents
        .filter((p) => {
          const known = player.knownCards?.[p.id];
          return known !== undefined && getCardValue(known, state.ruleset) > myValue;
        })
        .sort((a, b) => b.tokens - a.tokens)[0]; // Among better targets, pick highest-token
      if (richTarget) return richTarget.id;
    }
  }

  // --- Default: target the opponent with the most tokens (closest to winning) ---
  if (opponents.length > 0) {
    const sortedByTokens = [...opponents].sort((a, b) => b.tokens - a.tokens);
    return sortedByTokens[0].id;
  }

  // Prince can target self as last resort
  if (cardId === PRINCE && canTargetSelf) {
    const self = validTargets.find((p) => p.id === playerId);
    if (self) return self.id;
  }

  return undefined;
}

/**
 * Main AI decision function: given the current game state and AI player,
 * returns the action the AI should take.
 */
export function decideAIMove(
  state: GameState,
  playerId: string,
): GameAction | null {
  const player = state.players.find((p) => p.id === playerId);
  if (!player || player.status === 'ELIMINATED') {
    return null;
  }

  // Handle Chancellor resolving phase
  if (state.phase === 'CHANCELLOR_RESOLVING') {
    return decideChancellorReturn(state, playerId);
  }

  // Handle revenge guess phase (tillbakakaka)
  if (state.phase === 'WAITING_FOR_REVENGE_GUESS') {
    return decideRevengeGuess(state, playerId);
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

  // Choose card guess for Guard or tillbakakaka
  let targetCardGuess: string | undefined;
  const cardDef = getCardDefinition(cardToPlay);
  if (cardDef?.effect.requiresTargetCardType && targetPlayerId) {
    const targetPlayer = state.players.find((p) => p.id === targetPlayerId);
    if (targetPlayer) {
      targetCardGuess = chooseGuardGuess(state, targetPlayer, player);
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
 * Decide which cards to return for Chancellor effect.
 * Strategy: keep the card that is most useful given current knowledge.
 * - If we know an opponent's card, prefer keeping Guard (to eliminate them) or
 *   a card that beats them in a Baron comparison.
 * - Otherwise keep the highest-value card for round-end comparison.
 */
function decideChancellorReturn(
  state: GameState,
  playerId: string,
): GameAction | null {
  const player = state.players.find((p) => p.id === playerId);
  if (!player || player.hand.length < 2) {
    return null;
  }

  const cardsToReturnCount = player.hand.length - 1;
  const opponents = getTargetableOpponents(state, playerId);

  // Check if we know any opponent's card
  const knownOpponent = opponents.find(
    (p) => player.knownCards?.[p.id] !== undefined,
  );

  let cardToKeep: string;

  if (knownOpponent) {
    const knownCard = player.knownCards![knownOpponent.id]!;
    const knownValue = getCardValue(knownCard, state.ruleset);
    const possibleGuesses = getPossibleGuesses(state.ruleset);

    // If opponent holds a guessable card, prefer keeping Guard for a certain kill
    if (player.hand.includes(GUARD) && possibleGuesses.includes(knownCard)) {
      cardToKeep = GUARD;
    } else {
      // Keep the card that beats the known opponent card in Baron, or highest otherwise
      const beatingCard = player.hand
        .filter((c) => c !== PRINCESS) // don't keep princess if alternatives exist
        .find((c) => getCardValue(c, state.ruleset) > knownValue);
      cardToKeep = beatingCard ?? player.hand.reduce((best, c) =>
        getCardValue(c, state.ruleset) >= getCardValue(best, state.ruleset) ? c : best,
      );
    }
  } else {
    // No knowledge — keep the highest-value card (maximises round-end win chance)
    cardToKeep = player.hand.reduce((best, c) =>
      getCardValue(c, state.ruleset) >= getCardValue(best, state.ruleset) ? c : best,
    );
  }

  // Return all cards except the one we want to keep
  const remaining = [...player.hand];
  const keepIndex = remaining.indexOf(cardToKeep);
  remaining.splice(keepIndex, 1);
  const cardsToReturn = remaining.slice(0, cardsToReturnCount);

  return {
    type: 'CHANCELLOR_RETURN',
    playerId,
    cardsToReturn,
  };
}

/**
 * Decide what card to guess for revenge (tillbakakaka effect)
 */
function decideRevengeGuess(
  state: GameState,
  playerId: string,
): GameAction | null {
  // Check if this player is the one who should make the revenge guess
  if (!state.revengeGuess || state.revengeGuess.revengerId !== playerId) {
    return null;
  }

  const player = state.players.find((p) => p.id === playerId)!;
  const targetPlayer = state.players.find(
    (p) => p.id === state.revengeGuess!.targetId,
  );
  if (!targetPlayer) {
    return null;
  }

  // Use the same logic as Guard guess, including any knowledge we have
  const guess = chooseGuardGuess(state, targetPlayer, player);

  return {
    type: 'REVENGE_GUESS',
    playerId,
    targetCardGuess: guess,
  };
}

/**
 * Check if the active player is an AI (or in revenge phase, if the revenger is AI)
 */
export function isActivePlayerAI(state: GameState): boolean {
  // In revenge phase, the "active" player is the revenger
  if (state.phase === 'WAITING_FOR_REVENGE_GUESS' && state.revengeGuess) {
    const revenger = state.players.find(
      (p) => p.id === state.revengeGuess!.revengerId,
    );
    return revenger?.isAI === true;
  }

  const activePlayer = state.players[state.activePlayerIndex];
  return activePlayer?.isAI === true;
}

/**
 * Get the active AI player's ID if it's an AI's turn (or revenge turn)
 */
export function getActiveAIPlayerId(state: GameState): string | null {
  // In revenge phase, the "active" player is the revenger
  if (state.phase === 'WAITING_FOR_REVENGE_GUESS' && state.revengeGuess) {
    const revenger = state.players.find(
      (p) => p.id === state.revengeGuess!.revengerId,
    );
    if (revenger?.isAI) {
      return revenger.id;
    }
    return null;
  }

  const activePlayer = state.players[state.activePlayerIndex];
  if (activePlayer?.isAI) {
    return activePlayer.id;
  }
  return null;
}
