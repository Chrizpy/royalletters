import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameEngine } from '../engine/game';
import { GameSync } from './sync';
import { PeerManager } from './peer';
import type { GameConfig } from '../types';

describe('GameSync Tests', () => {
  let engine: GameEngine;
  let peerManager: PeerManager;
  let hostSync: GameSync;

  beforeEach(() => {
    engine = new GameEngine();
    peerManager = new PeerManager();
    
    const config: GameConfig = {
      players: [
        { id: 'host-id', name: 'Host', isHost: true },
        { id: 'guest-id', name: 'Guest', isHost: false }
      ]
    };
    engine.init(config);
    
    hostSync = new GameSync(engine, peerManager, true, 'host-id', 'Host');
  });

  it('should create GameSync instance', () => {
    expect(hostSync).toBeDefined();
  });

  it('should get game state', () => {
    const state = hostSync.getGameState();
    expect(state.players).toHaveLength(2);
    expect(state.phase).toBe('LOBBY');
  });

  it('should start round as host', () => {
    hostSync.startRound();
    const state = hostSync.getGameState();
    
    // Round should be started
    expect(state.roundCount).toBe(1);
    expect(state.phase).toBe('TURN_START');
  });

  it('should not start round as guest', () => {
    const guestEngine = new GameEngine();
    const guestPeerManager = new PeerManager();
    const config: GameConfig = {
      players: [
        { id: 'host-id', name: 'Host', isHost: true },
        { id: 'guest-id', name: 'Guest', isHost: false }
      ]
    };
    guestEngine.init(config);
    
    const guestSync = new GameSync(guestEngine, guestPeerManager, false, 'guest-id', 'Guest');
    
    // Guest should not be able to start round
    guestSync.startRound();
    const state = guestSync.getGameState();
    
    // Round should not be started
    expect(state.roundCount).toBe(0);
    expect(state.phase).toBe('LOBBY');
  });
});
