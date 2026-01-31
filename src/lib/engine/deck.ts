import cardDefinitions from '../data/cards.json';
import type { CardDefinition } from '../types';
import { createRng } from './rng';

/**
 * Load card definitions from JSON
 */
export function getCardDefinitions(): CardDefinition[] {
  return cardDefinitions as CardDefinition[];
}

/**
 * Get a specific card definition by ID
 */
export function getCardDefinition(cardId: string): CardDefinition | undefined {
  return getCardDefinitions().find(card => card.id === cardId);
}

/**
 * Create a deck of cards by expanding cards based on their count property
 * Example: 5 Guards creates 5 "guard" instances in the deck
 */
export function createDeck(): string[] {
  const deck: string[] = [];
  const definitions = getCardDefinitions();
  
  for (const card of definitions) {
    for (let i = 0; i < card.count; i++) {
      deck.push(card.id);
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
