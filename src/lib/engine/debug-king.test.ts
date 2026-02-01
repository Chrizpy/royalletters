import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from './game';
import type { GameConfig, GameAction, GameState } from '../types';

describe('King bug investigation', () => {
  let game: GameEngine;

  beforeEach(() => {
    game = new GameEngine();
    const config: GameConfig = {
      players: [
        { id: 'p1', name: 'Alice', isHost: true },
        { id: 'p2', name: 'Bob' },
      ],
    };
    game.init(config);
    game.startRound();
    game.drawPhase();
  });

  it('Debug validation path', () => {
    const state = game.getState();
    state.players[0].hand = ['king', 'guard'];
    state.players[1].hand = [];
    state.players[1].status = 'ELIMINATED';
    game.setState(state);

    // Let's manually trace the validation logic
    const currentState = game.getState();
    const playerId = 'p1';
    const targetPlayerId = 'p2';
    
    // Step 1: Check if target is required
    // King has requiresTargetPlayer = true
    
    // Step 2: Calculate valid targets
    const validTargets = currentState.players.filter(p => {
      if (p.id === playerId && true) return false;  // canTargetSelf is undefined/false for King
      if (p.status === 'ELIMINATED') return false;
      if (p.status === 'PROTECTED' && p.id !== playerId) return false;
      return true;
    });
    
    console.log('Valid targets:', validTargets.map(p => ({ id: p.id, status: p.status })));
    console.log('Valid targets length:', validTargets.length);
    
    // Step 3: If no valid targets, allow with no effect
    // BUT if validTargets.length === 0, the code should return { valid: true } and NOT proceed
    // to check targetPlayerId
    
    // The problem is: validTargets.length === 0 (Bob is ELIMINATED)
    // So the code returns { valid: true } at line 211
    // But then in applyMove, the check at line 323 only checks if targetPlayerId is empty
    // If targetPlayerId IS provided (even if invalid), it goes into the else branch
    // and calls applyTradeHands
    
    console.log('\nThis is the bug!');
    console.log('When validTargets is empty, validateMove returns valid: true');
    console.log('But if targetPlayerId is STILL provided in the action, applyMove');
    console.log('will NOT treat it as "no effect" because targetPlayerId is not falsy');
  });
});
