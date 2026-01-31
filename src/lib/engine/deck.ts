import cardData from '../data/cards.json';
import type { CardDefinition, Ruleset } from '../types';
import { createRng } from './rng';

// Type for the new card data structure
interface CardRegistry {
  cards: Record<string, CardDefinition>;
  decks: Record<string, Record<string, number>>;
  classicCardValues: Record<string, number>;
}

const registry = cardData as unknown as CardRegistry;

/**
 * Get all card definitions as an array
 */
export function getCardDefinitions(): CardDefinition[] {
  return Object.values(registry.cards);
}

/**
 * Get a specific card definition by ID
 */
export function getCardDefinition(cardId: string): CardDefinition | undefined {
  return registry.cards[cardId];
}

/**
 * Get card value, adjusted for the ruleset
 * In classic mode, cards have their classic values (no Spy/Chancellor)
 * In 2019 mode, cards have their new values
 */
export function getCardValue(cardId: string, ruleset: Ruleset = 'classic'): number {
  const card = registry.cards[cardId];
  if (!card) return 0;
  
  if (ruleset === 'classic' && registry.classicCardValues[cardId] !== undefined) {
    return registry.classicCardValues[cardId];
  }
  return card.value;
}

/**
 * Create a deck of cards for the specified ruleset
 * @param ruleset The ruleset to use ('classic' or '2019')
 */
export function createDeck(ruleset: Ruleset = 'classic'): string[] {
  const deck: string[] = [];
  const deckDefinition = registry.decks[ruleset];
  
  if (!deckDefinition) {
    throw new Error(`Unknown ruleset: ${ruleset}`);
  }
  
  for (const [cardId, count] of Object.entries(deckDefinition)) {
    for (let i = 0; i < count; i++) {
      deck.push(cardId);
    }
  }
  
  return deck;
}

/**
 * Shuffle a deck using a deterministic RNG seed
 * Fisher-Yates shuffle algorithm
 */
export function shuffle(deck: string[], seed: string): string[] {
  const shuffled = [...deck];
  const rng = createRng(seed);
  
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  
  return shuffled;
}
