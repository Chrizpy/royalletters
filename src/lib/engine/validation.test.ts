/**
 * Tests for validation module
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  validateCardPlay,
  validateCountessRule,
  validateTarget,
  validateGuardGuess,
  getValidTargets,
} from './validation';
import type { GameState, GameAction, PlayerState } from '../types';

describe('Validation Module', () => {
  let mockState: GameState;
  let mockPlayer1: PlayerState;
  let mockPlayer2: PlayerState;
  let mockPlayer3: PlayerState;

  beforeEach(() => {
    mockPlayer1 = {
      id: 'p1',
      name: 'Alice',
      avatarId: 'default',
      color: '#00D4FF',
      hand: ['guard', 'priest'],
      discardPile: [],
      tokens: 0,
      status: 'PLAYING',
      isHost: true,
    };

    mockPlayer2 = {
      id: 'p2',
      name: 'Bob',
      avatarId: 'default',
      color: '#FFD93D',
      hand: ['baron'],
      discardPile: [],
      tokens: 0,
      status: 'PLAYING',
      isHost: false,
    };

    mockPlayer3 = {
      id: 'p3',
      name: 'Charlie',
      avatarId: 'default',
      color: '#FF6B6B',
      hand: ['priest'],
      discardPile: [],
      tokens: 0,
      status: 'PLAYING',
      isHost: false,
    };

    mockState = {
      players: [mockPlayer1, mockPlayer2, mockPlayer3],
      deck: ['princess', 'king'],
      burnedCard: 'handmaid',
      burnedCardsFaceUp: [],
      activePlayerIndex: 0,
      phase: 'WAITING_FOR_ACTION',
      pendingAction: null,
      winnerIds: [],
      lastRoundWinnerId: null,
      logs: [],
      rngSeed: 'test-seed',
      roundCount: 1,
      ruleset: 'classic',
      tokensToWin: 4,
    };
  });

  describe('validateCountessRule', () => {
    it('should require Countess to be played when holding King', () => {
      const result = validateCountessRule(['countess', 'king'], 'king');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Countess');
    });

    it('should require Countess to be played when holding Prince', () => {
      const result = validateCountessRule(['countess', 'prince'], 'prince');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Countess');
    });

    it('should allow playing Countess when holding King', () => {
      const result = validateCountessRule(['countess', 'king'], 'countess');
      expect(result.valid).toBe(true);
    });

    it('should allow any card when not holding Countess', () => {
      const result = validateCountessRule(['king', 'prince'], 'king');
      expect(result.valid).toBe(true);
    });

    it('should allow any card when holding Countess without King/Prince', () => {
      const result = validateCountessRule(['countess', 'guard'], 'guard');
      expect(result.valid).toBe(true);
    });
  });

  describe('validateGuardGuess', () => {
    it('should not allow guessing Guard with Guard', () => {
      const result = validateGuardGuess('guard', 'guard');
      expect(result.valid).toBe(false);
    });

    it('should not allow guessing tillbakakaka with Guard', () => {
      const result = validateGuardGuess('guard', 'tillbakakaka');
      expect(result.valid).toBe(false);
    });

    it('should allow guessing other cards with Guard', () => {
      const result = validateGuardGuess('guard', 'priest');
      expect(result.valid).toBe(true);
    });

    it('should allow any guess with non-Guard cards', () => {
      const result = validateGuardGuess('priest', 'guard');
      expect(result.valid).toBe(true);
    });
  });

  describe('getValidTargets', () => {
    it('should exclude eliminated players', () => {
      mockPlayer2.status = 'ELIMINATED';
      mockPlayer3.status = 'ELIMINATED';
      const targets = getValidTargets(mockState, 'p1', false);
      expect(targets).toHaveLength(0);
    });

    it('should exclude protected players (except self if allowed)', () => {
      mockPlayer2.status = 'PROTECTED';
      mockPlayer3.status = 'PROTECTED';
      const targets = getValidTargets(mockState, 'p1', false);
      expect(targets).toHaveLength(0);
    });

    it('should include self when canTargetSelf is true', () => {
      const targets = getValidTargets(mockState, 'p1', true);
      // p1 (self), p2, p3 - all 3 players are valid targets
      expect(targets).toHaveLength(3);
      expect(targets.map(t => t.id)).toContain('p1');
    });

    it('should exclude self when canTargetSelf is false', () => {
      const targets = getValidTargets(mockState, 'p1', false);
      // p2 and p3 are valid targets (self excluded)
      expect(targets).toHaveLength(2);
      expect(targets.map(t => t.id)).toContain('p2');
      expect(targets.map(t => t.id)).toContain('p3');
      expect(targets.map(t => t.id)).not.toContain('p1');
    });
  });

  describe('validateTarget', () => {
    it('should allow targeting non-protected players', () => {
      const action: GameAction = {
        type: 'PLAY_CARD',
        playerId: 'p1',
        cardId: 'guard',
        targetPlayerId: 'p2',
      };
      const result = validateTarget(mockState, 'p1', action, false);
      expect(result.valid).toBe(true);
    });

    it('should reject targeting eliminated players', () => {
      // p2 is eliminated but p3 is still valid, so we can't fizzle
      mockPlayer2.status = 'ELIMINATED';
      const action: GameAction = {
        type: 'PLAY_CARD',
        playerId: 'p1',
        cardId: 'guard',
        targetPlayerId: 'p2',
      };
      const result = validateTarget(mockState, 'p1', action, false);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('eliminated');
    });

    it('should reject targeting protected players', () => {
      // p2 is protected but p3 is still valid, so we can't fizzle
      mockPlayer2.status = 'PROTECTED';
      const action: GameAction = {
        type: 'PLAY_CARD',
        playerId: 'p1',
        cardId: 'guard',
        targetPlayerId: 'p2',
      };
      const result = validateTarget(mockState, 'p1', action, false);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('protected');
    });

    it('should allow no target when all players protected (fizzle)', () => {
      // All other players are protected/eliminated, so fizzle is allowed
      mockPlayer2.status = 'PROTECTED';
      mockPlayer3.status = 'PROTECTED';
      const action: GameAction = {
        type: 'PLAY_CARD',
        playerId: 'p1',
        cardId: 'guard',
        // No targetPlayerId
      };
      const result = validateTarget(mockState, 'p1', action, false);
      expect(result.valid).toBe(true);
    });
  });

  describe('validateCardPlay', () => {
    it('should reject when not players turn', () => {
      const action: GameAction = {
        type: 'PLAY_CARD',
        playerId: 'p2',  // Not active player
        cardId: 'baron',
      };
      // mockPlayer1 is the active player (activePlayerIndex: 0), not mockPlayer2
      const result = validateCardPlay(mockState, 'p2', action, mockPlayer1);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('turn');
    });

    it('should reject when not in action phase', () => {
      mockState.phase = 'TURN_START';
      const action: GameAction = {
        type: 'PLAY_CARD',
        playerId: 'p1',
        cardId: 'guard',
      };
      const result = validateCardPlay(mockState, 'p1', action, mockPlayer1);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('action phase');
    });

    it('should reject when card not in hand', () => {
      const action: GameAction = {
        type: 'PLAY_CARD',
        playerId: 'p1',
        cardId: 'princess',  // Not in hand
      };
      const result = validateCardPlay(mockState, 'p1', action, mockPlayer1);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('not in hand');
    });

    it('should accept valid card play', () => {
      const action: GameAction = {
        type: 'PLAY_CARD',
        playerId: 'p1',
        cardId: 'guard',
        targetPlayerId: 'p2',
        targetCardGuess: 'baron',
      };
      const result = validateCardPlay(mockState, 'p1', action, mockPlayer1);
      expect(result.valid).toBe(true);
    });

    it('should require target card guess for Guard', () => {
      const action: GameAction = {
        type: 'PLAY_CARD',
        playerId: 'p1',
        cardId: 'guard',
        targetPlayerId: 'p2',
        // Missing targetCardGuess
      };
      const result = validateCardPlay(mockState, 'p1', action, mockPlayer1);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('guess required');
    });
  });
});
