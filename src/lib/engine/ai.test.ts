import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from './game';
import { decideAIMove, isActivePlayerAI, getActiveAIPlayerId } from './ai';
import type { GameConfig, GameState } from '../types';

describe('AI Engine Tests', () => {
  let game: GameEngine;
  
  beforeEach(() => {
    game = new GameEngine();
  });
  
  describe('isActivePlayerAI', () => {
    it('should return false when active player is not AI', () => {
      const config: GameConfig = {
        players: [
          { id: 'p1', name: 'Human', isHost: true, isAI: false },
          { id: 'p2', name: 'AI Bot', isAI: true },
        ],
      };
      
      game.init(config);
      game.startRound();
      game.drawPhase();
      
      const state = game.getState();
      // First player (Human) is active
      expect(isActivePlayerAI(state)).toBe(false);
    });
    
    it('should return true when active player is AI', () => {
      const config: GameConfig = {
        players: [
          { id: 'ai1', name: 'AI 1', isAI: true },
          { id: 'p1', name: 'Human', isHost: true },
        ],
      };
      
      game.init(config);
      game.startRound();
      game.drawPhase();
      
      const state = game.getState();
      // First player (AI 1) is active
      expect(isActivePlayerAI(state)).toBe(true);
    });
  });
  
  describe('getActiveAIPlayerId', () => {
    it('should return null when active player is not AI', () => {
      const config: GameConfig = {
        players: [
          { id: 'p1', name: 'Human', isHost: true },
          { id: 'ai1', name: 'AI 1', isAI: true },
        ],
      };
      
      game.init(config);
      game.startRound();
      game.drawPhase();
      
      const state = game.getState();
      expect(getActiveAIPlayerId(state)).toBe(null);
    });
    
    it('should return AI player ID when active player is AI', () => {
      const config: GameConfig = {
        players: [
          { id: 'ai1', name: 'AI 1', isAI: true },
          { id: 'p1', name: 'Human', isHost: true },
        ],
      };
      
      game.init(config);
      game.startRound();
      game.drawPhase();
      
      const state = game.getState();
      expect(getActiveAIPlayerId(state)).toBe('ai1');
    });
  });
  
  describe('decideAIMove', () => {
    it('should return null when phase is not WAITING_FOR_ACTION', () => {
      const config: GameConfig = {
        players: [
          { id: 'ai1', name: 'AI 1', isAI: true },
          { id: 'p1', name: 'Human', isHost: true },
        ],
      };
      
      game.init(config);
      game.startRound();
      // Don't call drawPhase - should be in TURN_START phase
      
      const state = game.getState();
      expect(state.phase).toBe('TURN_START');
      
      const move = decideAIMove(state, 'ai1');
      expect(move).toBe(null);
    });
    
    it('should return a valid action when AI has cards to play', () => {
      const config: GameConfig = {
        players: [
          { id: 'ai1', name: 'AI 1', isAI: true },
          { id: 'p1', name: 'Human', isHost: true },
        ],
      };
      
      game.init(config);
      game.startRound();
      game.drawPhase();
      
      const state = game.getState();
      expect(state.phase).toBe('WAITING_FOR_ACTION');
      
      const move = decideAIMove(state, 'ai1');
      expect(move).not.toBe(null);
      expect(move?.type).toBe('PLAY_CARD');
      expect(move?.playerId).toBe('ai1');
      expect(move?.cardId).toBeDefined();
    });
    
    it('should never play Princess when other cards are available', () => {
      // Run multiple times with different seeds to test probability
      for (let i = 0; i < 10; i++) {
        game = new GameEngine();
        const config: GameConfig = {
          players: [
            { id: 'ai1', name: 'AI 1', isAI: true },
            { id: 'p1', name: 'Human', isHost: true },
          ],
        };
        
        game.init(config);
        game.startRound();
        game.drawPhase();
        
        const state = game.getState();
        const aiPlayer = state.players.find(p => p.id === 'ai1')!;
        
        // If AI has princess and another card, it should not play princess
        if (aiPlayer.hand.includes('princess') && aiPlayer.hand.length > 1) {
          const move = decideAIMove(state, 'ai1');
          expect(move?.cardId).not.toBe('princess');
        }
      }
    });
    
    it('must play Countess when holding King or Prince', () => {
      // Create a scenario where AI has Countess + King
      const config: GameConfig = {
        players: [
          { id: 'ai1', name: 'AI 1', isAI: true },
          { id: 'p1', name: 'Human', isHost: true },
        ],
      };
      
      game.init(config);
      game.startRound();
      
      // Manually set up the AI's hand
      const state = game.getState();
      const aiPlayer = state.players.find(p => p.id === 'ai1')!;
      aiPlayer.hand = ['countess', 'king'];
      state.phase = 'WAITING_FOR_ACTION';
      game.setState(state);
      
      const currentState = game.getState();
      const move = decideAIMove(currentState, 'ai1');
      
      expect(move?.cardId).toBe('countess');
    });
    
    it('should provide target for Guard card', () => {
      const config: GameConfig = {
        players: [
          { id: 'ai1', name: 'AI 1', isAI: true },
          { id: 'p1', name: 'Human', isHost: true },
        ],
      };
      
      game.init(config);
      game.startRound();
      
      // Set up AI with a Guard card
      const state = game.getState();
      const aiPlayer = state.players.find(p => p.id === 'ai1')!;
      aiPlayer.hand = ['guard', 'handmaid'];
      state.phase = 'WAITING_FOR_ACTION';
      game.setState(state);
      
      const currentState = game.getState();
      const move = decideAIMove(currentState, 'ai1');
      
      // Guard should be played with a target and guess
      expect(move?.cardId).toBe('guard');
      expect(move?.targetPlayerId).toBe('p1'); // Only other player
      expect(move?.targetCardGuess).toBeDefined();
      expect(move?.targetCardGuess).not.toBe('guard'); // Cannot guess Guard
    });
    
    it('should play Handmaid without target', () => {
      const config: GameConfig = {
        players: [
          { id: 'ai1', name: 'AI 1', isAI: true },
          { id: 'p1', name: 'Human', isHost: true },
        ],
      };
      
      game.init(config);
      game.startRound();
      
      // Set up AI with Handmaid
      const state = game.getState();
      const aiPlayer = state.players.find(p => p.id === 'ai1')!;
      aiPlayer.hand = ['handmaid', 'princess'];
      state.phase = 'WAITING_FOR_ACTION';
      game.setState(state);
      
      const currentState = game.getState();
      const move = decideAIMove(currentState, 'ai1');
      
      expect(move?.cardId).toBe('handmaid');
      expect(move?.targetPlayerId).toBeUndefined();
    });
    
    it('should handle Chancellor return by keeping highest value card', () => {
      const config: GameConfig = {
        players: [
          { id: 'ai1', name: 'AI 1', isAI: true },
          { id: 'p1', name: 'Human', isHost: true },
        ],
      };
      
      game.init(config);
      game.startRound();
      
      // Set up Chancellor resolving phase with 3 cards
      const state = game.getState();
      const aiPlayer = state.players.find(p => p.id === 'ai1')!;
      aiPlayer.hand = ['guard', 'baron', 'princess']; // Princess is highest
      state.phase = 'CHANCELLOR_RESOLVING';
      state.chancellorCards = ['baron', 'princess'];
      game.setState(state);
      
      const currentState = game.getState();
      const move = decideAIMove(currentState, 'ai1');
      
      expect(move?.type).toBe('CHANCELLOR_RETURN');
      expect(move?.cardsToReturn).toHaveLength(2);
      // Should NOT return princess (highest value)
      expect(move?.cardsToReturn).not.toContain('princess');
    });
  });
  
  describe('AI playing full turns', () => {
    it('should be able to apply AI moves to the game', () => {
      const config: GameConfig = {
        players: [
          { id: 'ai1', name: 'AI 1', isAI: true },
          { id: 'p1', name: 'Human', isHost: true },
        ],
      };
      
      game.init(config);
      game.startRound();
      game.drawPhase();
      
      let state = game.getState();
      expect(state.phase).toBe('WAITING_FOR_ACTION');
      
      const move = decideAIMove(state, 'ai1');
      expect(move).not.toBe(null);
      
      // Apply the move
      const result = game.applyMove(move!);
      expect(result.success).toBe(true);
      
      // Check turn advanced or game ended
      state = game.getState();
      expect(['TURN_START', 'ROUND_END', 'CHANCELLOR_RESOLVING']).toContain(state.phase);
    });
    
    it('should work with multiple AI players', () => {
      const config: GameConfig = {
        players: [
          { id: 'ai1', name: 'AI 1', isAI: true },
          { id: 'ai2', name: 'AI 2', isAI: true },
        ],
      };
      
      game.init(config);
      game.startRound();
      
      // Play a few turns automatically
      for (let turn = 0; turn < 5; turn++) {
        const state = game.getState();
        
        if (state.phase === 'ROUND_END' || state.phase === 'GAME_END') {
          break;
        }
        
        if (state.phase === 'TURN_START') {
          game.drawPhase();
        }
        
        const currentState = game.getState();
        if (currentState.phase === 'WAITING_FOR_ACTION' || currentState.phase === 'CHANCELLOR_RESOLVING') {
          const activePlayer = currentState.players[currentState.activePlayerIndex];
          const move = decideAIMove(currentState, activePlayer.id);
          
          if (move) {
            const result = game.applyMove(move);
            expect(result.success).toBe(true);
          }
        }
      }
    });
  });
});
