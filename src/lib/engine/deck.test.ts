import { describe, it, expect } from 'vitest';
import {
  getCardDefinitions,
  getCardDefinition,
  getCardValue,
  createDeck,
  shuffle,
} from './deck';

describe('deck', () => {
  describe('getCardDefinitions', () => {
    it('returns all card definitions as an array', () => {
      const cards = getCardDefinitions();
      expect(Array.isArray(cards)).toBe(true);
      expect(cards.length).toBeGreaterThan(0);
    });

    it('each card has required properties', () => {
      const cards = getCardDefinitions();
      for (const card of cards) {
        expect(card).toHaveProperty('id');
        expect(card).toHaveProperty('name');
        expect(card).toHaveProperty('value');
        expect(card).toHaveProperty('description');
        expect(card).toHaveProperty('effect');
      }
    });
  });

  describe('getCardDefinition', () => {
    it('returns correct card for valid ID', () => {
      const guard = getCardDefinition('guard');
      expect(guard).toBeDefined();
      expect(guard?.id).toBe('guard');
      expect(guard?.name).toBe('Guard');
      expect(guard?.value).toBe(1);
    });

    it('returns undefined for invalid ID', () => {
      const invalid = getCardDefinition('nonexistent');
      expect(invalid).toBeUndefined();
    });

    it('returns all expected cards', () => {
      const expectedCards = [
        'spy', 'guard', 'priest', 'baron', 'handmaid',
        'prince', 'chancellor', 'king', 'countess', 'princess'
      ];
      for (const cardId of expectedCards) {
        expect(getCardDefinition(cardId)).toBeDefined();
      }
    });
  });

  describe('getCardValue', () => {
    it('defaults to classic values', () => {
      // Default ruleset is 'classic', so princess is 8 not 9
      expect(getCardValue('guard')).toBe(1);
      expect(getCardValue('princess')).toBe(8);
    });

    it('returns classic values when ruleset is classic', () => {
      expect(getCardValue('guard', 'classic')).toBe(1);
      expect(getCardValue('king', 'classic')).toBe(6);
      expect(getCardValue('countess', 'classic')).toBe(7);
      expect(getCardValue('princess', 'classic')).toBe(8);
    });

    it('returns 2019 values when ruleset is 2019', () => {
      expect(getCardValue('spy', '2019')).toBe(0);
      expect(getCardValue('king', '2019')).toBe(7);
      expect(getCardValue('princess', '2019')).toBe(9);
    });

    it('returns 0 for invalid card ID', () => {
      expect(getCardValue('nonexistent')).toBe(0);
    });
  });

  describe('createDeck', () => {
    it('creates classic deck with 16 cards', () => {
      const deck = createDeck('classic');
      expect(deck.length).toBe(16);
    });

    it('creates 2019 deck with 21 cards', () => {
      const deck = createDeck('2019');
      expect(deck.length).toBe(21);
    });

    it('creates house deck with 21 cards', () => {
      const deck = createDeck('house');
      expect(deck.length).toBe(21);
    });

    it('classic deck has correct card distribution', () => {
      const deck = createDeck('classic');
      const counts = deck.reduce((acc, card) => {
        acc[card] = (acc[card] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      expect(counts['guard']).toBe(5);
      expect(counts['priest']).toBe(2);
      expect(counts['baron']).toBe(2);
      expect(counts['handmaid']).toBe(2);
      expect(counts['prince']).toBe(2);
      expect(counts['king']).toBe(1);
      expect(counts['countess']).toBe(1);
      expect(counts['princess']).toBe(1);
      expect(counts['spy']).toBeUndefined();
      expect(counts['chancellor']).toBeUndefined();
    });

    it('2019 deck includes spy and chancellor', () => {
      const deck = createDeck('2019');
      expect(deck).toContain('spy');
      expect(deck).toContain('chancellor');
    });

    it('throws error for unknown ruleset', () => {
      expect(() => createDeck('invalid' as any)).toThrow('Unknown ruleset: invalid');
    });

    it('defaults to classic ruleset', () => {
      const deck = createDeck();
      expect(deck.length).toBe(16);
      expect(deck).not.toContain('spy');
    });
  });

  describe('shuffle', () => {
    it('returns a new array (does not mutate original)', () => {
      const deck = createDeck('classic');
      const original = [...deck];
      const shuffled = shuffle(deck, 'test-seed');

      expect(deck).toEqual(original);
      expect(shuffled).not.toBe(deck);
    });

    it('contains the same cards after shuffling', () => {
      const deck = createDeck('classic');
      const shuffled = shuffle(deck, 'test-seed');

      expect(shuffled.sort()).toEqual(deck.sort());
    });

    it('is deterministic with the same seed', () => {
      const deck = createDeck('classic');
      const shuffled1 = shuffle(deck, 'same-seed');
      const shuffled2 = shuffle(deck, 'same-seed');

      expect(shuffled1).toEqual(shuffled2);
    });

    it('produces different results with different seeds', () => {
      const deck = createDeck('classic');
      const shuffled1 = shuffle(deck, 'seed-one');
      const shuffled2 = shuffle(deck, 'seed-two');

      expect(shuffled1).not.toEqual(shuffled2);
    });

    it('actually changes the order', () => {
      const deck = createDeck('classic');
      const shuffled = shuffle(deck, 'shuffle-test');

      expect(shuffled).not.toEqual(deck);
    });
  });
});
