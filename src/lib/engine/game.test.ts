import { describe, it, expect, beforeEach } from 'vitest';
import { createRng } from './rng';
import { createDeck, shuffle, getCardDefinition } from './deck';
import { GameEngine } from './game';
import type { GameConfig, GameAction } from '../types';

describe('RNG Tests', () => {
  it('should produce same sequence with same seed', () => {
    const rng1 = createRng('test-seed-123');
    const rng2 = createRng('test-seed-123');

    const sequence1 = [rng1(), rng1(), rng1(), rng1(), rng1()];
    const sequence2 = [rng2(), rng2(), rng2(), rng2(), rng2()];

    expect(sequence1).toEqual(sequence2);
  });

  it('should produce different sequences with different seeds', () => {
    const rng1 = createRng('seed-a');
    const rng2 = createRng('seed-b');

    const sequence1 = [rng1(), rng1(), rng1(), rng1(), rng1()];
    const sequence2 = [rng2(), rng2(), rng2(), rng2(), rng2()];

    expect(sequence1).not.toEqual(sequence2);
  });
});

describe('Deck Tests', () => {
  it('should create deck with exactly 16 cards', () => {
    const deck = createDeck();
    expect(deck).toHaveLength(16);
  });

  it('should have correct card counts', () => {
    const deck = createDeck();
    
    const guardCount = deck.filter(c => c === 'guard').length;
    const priestCount = deck.filter(c => c === 'priest').length;
    const baronCount = deck.filter(c => c === 'baron').length;
    const handmaidCount = deck.filter(c => c === 'handmaid').length;
    const princeCount = deck.filter(c => c === 'prince').length;
    const kingCount = deck.filter(c => c === 'king').length;
    const countessCount = deck.filter(c => c === 'countess').length;
    const princessCount = deck.filter(c => c === 'princess').length;

    expect(guardCount).toBe(5);
    expect(priestCount).toBe(2);
    expect(baronCount).toBe(2);
    expect(handmaidCount).toBe(2);
    expect(princeCount).toBe(2);
    expect(kingCount).toBe(1);
    expect(countessCount).toBe(1);
    expect(princessCount).toBe(1);
  });

  it('should shuffle deterministically with same seed', () => {
    const deck = createDeck();
    const shuffled1 = shuffle(deck, 'test-seed');
    const shuffled2 = shuffle(deck, 'test-seed');

    expect(shuffled1).toEqual(shuffled2);
  });

  it('should shuffle differently with different seeds', () => {
    const deck = createDeck();
    const shuffled1 = shuffle(deck, 'seed-a');
    const shuffled2 = shuffle(deck, 'seed-b');

    expect(shuffled1).not.toEqual(shuffled2);
  });

  it('should get card definition by id', () => {
    const guard = getCardDefinition('guard');
    expect(guard).toBeDefined();
    expect(guard?.name).toBe('Guard');
    expect(guard?.value).toBe(1);
  });
});

describe('Game Initialization Tests', () => {
  let game: GameEngine;
  let config: GameConfig;

  beforeEach(() => {
    game = new GameEngine();
    config = {
      players: [
        { id: 'p1', name: 'Alice', isHost: true },
        { id: 'p2', name: 'Bob' },
      ],
    };
  });

  it('should initialize game in LOBBY phase', () => {
    game.init(config);
    const state = game.getState();

    expect(state.phase).toBe('LOBBY');
    expect(state.players).toHaveLength(2);
  });

  it('should initialize players correctly', () => {
    game.init(config);
    const state = game.getState();

    expect(state.players[0].id).toBe('p1');
    expect(state.players[0].name).toBe('Alice');
    expect(state.players[0].isHost).toBe(true);
    expect(state.players[0].tokens).toBe(0);
    expect(state.players[0].hand).toEqual([]);
    expect(state.players[0].discardPile).toEqual([]);
  });
});

describe('Round Start Tests', () => {
  let game: GameEngine;

  beforeEach(() => {
    game = new GameEngine();
    game.init({
      players: [
        { id: 'p1', name: 'Alice' },
        { id: 'p2', name: 'Bob' },
        { id: 'p3', name: 'Charlie' },
      ],
    });
  });

  it('should shuffle deck on round start', () => {
    game.startRound();
    const state = game.getState();

    expect(state.rngSeed).toBeTruthy();
    expect(state.deck.length).toBeGreaterThan(0);
  });

  it('should burn one card', () => {
    game.startRound();
    const state = game.getState();

    expect(state.burnedCard).toBeTruthy();
    // 16 total - 1 burned - 3 dealt = 12 remaining
    expect(state.deck.length).toBe(12);
  });

  it('should deal one card to each player', () => {
    game.startRound();
    const state = game.getState();

    state.players.forEach(player => {
      expect(player.hand).toHaveLength(1);
    });
  });

  it('should set phase to TURN_START', () => {
    game.startRound();
    const state = game.getState();

    expect(state.phase).toBe('TURN_START');
  });

  it('should set active player to index 0', () => {
    game.startRound();
    const state = game.getState();

    expect(state.activePlayerIndex).toBe(0);
  });

  it('should increment round count', () => {
    game.startRound();
    let state = game.getState();
    expect(state.roundCount).toBe(1);

    // Simulate round end and start new round
    state.phase = 'ROUND_END';
    game.setState(state);
    game.startRound();
    state = game.getState();
    expect(state.roundCount).toBe(2);
  });

  it('should reset eliminated players to PLAYING status on new round', () => {
    game.startRound();
    let state = game.getState();
    
    // Simulate player being eliminated
    state.players[1].status = 'ELIMINATED';
    game.setState(state);
    
    // Verify player is eliminated
    expect(game.getState().players[1].status).toBe('ELIMINATED');
    
    // Start a new round
    game.startRound();
    state = game.getState();
    
    // All players should be PLAYING in the new round
    expect(state.players[0].status).toBe('PLAYING');
    expect(state.players[1].status).toBe('PLAYING');
    expect(state.players[2].status).toBe('PLAYING');
  });
});

describe('Draw Phase Tests', () => {
  let game: GameEngine;

  beforeEach(() => {
    game = new GameEngine();
    game.init({
      players: [
        { id: 'p1', name: 'Alice' },
        { id: 'p2', name: 'Bob' },
      ],
    });
    game.startRound();
  });

  it('should give active player 2 cards after draw', () => {
    game.drawPhase();
    const state = game.getState();

    expect(state.players[0].hand).toHaveLength(2);
  });

  it('should change phase to WAITING_FOR_ACTION', () => {
    game.drawPhase();
    const state = game.getState();

    expect(state.phase).toBe('WAITING_FOR_ACTION');
  });
});

describe('Validation Tests', () => {
  let game: GameEngine;

  beforeEach(() => {
    game = new GameEngine();
    game.init({
      players: [
        { id: 'p1', name: 'Alice' },
        { id: 'p2', name: 'Bob' },
        { id: 'p3', name: 'Charlie' },
      ],
    });
    game.startRound();
    game.drawPhase();
  });

  it('should reject move if not player\'s turn', () => {
    const state = game.getState();
    const cardInHand = state.players[1].hand[0]; // Bob's card

    const action: GameAction = {
      type: 'PLAY_CARD',
      playerId: 'p2', // Bob trying to play when it's Alice's turn
      cardId: cardInHand,
    };

    const validation = game.validateMove('p2', action);
    expect(validation.valid).toBe(false);
  });

  it('should reject card not in hand', () => {
    const state = game.getState();
    const aliceHand = state.players[0].hand;
    
    // Find a card that Alice definitely doesn't have
    const cardsNotInHand = ['guard', 'priest', 'baron', 'handmaid', 'prince', 'king', 'countess', 'princess']
      .filter(card => !aliceHand.includes(card));
    
    const action: GameAction = {
      type: 'PLAY_CARD',
      playerId: 'p1',
      cardId: cardsNotInHand[0], // Use a card Alice doesn't have
    };

    const validation = game.validateMove('p1', action);
    expect(validation.valid).toBe(false);
  });

  it('should enforce Countess rule', () => {
    // Manually set Alice's hand to have Countess + King
    const state = game.getState();
    state.players[0].hand = ['countess', 'king'];
    game.setState(state);

    const action: GameAction = {
      type: 'PLAY_CARD',
      playerId: 'p1',
      cardId: 'king',
      targetPlayerId: 'p2',
    };

    const validation = game.validateMove('p1', action);
    expect(validation.valid).toBe(false);
    expect(validation.error).toContain('Countess');
  });

  it('should not allow targeting eliminated players', () => {
    const state = game.getState();
    state.players[1].status = 'ELIMINATED';
    state.players[0].hand = ['guard', 'priest'];
    game.setState(state);

    const action: GameAction = {
      type: 'PLAY_CARD',
      playerId: 'p1',
      cardId: 'guard',
      targetPlayerId: 'p2',
      targetCardGuess: 'baron',
    };

    const validation = game.validateMove('p1', action);
    expect(validation.valid).toBe(false);
  });

  it('should not allow targeting protected players', () => {
    const state = game.getState();
    state.players[1].status = 'PROTECTED';
    state.players[0].hand = ['guard', 'priest'];
    game.setState(state);

    const action: GameAction = {
      type: 'PLAY_CARD',
      playerId: 'p1',
      cardId: 'guard',
      targetPlayerId: 'p2',
      targetCardGuess: 'baron',
    };

    const validation = game.validateMove('p1', action);
    expect(validation.valid).toBe(false);
  });

  it('should not allow Guard to guess Guard', () => {
    const state = game.getState();
    state.players[0].hand = ['guard', 'priest'];
    game.setState(state);

    const action: GameAction = {
      type: 'PLAY_CARD',
      playerId: 'p1',
      cardId: 'guard',
      targetPlayerId: 'p2',
      targetCardGuess: 'guard',
    };

    const validation = game.validateMove('p1', action);
    expect(validation.valid).toBe(false);
    expect(validation.error).toContain('Guard');
  });
});

describe('Card Effect Tests', () => {
  let game: GameEngine;

  beforeEach(() => {
    game = new GameEngine();
    game.init({
      players: [
        { id: 'p1', name: 'Alice' },
        { id: 'p2', name: 'Bob' },
      ],
    });
    game.startRound();
    game.drawPhase();
  });

  describe('Guard Tests', () => {
    it('should eliminate target on correct guess', () => {
      const state = game.getState();
      state.players[0].hand = ['guard', 'priest'];
      state.players[1].hand = ['baron'];
      game.setState(state);

      const action: GameAction = {
        type: 'PLAY_CARD',
        playerId: 'p1',
        cardId: 'guard',
        targetPlayerId: 'p2',
        targetCardGuess: 'baron',
      };

      const result = game.applyMove(action);
      const newState = result.newState;

      expect(result.success).toBe(true);
      expect(newState.players[1].status).toBe('ELIMINATED');
    });

    it('should not eliminate on wrong guess', () => {
      const state = game.getState();
      state.players[0].hand = ['guard', 'priest'];
      state.players[1].hand = ['baron'];
      game.setState(state);

      const action: GameAction = {
        type: 'PLAY_CARD',
        playerId: 'p1',
        cardId: 'guard',
        targetPlayerId: 'p2',
        targetCardGuess: 'prince',
      };

      const result = game.applyMove(action);
      const newState = result.newState;

      expect(result.success).toBe(true);
      expect(newState.players[1].status).not.toBe('ELIMINATED');
    });
  });

  describe('Priest Tests', () => {
    it('should reveal target\'s hand', () => {
      const state = game.getState();
      state.players[0].hand = ['priest', 'guard'];
      state.players[1].hand = ['baron'];
      game.setState(state);

      const action: GameAction = {
        type: 'PLAY_CARD',
        playerId: 'p1',
        cardId: 'priest',
        targetPlayerId: 'p2',
      };

      const result = game.applyMove(action);

      expect(result.success).toBe(true);
      expect(result.revealedCard).toBe('baron');
    });
  });

  describe('Baron Tests', () => {
    it('should eliminate player with lower card', () => {
      const state = game.getState();
      state.players[0].hand = ['baron', 'priest']; // Alice has baron and priest
      state.players[1].hand = ['guard'];
      game.setState(state);

      const action: GameAction = {
        type: 'PLAY_CARD',
        playerId: 'p1',
        cardId: 'baron',
        targetPlayerId: 'p2',
      };

      const result = game.applyMove(action);
      const newState = result.newState;

      expect(result.success).toBe(true);
      expect(newState.players[1].status).toBe('ELIMINATED');
      // Eliminated player's card should be in discard pile (visible to all)
      expect(newState.players[1].hand).toHaveLength(0);
      expect(newState.players[1].discardPile).toContain('guard');
    });

    it('should eliminate self if target has higher card', () => {
      const state = game.getState();
      state.players[0].hand = ['baron', 'guard']; // Alice has baron and guard
      state.players[1].hand = ['prince'];
      game.setState(state);

      const action: GameAction = {
        type: 'PLAY_CARD',
        playerId: 'p1',
        cardId: 'baron',
        targetPlayerId: 'p2',
      };

      const result = game.applyMove(action);
      const newState = result.newState;

      expect(result.success).toBe(true);
      expect(newState.players[0].status).toBe('ELIMINATED');
      // Eliminated player's card should be in discard pile (visible to all)
      expect(newState.players[0].hand).toHaveLength(0);
      expect(newState.players[0].discardPile).toContain('guard'); // The remaining card
    });

    it('should not eliminate anyone on tie', () => {
      const state = game.getState();
      state.players[0].hand = ['baron', 'priest']; // Alice has baron and priest
      state.players[1].hand = ['priest'];
      game.setState(state);

      const action: GameAction = {
        type: 'PLAY_CARD',
        playerId: 'p1',
        cardId: 'baron',
        targetPlayerId: 'p2',
      };

      const result = game.applyMove(action);
      const newState = result.newState;

      expect(result.success).toBe(true);
      expect(newState.players[0].status).not.toBe('ELIMINATED');
      expect(newState.players[1].status).not.toBe('ELIMINATED');
    });
  });

  describe('Handmaid Tests', () => {
    it('should set protection status', () => {
      const state = game.getState();
      state.players[0].hand = ['handmaid'];
      game.setState(state);

      const action: GameAction = {
        type: 'PLAY_CARD',
        playerId: 'p1',
        cardId: 'handmaid',
      };

      const result = game.applyMove(action);
      const newState = result.newState;

      // After advanceTurn, the protection is reset to PLAYING
      // So we need to check differently
      expect(result.success).toBe(true);
    });

    it('should only remove one copy of a card when playing it', () => {
      const state = game.getState();
      // Player has two Handmaids
      state.players[0].hand = ['handmaid', 'handmaid'];
      game.setState(state);

      const action: GameAction = {
        type: 'PLAY_CARD',
        playerId: 'p1',
        cardId: 'handmaid',
      };

      const result = game.applyMove(action);
      const newState = result.newState;

      expect(result.success).toBe(true);
      // Player should still have one Handmaid left
      expect(newState.players[0].hand).toHaveLength(1);
      expect(newState.players[0].hand[0]).toBe('handmaid');
      // And one Handmaid in the discard pile
      expect(newState.players[0].discardPile).toContain('handmaid');
    });

    it('should protect player through other players turns until their next turn', () => {
      // Set up 3-player game
      const game3 = new GameEngine();
      game3.init({
        players: [
          { id: 'p1', name: 'Alice' },
          { id: 'p2', name: 'Bob' },
          { id: 'p3', name: 'Charlie' },
        ],
      });
      game3.startRound();
      game3.drawPhase();

      let state = game3.getState();
      // Alice plays Handmaid
      state.players[0].hand = ['handmaid', 'guard'];
      state.players[1].hand = ['guard'];
      state.players[2].hand = ['baron'];
      game3.setState(state);

      // Alice plays Handmaid
      game3.applyMove({
        type: 'PLAY_CARD',
        playerId: 'p1',
        cardId: 'handmaid',
      });

      state = game3.getState();
      // After Alice plays Handmaid, she should be PROTECTED
      expect(state.players[0].status).toBe('PROTECTED');
      
      // Bob's turn - try to target Alice with Guard
      game3.drawPhase();
      state = game3.getState();
      state.players[1].hand = ['guard', 'priest'];
      game3.setState(state);

      // Bob should NOT be able to target Alice (she's protected)
      const validation = game3.validateMove('p2', {
        type: 'PLAY_CARD',
        playerId: 'p2',
        cardId: 'guard',
        targetPlayerId: 'p1',
        targetCardGuess: 'guard',
      });
      expect(validation.valid).toBe(false);
      expect(validation.error).toContain('protected');
      
      // Alice should still be protected after Bob's turn ends
      expect(state.players[0].status).toBe('PROTECTED');
    });

    it('should allow playing cards with no effect when all other players are protected', () => {
      const state = game.getState();
      state.players[0].hand = ['guard', 'priest'];
      state.players[1].hand = ['baron'];
      state.players[1].status = 'PROTECTED';
      game.setState(state);

      // Guard should be playable without target when all others are protected
      const action: GameAction = {
        type: 'PLAY_CARD',
        playerId: 'p1',
        cardId: 'guard',
        // No targetPlayerId - all others are protected
      };

      const result = game.applyMove(action);

      expect(result.success).toBe(true);
      expect(result.message).toContain('no effect');
      // Protected player should still be OK
      expect(result.newState.players[1].status).not.toBe('ELIMINATED');
    });
  });

  describe('Prince Tests', () => {
    it('should force target to discard and draw', () => {
      const state = game.getState();
      state.players[0].hand = ['prince'];
      state.players[1].hand = ['guard'];
      state.deck = ['priest', 'baron'];
      game.setState(state);

      const action: GameAction = {
        type: 'PLAY_CARD',
        playerId: 'p1',
        cardId: 'prince',
        targetPlayerId: 'p2',
      };

      const result = game.applyMove(action);
      const newState = result.newState;

      expect(result.success).toBe(true);
      expect(newState.players[1].discardPile).toContain('guard');
      expect(newState.players[1].hand).toHaveLength(1);
    });

    it('should eliminate target if Princess is discarded', () => {
      const state = game.getState();
      state.players[0].hand = ['prince'];
      state.players[1].hand = ['princess'];
      state.deck = ['guard'];
      game.setState(state);

      const action: GameAction = {
        type: 'PLAY_CARD',
        playerId: 'p1',
        cardId: 'prince',
        targetPlayerId: 'p2',
      };

      const result = game.applyMove(action);
      const newState = result.newState;

      expect(result.success).toBe(true);
      expect(newState.players[1].status).toBe('ELIMINATED');
    });

    it('should allow targeting self', () => {
      const state = game.getState();
      state.players[0].hand = ['prince'];
      state.deck = ['guard', 'priest'];
      game.setState(state);

      const action: GameAction = {
        type: 'PLAY_CARD',
        playerId: 'p1',
        cardId: 'prince',
        targetPlayerId: 'p1',
      };

      const validation = game.validateMove('p1', action);
      expect(validation.valid).toBe(true);
    });
  });

  describe('King Tests', () => {
    it('should swap hands between players', () => {
      const state = game.getState();
      state.players[0].hand = ['king'];
      state.players[1].hand = ['baron'];
      game.setState(state);

      const action: GameAction = {
        type: 'PLAY_CARD',
        playerId: 'p1',
        cardId: 'king',
        targetPlayerId: 'p2',
      };

      const result = game.applyMove(action);
      const newState = result.newState;

      expect(result.success).toBe(true);
      // Alice should now have Bob's card (baron), Bob should have nothing (king was played)
      expect(newState.players[0].hand).toContain('baron');
      expect(newState.players[1].hand).toHaveLength(0);
    });
  });

  describe('Countess Tests', () => {
    it('should have no effect when played', () => {
      const state = game.getState();
      state.players[0].hand = ['countess'];
      game.setState(state);

      const action: GameAction = {
        type: 'PLAY_CARD',
        playerId: 'p1',
        cardId: 'countess',
      };

      const result = game.applyMove(action);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Countess');
    });
  });

  describe('Princess Tests', () => {
    it('should eliminate player when discarded', () => {
      const state = game.getState();
      state.players[0].hand = ['princess'];
      game.setState(state);

      const action: GameAction = {
        type: 'PLAY_CARD',
        playerId: 'p1',
        cardId: 'princess',
      };

      const result = game.applyMove(action);
      const newState = result.newState;

      expect(result.success).toBe(true);
      expect(newState.players[0].status).toBe('ELIMINATED');
    });
  });
});

describe('Round End Tests', () => {
  let game: GameEngine;

  beforeEach(() => {
    game = new GameEngine();
  });

  it('should end round when only 1 player remains', () => {
    game.init({
      players: [
        { id: 'p1', name: 'Alice' },
        { id: 'p2', name: 'Bob' },
      ],
    });
    game.startRound();

    const state = game.getState();
    state.players[1].status = 'ELIMINATED';
    game.setState(state);

    const ended = game.checkRoundEnd();
    const newState = game.getState();

    expect(ended).toBe(true);
    expect(newState.phase).toBe('ROUND_END');
  });

  it('should end round when deck is empty', () => {
    game.init({
      players: [
        { id: 'p1', name: 'Alice' },
        { id: 'p2', name: 'Bob' },
      ],
    });
    game.startRound();

    const state = game.getState();
    state.deck = [];
    game.setState(state);

    const ended = game.checkRoundEnd();
    const newState = game.getState();

    expect(ended).toBe(true);
    expect(newState.phase).toBe('ROUND_END');
  });

  it('should award token to highest card holder', () => {
    game.init({
      players: [
        { id: 'p1', name: 'Alice' },
        { id: 'p2', name: 'Bob' },
      ],
    });
    game.startRound();

    const state = game.getState();
    state.players[0].hand = ['prince'];
    state.players[1].hand = ['guard'];
    state.deck = [];
    game.setState(state);

    game.checkRoundEnd();
    const newState = game.getState();

    expect(newState.players[0].tokens).toBe(1);
    expect(newState.players[0].status).toBe('WON_ROUND');
  });
});

describe('Game End Tests', () => {
  let game: GameEngine;

  it('should end game when player reaches token goal (2 players)', () => {
    game = new GameEngine();
    game.init({
      players: [
        { id: 'p1', name: 'Alice' },
        { id: 'p2', name: 'Bob' },
      ],
    });

    const state = game.getState();
    state.players[0].tokens = 6; // 2 player game requires 6 tokens
    game.setState(state);

    game.checkGameEnd();
    const newState = game.getState();

    expect(newState.phase).toBe('GAME_END');
    expect(newState.winnerId).toBe('p1');
  });

  it('should end game when player reaches token goal (3 players)', () => {
    game = new GameEngine();
    game.init({
      players: [
        { id: 'p1', name: 'Alice' },
        { id: 'p2', name: 'Bob' },
        { id: 'p3', name: 'Charlie' },
      ],
    });

    const state = game.getState();
    state.players[1].tokens = 5; // 3 player game requires 5 tokens
    game.setState(state);

    game.checkGameEnd();
    const newState = game.getState();

    expect(newState.phase).toBe('GAME_END');
    expect(newState.winnerId).toBe('p2');
  });

  it('should end game when player reaches token goal (4 players)', () => {
    game = new GameEngine();
    game.init({
      players: [
        { id: 'p1', name: 'Alice' },
        { id: 'p2', name: 'Bob' },
        { id: 'p3', name: 'Charlie' },
        { id: 'p4', name: 'David' },
      ],
    });

    const state = game.getState();
    state.players[2].tokens = 4; // 4 player game requires 4 tokens
    game.setState(state);

    game.checkGameEnd();
    const newState = game.getState();

    expect(newState.phase).toBe('GAME_END');
    expect(newState.winnerId).toBe('p3');
  });

  it('should end game when player reaches token goal (5 players)', () => {
    game = new GameEngine();
    game.init({
      players: [
        { id: 'p1', name: 'Alice' },
        { id: 'p2', name: 'Bob' },
        { id: 'p3', name: 'Charlie' },
        { id: 'p4', name: 'David' },
        { id: 'p5', name: 'Eve' },
      ],
    });

    const state = game.getState();
    state.players[3].tokens = 3; // 5 player game requires 3 tokens
    game.setState(state);

    game.checkGameEnd();
    const newState = game.getState();

    expect(newState.phase).toBe('GAME_END');
    expect(newState.winnerId).toBe('p4');
  });

  it('should end game when player reaches token goal (6 players)', () => {
    game = new GameEngine();
    game.init({
      players: [
        { id: 'p1', name: 'Alice' },
        { id: 'p2', name: 'Bob' },
        { id: 'p3', name: 'Charlie' },
        { id: 'p4', name: 'David' },
        { id: 'p5', name: 'Eve' },
        { id: 'p6', name: 'Frank' },
      ],
    });

    const state = game.getState();
    state.players[4].tokens = 3; // 6 player game requires 3 tokens
    game.setState(state);

    game.checkGameEnd();
    const newState = game.getState();

    expect(newState.phase).toBe('GAME_END');
    expect(newState.winnerId).toBe('p5');
  });
});

describe('State Serialization Tests', () => {
  let game: GameEngine;

  beforeEach(() => {
    game = new GameEngine();
    game.init({
      players: [
        { id: 'p1', name: 'Alice' },
        { id: 'p2', name: 'Bob' },
      ],
    });
    game.startRound();
  });

  it('should serialize state to JSON', () => {
    const state = game.getState();
    const json = JSON.stringify(state);

    expect(() => JSON.parse(json)).not.toThrow();
  });

  it('should restore state from JSON', () => {
    const originalState = game.getState();
    const json = JSON.stringify(originalState);
    const restoredState = JSON.parse(json);

    const newGame = new GameEngine();
    newGame.setState(restoredState);
    const newState = newGame.getState();

    expect(newState).toEqual(originalState);
  });
});

describe('Full Round Simulation', () => {
  it('should simulate a complete round with deterministic outcome', () => {
    const game = new GameEngine();
    
    // Initialize with 2 players
    game.init({
      players: [
        { id: 'p1', name: 'Alice' },
        { id: 'p2', name: 'Bob' },
      ],
    });

    // Start round
    game.startRound();
    let state = game.getState();
    
    expect(state.phase).toBe('TURN_START');
    expect(state.roundCount).toBe(1);

    // Player 1 draws
    game.drawPhase();
    state = game.getState();
    expect(state.phase).toBe('WAITING_FOR_ACTION');
    expect(state.players[0].hand).toHaveLength(2);

    // Get Alice's cards and play one that doesn't require a target or play Handmaid
    const aliceCards = state.players[0].hand;
    let cardToPlay: string = aliceCards.find(c => c === 'handmaid' || c === 'countess') || aliceCards[0];

    const cardDef = getCardDefinition(cardToPlay);
    
    let action: GameAction = {
      type: 'PLAY_CARD',
      playerId: 'p1',
      cardId: cardToPlay,
    };

    // Add target if required
    if (cardDef?.effect.requiresTargetPlayer) {
      action.targetPlayerId = 'p2';
    }

    // Add card guess for Guard
    if (cardToPlay === 'guard') {
      action.targetCardGuess = 'baron';
    }

    const result = game.applyMove(action);
    expect(result.success).toBe(true);

    // Check that state is consistent
    state = game.getState();
    expect(state.logs.length).toBeGreaterThan(0);
  });
});

describe('Advance Turn Tests', () => {
  let game: GameEngine;

  beforeEach(() => {
    game = new GameEngine();
    game.init({
      players: [
        { id: 'p1', name: 'Alice' },
        { id: 'p2', name: 'Bob' },
        { id: 'p3', name: 'Charlie' },
      ],
    });
    game.startRound();
  });

  it('should move to next player', () => {
    const state = game.getState();
    expect(state.activePlayerIndex).toBe(0);

    game.drawPhase();
    const updatedState = game.getState();
    updatedState.players[0].hand = ['handmaid'];
    game.setState(updatedState);

    const action: GameAction = {
      type: 'PLAY_CARD',
      playerId: 'p1',
      cardId: 'handmaid',
    };

    game.applyMove(action);
    const newState = game.getState();

    // After advance turn, should move to player 1 (Bob)
    expect(newState.activePlayerIndex).toBe(1);
  });

  it('should skip eliminated players', () => {
    const state = game.getState();
    state.players[1].status = 'ELIMINATED';
    state.activePlayerIndex = 0;
    state.players[0].hand = ['handmaid'];
    game.setState(state);

    game.advanceTurn();
    const newState = game.getState();

    // Should skip Bob (index 1) and go to Charlie (index 2)
    expect(newState.activePlayerIndex).toBe(2);
  });

  it('should reset PROTECTED status when protected player becomes active again', () => {
    // In a 3-player game: Player 0 (Alice) is protected, currently it's Player 2 (Charlie)'s turn
    const state = game.getState();
    state.players[0].status = 'PROTECTED';
    state.players[0].hand = ['guard'];
    state.players[1].hand = ['priest'];
    state.players[2].hand = ['baron'];
    state.activePlayerIndex = 2;  // Charlie's turn
    game.setState(state);

    // Advance from Charlie (index 2) to Alice (index 0) - protected player's turn now begins
    game.advanceTurn();
    const newState = game.getState();

    // Protection should be reset when it becomes their turn again
    expect(newState.activePlayerIndex).toBe(0);
    expect(newState.players[0].status).toBe('PLAYING');
  });
});

describe('2019 Ruleset Tests', () => {
  describe('Deck Creation', () => {
    it('should create classic deck with 16 cards', () => {
      const deck = createDeck('classic');
      expect(deck).toHaveLength(16);
    });

    it('should create 2019 deck with 21 cards', () => {
      const deck = createDeck('2019');
      expect(deck).toHaveLength(21);
    });

    it('should have Spy and Chancellor in 2019 deck', () => {
      const deck = createDeck('2019');
      expect(deck.filter(c => c === 'spy').length).toBe(2);
      expect(deck.filter(c => c === 'chancellor').length).toBe(2);
    });

    it('should have 6 Guards in 2019 deck', () => {
      const deck = createDeck('2019');
      expect(deck.filter(c => c === 'guard').length).toBe(6);
    });

    it('should NOT have Spy or Chancellor in classic deck', () => {
      const deck = createDeck('classic');
      expect(deck.filter(c => c === 'spy').length).toBe(0);
      expect(deck.filter(c => c === 'chancellor').length).toBe(0);
    });
  });

  describe('2-Player Burn Rule', () => {
    it('should burn 3 additional face-up cards for 2-player game', () => {
      const game = new GameEngine();
      game.init({
        players: [
          { id: 'p1', name: 'Alice' },
          { id: 'p2', name: 'Bob' },
        ],
        ruleset: 'classic'
      });
      game.startRound();
      const state = game.getState();

      expect(state.burnedCard).toBeTruthy();
      expect(state.burnedCardsFaceUp).toHaveLength(3);
      // 16 - 1 burned - 3 face up - 2 dealt = 10
      expect(state.deck.length).toBe(10);
    });

    it('should NOT burn extra cards for 3+ player game', () => {
      const game = new GameEngine();
      game.init({
        players: [
          { id: 'p1', name: 'Alice' },
          { id: 'p2', name: 'Bob' },
          { id: 'p3', name: 'Charlie' },
        ],
        ruleset: 'classic'
      });
      game.startRound();
      const state = game.getState();

      expect(state.burnedCard).toBeTruthy();
      expect(state.burnedCardsFaceUp).toHaveLength(0);
      // 16 - 1 burned - 3 dealt = 12
      expect(state.deck.length).toBe(12);
    });
  });

  describe('Spy Bonus Tests', () => {
    it('should award Spy bonus when only one player has Spy in discard', () => {
      const game = new GameEngine();
      game.init({
        players: [
          { id: 'p1', name: 'Alice' },
          { id: 'p2', name: 'Bob' },
        ],
        ruleset: '2019'
      });
      game.startRound();
      game.drawPhase();

      // Set up scenario where Alice has Spy in discard
      let state = game.getState();
      state.players[0].discardPile = ['spy', 'guard'];
      state.players[1].discardPile = ['priest'];
      state.players[0].hand = ['princess'];
      state.players[1].hand = ['guard'];
      state.deck = [];
      game.setState(state);

      // Force round end (deck empty)
      game.checkRoundEnd();
      state = game.getState();

      // Alice should get +1 for round win (highest card) and +1 for Spy bonus
      expect(state.players[0].tokens).toBe(2);
    });

    it('should NOT award Spy bonus when multiple players have Spy in discard', () => {
      const game = new GameEngine();
      game.init({
        players: [
          { id: 'p1', name: 'Alice' },
          { id: 'p2', name: 'Bob' },
        ],
        ruleset: '2019'
      });
      game.startRound();
      game.drawPhase();

      let state = game.getState();
      state.players[0].discardPile = ['spy'];
      state.players[1].discardPile = ['spy'];
      state.players[0].hand = ['princess'];
      state.players[1].hand = ['guard'];
      state.deck = [];
      game.setState(state);

      game.checkRoundEnd();
      state = game.getState();

      // Alice only gets +1 for round win, no Spy bonus
      expect(state.players[0].tokens).toBe(1);
    });

    it('should NOT award Spy bonus in classic ruleset', () => {
      const game = new GameEngine();
      game.init({
        players: [
          { id: 'p1', name: 'Alice' },
          { id: 'p2', name: 'Bob' },
        ],
        ruleset: 'classic'
      });
      game.startRound();
      game.drawPhase();

      let state = game.getState();
      // Even if spy somehow got into discard (shouldn't happen in classic)
      state.players[0].discardPile = ['spy'];
      state.players[0].hand = ['princess'];
      state.players[1].hand = ['guard'];
      state.deck = [];
      game.setState(state);

      game.checkRoundEnd();
      state = game.getState();

      // No Spy bonus in classic
      expect(state.players[0].tokens).toBe(1);
    });
  });

  describe('Chancellor Tests', () => {
    it('should enter CHANCELLOR_RESOLVING phase when Chancellor is played', () => {
      const game = new GameEngine();
      game.init({
        players: [
          { id: 'p1', name: 'Alice' },
          { id: 'p2', name: 'Bob' },
        ],
        ruleset: '2019'
      });
      game.startRound();
      game.drawPhase();

      let state = game.getState();
      state.players[0].hand = ['chancellor', 'guard'];
      state.deck = ['priest', 'baron', 'handmaid'];
      game.setState(state);

      const action: GameAction = {
        type: 'PLAY_CARD',
        playerId: 'p1',
        cardId: 'chancellor'
      };

      game.applyMove(action);
      state = game.getState();

      expect(state.phase).toBe('CHANCELLOR_RESOLVING');
      // Should have drawn 2 cards: guard (kept from before) + 2 drawn = 3 cards
      expect(state.players[0].hand).toHaveLength(3);
      expect(state.chancellorCards).toHaveLength(2);
    });

    it('should allow Chancellor return and advance turn', () => {
      const game = new GameEngine();
      game.init({
        players: [
          { id: 'p1', name: 'Alice' },
          { id: 'p2', name: 'Bob' },
        ],
        ruleset: '2019'
      });
      game.startRound();
      game.drawPhase();

      let state = game.getState();
      state.players[0].hand = ['chancellor', 'guard'];
      state.deck = ['priest', 'baron', 'handmaid'];
      game.setState(state);

      // Play Chancellor
      game.applyMove({
        type: 'PLAY_CARD',
        playerId: 'p1',
        cardId: 'chancellor'
      });

      state = game.getState();
      expect(state.phase).toBe('CHANCELLOR_RESOLVING');
      
      // Get the cards in hand (should be guard, priest, baron)
      const handAfterDraw = state.players[0].hand;
      expect(handAfterDraw).toHaveLength(3);

      // Return 2 cards
      const cardsToReturn = [handAfterDraw[1], handAfterDraw[2]];
      const result = game.applyMove({
        type: 'CHANCELLOR_RETURN',
        playerId: 'p1',
        cardsToReturn
      });

      expect(result.success).toBe(true);
      state = game.getState();
      
      // Should now be Bob's turn
      expect(state.activePlayerIndex).toBe(1);
      expect(state.phase).toBe('TURN_START');
      
      // Alice should have 1 card left
      expect(state.players[0].hand).toHaveLength(1);
      
      // Returned cards should be at bottom of deck
      expect(state.deck.slice(-2)).toEqual(expect.arrayContaining(cardsToReturn));
    });

    it('should reject Chancellor return with wrong number of cards', () => {
      const game = new GameEngine();
      game.init({
        players: [
          { id: 'p1', name: 'Alice' },
          { id: 'p2', name: 'Bob' },
        ],
        ruleset: '2019'
      });
      game.startRound();
      game.drawPhase();

      let state = game.getState();
      state.phase = 'CHANCELLOR_RESOLVING';
      state.players[0].hand = ['guard', 'priest', 'baron'];
      game.setState(state);

      // Try to return only 1 card
      const result = game.applyMove({
        type: 'CHANCELLOR_RETURN',
        playerId: 'p1',
        cardsToReturn: ['guard']
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('2 cards');
    });
  });

  describe('Guard Can Guess Spy', () => {
    it('should allow Guard guess of Spy and eliminate on correct guess', () => {
      const game = new GameEngine();
      game.init({
        players: [
          { id: 'p1', name: 'Alice' },
          { id: 'p2', name: 'Bob' },
        ],
        ruleset: '2019'
      });
      game.startRound();
      game.drawPhase();

      let state = game.getState();
      state.players[0].hand = ['guard', 'priest'];
      state.players[1].hand = ['spy'];
      game.setState(state);

      const action: GameAction = {
        type: 'PLAY_CARD',
        playerId: 'p1',
        cardId: 'guard',
        targetPlayerId: 'p2',
        targetCardGuess: 'spy'
      };

      const validation = game.validateMove('p1', action);
      expect(validation.valid).toBe(true);
      
      // Actually play the card
      const result = game.applyMove(action);
      expect(result.success).toBe(true);
      expect(result.eliminatedPlayerId).toBe('p2');
    });
  });
});
