import seedrandom from 'seedrandom';

/**
 * Creates a deterministic random number generator from a seed string
 * @param seed - The seed string for the RNG
 * @returns A function that returns a random number between 0 and 1
 */
export function createRng(seed: string): () => number {
  return seedrandom(seed);
}
