import { describe, it, expect } from 'vitest';
import { createRng } from './rng';

describe('rng', () => {
  describe('createRng', () => {
    it('returns a function', () => {
      const rng = createRng('test-seed');
      expect(typeof rng).toBe('function');
    });

    it('returns numbers between 0 and 1', () => {
      const rng = createRng('test-seed');
      for (let i = 0; i < 100; i++) {
        const value = rng();
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1);
      }
    });

    it('is deterministic with the same seed', () => {
      const rng1 = createRng('same-seed');
      const rng2 = createRng('same-seed');

      const sequence1 = [rng1(), rng1(), rng1(), rng1(), rng1()];
      const sequence2 = [rng2(), rng2(), rng2(), rng2(), rng2()];

      expect(sequence1).toEqual(sequence2);
    });

    it('produces different sequences with different seeds', () => {
      const rng1 = createRng('seed-one');
      const rng2 = createRng('seed-two');

      const sequence1 = [rng1(), rng1(), rng1()];
      const sequence2 = [rng2(), rng2(), rng2()];

      expect(sequence1).not.toEqual(sequence2);
    });

    it('produces different values on consecutive calls', () => {
      const rng = createRng('test-seed');
      const values = new Set<number>();
      
      for (let i = 0; i < 10; i++) {
        values.add(rng());
      }
      
      // Should have 10 unique values (extremely unlikely to have duplicates)
      expect(values.size).toBe(10);
    });
  });
});
