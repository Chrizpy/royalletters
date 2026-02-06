import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import {
  gameState,
  gameStarted,
  revealedCard,
  initGame,
  getEngine,
  startRound,
  drawCard,
  applyAction,
  clearRevealedCard,
  setGameState,
  getGameState,
  resetGame,
  checkIfAITurn,
  getAIMove,
  executeAIMove
} from './game';
import type { GameState } from '../types';

describe('Game Store', () => {
  beforeEach(() => {
    // Reset state before each test
    resetGame();
  });

  describe('initGame', () => {
    it('should initialize game engine with players', () => {
      const players = [
        { id: 'p1', name: 'Alice' },
        { id: 'p2', name: 'Bob' }
      ];
      
      initGame(players);
      
      const state = get(gameState);
      expect(state).not.toBeNull();
      expect(state?.players).toHaveLength(2);
      expect(state?.players[0].name).toBe('Alice');
      expect(state?.players[1].name).toBe('Bob');
    });

    it('should use classic ruleset by default', () => {
      initGame([{ id: 'p1', name: 'Alice' }, { id: 'p2', name: 'Bob' }]);
      
      const state = get(gameState);
      expect(state?.ruleset).toBe('classic');
    });

    it('should support 2019 ruleset', () => {
      initGame(
        [{ id: 'p1', name: 'Alice' }, { id: 'p2', name: 'Bob' }],
        '2019'
      );
      
      const state = get(gameState);
      expect(state?.ruleset).toBe('2019');
    });

    it('should create engine instance', () => {
      initGame([{ id: 'p1', name: 'Alice' }, { id: 'p2', name: 'Bob' }]);
      
      expect(getEngine()).not.toBeNull();
    });
  });

  describe('startRound', () => {
    it('should start round and set gameStarted to true', () => {
      initGame([{ id: 'p1', name: 'Alice' }, { id: 'p2', name: 'Bob' }]);
      
      expect(get(gameStarted)).toBe(false);
      
      startRound();
      
      expect(get(gameStarted)).toBe(true);
    });

    it('should deal cards to players', () => {
      initGame([{ id: 'p1', name: 'Alice' }, { id: 'p2', name: 'Bob' }]);
      startRound();
      
      const state = get(gameState);
      expect(state).not.toBeNull();
      // All players should have at least 1 card after deal
      // Active player has 2 (dealt + drawn)
      state?.players.forEach(player => {
        expect(player.hand.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('applyAction', () => {
    it('should apply a valid game action', () => {
      initGame([{ id: 'p1', name: 'Alice' }, { id: 'p2', name: 'Bob' }]);
      startRound();
      
      const state = get(gameState);
      const activePlayer = state?.players.find(p => p.id === state?.activePlayerId);
      
      if (activePlayer && activePlayer.hand.length > 0) {
        const cardToPlay = activePlayer.hand[0];
        const otherPlayer = state?.players.find(p => p.id !== activePlayer.id);
        
        const result = applyAction({
          playerId: activePlayer.id,
          cardId: cardToPlay,
          targetPlayerId: otherPlayer?.id,
          guessedCard: 'priest' // For Guard
        });
        
        expect(result).toBeDefined();
      }
    });
  });

  describe('revealedCard', () => {
    it('should start as null', () => {
      expect(get(revealedCard)).toBeNull();
    });

    it('should be clearable', () => {
      // Manually set for testing
      revealedCard.set({ cardId: 'priest', playerName: 'Bob', viewerPlayerId: 'p1' });
      expect(get(revealedCard)).not.toBeNull();
      
      clearRevealedCard();
      expect(get(revealedCard)).toBeNull();
    });
  });

  describe('setGameState', () => {
    it('should set game state from external source', () => {
      const mockState: GameState = {
        phase: 'WAITING_FOR_ACTION',
        players: [
          { id: 'p1', name: 'Alice', hand: [], discardPile: [], isEliminated: false, isProtected: false, favorTokens: 0 },
          { id: 'p2', name: 'Bob', hand: [], discardPile: [], isEliminated: false, isProtected: false, favorTokens: 0 }
        ],
        deck: [],
        burnedCard: null,
        activePlayerId: 'p1',
        roundWinner: null,
        gameWinner: null,
        log: [],
        tokensToWin: 4,
        ruleset: 'classic',
        roundStartPlayerId: 'p1'
      };
      
      setGameState(mockState);
      
      expect(get(gameState)).toEqual(mockState);
      expect(get(gameStarted)).toBe(true);
    });

    it('should not set gameStarted if phase is LOBBY', () => {
      resetGame();
      
      const mockState: GameState = {
        phase: 'LOBBY',
        players: [],
        deck: [],
        burnedCard: null,
        activePlayerId: '',
        roundWinner: null,
        gameWinner: null,
        log: [],
        tokensToWin: 4,
        ruleset: 'classic',
        roundStartPlayerId: ''
      };
      
      setGameState(mockState);
      
      expect(get(gameStarted)).toBe(false);
    });
  });

  describe('getGameState', () => {
    it('should return current state', () => {
      initGame([{ id: 'p1', name: 'Alice' }, { id: 'p2', name: 'Bob' }]);
      
      const state = getGameState();
      expect(state).toEqual(get(gameState));
    });

    it('should return null when no game initialized', () => {
      expect(getGameState()).toBeNull();
    });
  });

  describe('resetGame', () => {
    it('should reset all state', () => {
      initGame([{ id: 'p1', name: 'Alice' }, { id: 'p2', name: 'Bob' }]);
      startRound();
      
      resetGame();
      
      expect(get(gameState)).toBeNull();
      expect(get(gameStarted)).toBe(false);
      expect(getEngine()).toBeNull();
    });
  });

  describe('AI functions', () => {
    it('checkIfAITurn should return false when no game', () => {
      expect(checkIfAITurn()).toBe(false);
    });

    it('checkIfAITurn should return false for human player', () => {
      initGame([
        { id: 'p1', name: 'Alice', isAI: false },
        { id: 'p2', name: 'Bob', isAI: false }
      ]);
      startRound();
      
      expect(checkIfAITurn()).toBe(false);
    });

    it('getAIMove should return null when no game', () => {
      expect(getAIMove()).toBeNull();
    });

    it('executeAIMove should return undefined when no AI move', () => {
      initGame([
        { id: 'p1', name: 'Alice', isAI: false },
        { id: 'p2', name: 'Bob', isAI: false }
      ]);
      startRound();
      
      expect(executeAIMove()).toBeUndefined();
    });
  });
});
