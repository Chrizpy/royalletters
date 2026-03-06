import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from './game';
import { decideAIMove, isActivePlayerAI, getActiveAIPlayerId } from './ai';
import type { GameConfig } from '../types';

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
        const aiPlayer = state.players.find((p) => p.id === 'ai1')!;

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
      const aiPlayer = state.players.find((p) => p.id === 'ai1')!;
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
      const aiPlayer = state.players.find((p) => p.id === 'ai1')!;
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
      const aiPlayer = state.players.find((p) => p.id === 'ai1')!;
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
      const aiPlayer = state.players.find((p) => p.id === 'ai1')!;
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
      expect(['TURN_START', 'ROUND_END', 'CHANCELLOR_RESOLVING']).toContain(
        state.phase,
      );
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
        if (
          currentState.phase === 'WAITING_FOR_ACTION' ||
          currentState.phase === 'CHANCELLOR_RESOLVING'
        ) {
          const activePlayer =
            currentState.players[currentState.activePlayerIndex];
          const move = decideAIMove(currentState, activePlayer.id);

          if (move) {
            const result = game.applyMove(move);
            expect(result.success).toBe(true);
          }
        }
      }
    });
  });

  describe('AI card knowledge (Priest memory)', () => {
    it('should use Guard to eliminate a target whose card was learned via Priest', () => {
      const config: GameConfig = {
        players: [
          { id: 'ai1', name: 'AI 1', isAI: true },
          { id: 'p1', name: 'Human', isHost: true },
        ],
      };

      game.init(config);
      game.startRound();

      const state = game.getState();
      const aiPlayer = state.players.find((p) => p.id === 'ai1')!;
      const human = state.players.find((p) => p.id === 'p1')!;

      // AI holds Guard + Handmaid and KNOWS the human has a Princess
      aiPlayer.hand = ['guard', 'handmaid'];
      aiPlayer.knownCards = { p1: 'princess' };
      human.hand = ['princess'];
      state.phase = 'WAITING_FOR_ACTION';
      game.setState(state);

      const move = decideAIMove(game.getState(), 'ai1');

      // Should play Guard with exact knowledge of the target's card
      expect(move?.cardId).toBe('guard');
      expect(move?.targetPlayerId).toBe('p1');
      expect(move?.targetCardGuess).toBe('princess');
    });

    it('should play Prince on self when a high-value card (King) is exposed', () => {
      const config: GameConfig = {
        players: [
          { id: 'ai1', name: 'AI 1', isAI: true },
          { id: 'p1', name: 'Human', isHost: true },
        ],
      };

      game.init(config);
      game.startRound();

      const state = game.getState();
      const aiPlayer = state.players.find((p) => p.id === 'ai1')!;
      const human = state.players.find((p) => p.id === 'p1')!;

      // AI holds Prince + King (value 6); King is exposed (human Priested the AI).
      // King is high-value (≥5) so self-Princing to escape makes sense.
      aiPlayer.hand = ['prince', 'king'];
      aiPlayer.exposedToPlayerIds = ['p1'];
      human.hand = ['guard'];
      state.deck = ['spy', 'priest', 'baron']; // ensure a card to draw
      state.phase = 'WAITING_FOR_ACTION';
      game.setState(state);

      const move = decideAIMove(game.getState(), 'ai1');

      // Should play Prince targeting self to escape exposure of the high-value King
      expect(move?.cardId).toBe('prince');
      expect(move?.targetPlayerId).toBe('ai1');
    });

    it('should NOT self-target with Prince when the exposed card is low-value (Baron)', () => {
      const config: GameConfig = {
        players: [
          { id: 'ai1', name: 'AI 1', isAI: true },
          { id: 'p1', name: 'Human', isHost: true },
        ],
      };

      game.init(config);
      game.startRound();

      const state = game.getState();
      const aiPlayer = state.players.find((p) => p.id === 'ai1')!;
      const human = state.players.find((p) => p.id === 'p1')!;

      // AI holds Prince + Baron (value 3); Baron is exposed.
      // Baron is low-value so self-Princing is not worth it.
      aiPlayer.hand = ['prince', 'baron'];
      aiPlayer.exposedToPlayerIds = ['p1'];
      human.hand = ['guard'];
      state.phase = 'WAITING_FOR_ACTION';
      game.setState(state);

      const move = decideAIMove(game.getState(), 'ai1');

      // Should NOT self-target — Baron is not worth escaping
      expect(move?.targetPlayerId).not.toBe('ai1');
    });

    it('should play Handmaid (not self-Prince) when exposed and holding both cards', () => {
      const config: GameConfig = {
        players: [
          { id: 'ai1', name: 'AI 1', isAI: true },
          { id: 'p1', name: 'Human', isHost: true },
        ],
      };

      game.init(config);
      game.startRound();

      const state = game.getState();
      const aiPlayer = state.players.find((p) => p.id === 'ai1')!;
      const human = state.players.find((p) => p.id === 'p1')!;

      // AI holds Prince + Handmaid; Handmaid is exposed.
      // Playing Handmaid is better than self-Princing to discard it.
      aiPlayer.hand = ['prince', 'handmaid'];
      aiPlayer.exposedToPlayerIds = ['p1'];
      human.hand = ['guard'];
      state.phase = 'WAITING_FOR_ACTION';
      game.setState(state);

      const move = decideAIMove(game.getState(), 'ai1');

      // Should play Handmaid for protection — never self-Prince to discard Handmaid
      expect(move?.cardId).toBe('handmaid');
    });

    it('should NOT self-target with Prince when the card to be discarded is Princess', () => {
      const config: GameConfig = {
        players: [
          { id: 'ai1', name: 'AI 1', isAI: true },
          { id: 'p1', name: 'Human', isHost: true },
        ],
      };

      game.init(config);
      game.startRound();

      const state = game.getState();
      const aiPlayer = state.players.find((p) => p.id === 'ai1')!;
      const human = state.players.find((p) => p.id === 'p1')!;

      // AI holds Prince + Princess; Princess is exposed
      // Playing Prince on self would discard Princess → instant loss → should NOT do it
      aiPlayer.hand = ['prince', 'princess'];
      aiPlayer.exposedToPlayerIds = ['p1'];
      human.hand = ['guard'];
      state.phase = 'WAITING_FOR_ACTION';
      game.setState(state);

      const move = decideAIMove(game.getState(), 'ai1');

      // Must NOT self-target (would discard Princess and lose)
      expect(move?.targetPlayerId).not.toBe('ai1');
    });

    it('should play Baron against an opponent known to have a lower card', () => {
      const config: GameConfig = {
        players: [
          { id: 'ai1', name: 'AI 1', isAI: true },
          { id: 'p1', name: 'Human', isHost: true },
        ],
      };

      game.init(config);
      game.startRound();

      const state = game.getState();
      const aiPlayer = state.players.find((p) => p.id === 'ai1')!;
      const human = state.players.find((p) => p.id === 'p1')!;

      // AI has Baron + King (value 6). Human is known to hold Guard (value 1).
      // Playing Baron → AI keeps King (6) vs Guard (1) → AI wins
      aiPlayer.hand = ['baron', 'king'];
      aiPlayer.knownCards = { p1: 'guard' };
      human.hand = ['guard'];
      state.phase = 'WAITING_FOR_ACTION';
      game.setState(state);

      const move = decideAIMove(game.getState(), 'ai1');

      expect(move?.cardId).toBe('baron');
      expect(move?.targetPlayerId).toBe('p1');
    });

    it('should play King to steal a known higher-value card', () => {
      const config: GameConfig = {
        players: [
          { id: 'ai1', name: 'AI 1', isAI: true },
          { id: 'p1', name: 'Human', isHost: true },
        ],
      };

      game.init(config);
      game.startRound();

      const state = game.getState();
      const aiPlayer = state.players.find((p) => p.id === 'ai1')!;
      const human = state.players.find((p) => p.id === 'p1')!;

      // AI has King + Baron (value 3). Human is known to hold Countess (value 7).
      // Priority 1 (Guard) doesn't apply — no Guard in hand.
      // Priority 2 (Baron): AI's other card is Baron (3); Countess (7) > Baron (3) → not a Baron win.
      // Priority 4 (King): Countess (7) > Baron (3) → steal the better card.
      aiPlayer.hand = ['king', 'baron'];
      aiPlayer.knownCards = { p1: 'countess' };
      human.hand = ['countess'];
      state.phase = 'WAITING_FOR_ACTION';
      game.setState(state);

      const move = decideAIMove(game.getState(), 'ai1');

      expect(move?.cardId).toBe('king');
      expect(move?.targetPlayerId).toBe('p1');
    });

    it('should clear Priest knowledge when target draws a new card via Prince', () => {
      const config: GameConfig = {
        players: [
          { id: 'ai1', name: 'AI 1', isAI: true },
          { id: 'p1', name: 'Human', isHost: true },
        ],
      };

      game.init(config);
      game.startRound();

      const state = game.getState();
      const aiPlayer = state.players.find((p) => p.id === 'ai1')!;
      const human = state.players.find((p) => p.id === 'p1')!;

      // AI knew p1 had a Princess, then plays Prince on them to force a redraw
      aiPlayer.hand = ['prince', 'guard'];
      aiPlayer.knownCards = { p1: 'princess' };
      human.hand = ['priest']; // Not Princess, so Prince won't eliminate them
      state.deck = ['spy'];
      state.phase = 'WAITING_FOR_ACTION';
      game.setState(state);

      const move = decideAIMove(game.getState(), 'ai1');
      expect(move?.cardId).toBeDefined(); // any valid move

      // Apply Prince on the human
      const forceMove = {
        type: 'PLAY_CARD' as const,
        playerId: 'ai1',
        cardId: 'prince',
        targetPlayerId: 'p1',
      };
      game.applyMove(forceMove);

      const newState = game.getState();
      const aiAfter = newState.players.find((p) => p.id === 'ai1')!;

      // Knowledge about p1 should be cleared (p1 now has a different card)
      expect(aiAfter.knownCards?.['p1']).toBeUndefined();
    });

    it('should clear exposure when target draws a new card via Prince', () => {
      const config: GameConfig = {
        players: [
          { id: 'ai1', name: 'AI 1', isAI: true },
          { id: 'p1', name: 'Human', isHost: true },
        ],
      };

      game.init(config);
      game.startRound();

      const state = game.getState();
      const aiPlayer = state.players.find((p) => p.id === 'ai1')!;
      const human = state.players.find((p) => p.id === 'p1')!;

      // Human's card is exposed (someone Priested them), then AI forces a redraw
      aiPlayer.hand = ['prince', 'guard'];
      human.hand = ['priest'];
      human.exposedToPlayerIds = ['ai1'];
      state.deck = ['spy'];
      state.phase = 'WAITING_FOR_ACTION';
      game.setState(state);

      const forceMove = {
        type: 'PLAY_CARD' as const,
        playerId: 'ai1',
        cardId: 'prince',
        targetPlayerId: 'p1',
      };
      game.applyMove(forceMove);

      const newState = game.getState();
      const humanAfter = newState.players.find((p) => p.id === 'p1')!;

      // Exposure should be cleared since p1 now has a fresh unknown card
      expect(humanAfter.exposedToPlayerIds).toEqual([]);
    });

    it('should record Priest knowledge in game state when Priest is applied', () => {
      const config: GameConfig = {
        players: [
          { id: 'ai1', name: 'AI 1', isAI: true },
          { id: 'p1', name: 'Human', isHost: true },
        ],
      };

      game.init(config);
      game.startRound();

      const state = game.getState();
      const aiPlayer = state.players.find((p) => p.id === 'ai1')!;
      const human = state.players.find((p) => p.id === 'p1')!;

      // AI plays Priest on the human
      aiPlayer.hand = ['priest', 'guard'];
      human.hand = ['princess'];
      state.phase = 'WAITING_FOR_ACTION';
      game.setState(state);

      const priestMove = {
        type: 'PLAY_CARD' as const,
        playerId: 'ai1',
        cardId: 'priest',
        targetPlayerId: 'p1',
      };
      game.applyMove(priestMove);

      const newState = game.getState();
      const aiAfter = newState.players.find((p) => p.id === 'ai1')!;
      const humanAfter = newState.players.find((p) => p.id === 'p1')!;

      // AI should now know p1's card
      expect(aiAfter.knownCards?.['p1']).toBe('princess');
      // p1 should be marked as exposed to ai1
      expect(humanAfter.exposedToPlayerIds).toContain('ai1');
    });

    it('should clear knowledge about both players when King trades hands', () => {
      const config: GameConfig = {
        players: [
          { id: 'ai1', name: 'AI 1', isAI: true },
          { id: 'p1', name: 'Human', isHost: true },
        ],
      };

      game.init(config);
      game.startRound();

      const state = game.getState();
      const aiPlayer = state.players.find((p) => p.id === 'ai1')!;
      const human = state.players.find((p) => p.id === 'p1')!;

      // Someone else knew both players' cards before the King swap
      aiPlayer.hand = ['king', 'guard'];
      aiPlayer.exposedToPlayerIds = ['p1'];
      human.hand = ['princess'];
      human.exposedToPlayerIds = ['ai1'];
      // Simulate a bystander knowing both
      aiPlayer.knownCards = { p1: 'princess' };
      state.phase = 'WAITING_FOR_ACTION';
      game.setState(state);

      const kingMove = {
        type: 'PLAY_CARD' as const,
        playerId: 'ai1',
        cardId: 'king',
        targetPlayerId: 'p1',
      };
      game.applyMove(kingMove);

      const newState = game.getState();
      const aiAfter = newState.players.find((p) => p.id === 'ai1')!;
      const humanAfter = newState.players.find((p) => p.id === 'p1')!;

      // Both players have new cards; exposure is cleared
      expect(aiAfter.exposedToPlayerIds).toEqual([]);
      expect(humanAfter.exposedToPlayerIds).toEqual([]);
      // Knowledge about both is now stale and cleared
      expect(aiAfter.knownCards?.['p1']).toBeUndefined();
    });

    it('should use known card for Chancellor return — keep Guard when opponent card is known', () => {
      const config: GameConfig = {
        players: [
          { id: 'ai1', name: 'AI 1', isAI: true },
          { id: 'p1', name: 'Human', isHost: true },
        ],
      };

      game.init(config);
      game.startRound();

      const state = game.getState();
      const aiPlayer = state.players.find((p) => p.id === 'ai1')!;
      const human = state.players.find((p) => p.id === 'p1')!;

      // AI has [guard, spy, baron] and knows p1 holds Princess
      // Should keep Guard (to eliminate p1 next turn), not the highest-value baron
      aiPlayer.hand = ['guard', 'spy', 'baron'];
      aiPlayer.knownCards = { p1: 'princess' };
      human.hand = ['princess'];
      state.phase = 'CHANCELLOR_RESOLVING';
      state.chancellorCards = ['spy', 'baron'];
      game.setState(state);

      const move = decideAIMove(game.getState(), 'ai1');

      expect(move?.type).toBe('CHANCELLOR_RETURN');
      expect(move?.cardsToReturn).toHaveLength(2);
      // Should keep Guard (to use the knowledge of Princess next turn)
      expect(move?.cardsToReturn).not.toContain('guard');
    });
  });
});
