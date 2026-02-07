import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameEngine } from '../engine/game';
import { GameSync } from './sync';
import { PeerManager } from './peer';
import { createMessage, type ReconnectPayload, type RequestStateSyncPayload } from './messages';
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

describe('GameSync Reconnection Tests', () => {
  let hostEngine: GameEngine;
  let hostPeerManager: PeerManager;
  let hostSync: GameSync;
  let guestEngine: GameEngine;
  let guestPeerManager: PeerManager;
  let guestSync: GameSync;

  beforeEach(() => {
    hostEngine = new GameEngine();
    hostPeerManager = new PeerManager();
    
    const config: GameConfig = {
      players: [
        { id: 'host-id', name: 'Host', isHost: true },
        { id: 'guest-id', name: 'Guest', isHost: false }
      ]
    };
    hostEngine.init(config);
    hostSync = new GameSync(hostEngine, hostPeerManager, true, 'host-id', 'Host');

    guestEngine = new GameEngine();
    guestPeerManager = new PeerManager();
    guestEngine.init(config);
    guestSync = new GameSync(guestEngine, guestPeerManager, false, 'guest-id', 'Guest');
  });

  it('should create RECONNECT message with correct structure', () => {
    const message = createMessage('RECONNECT', 'guest-id', {
      playerId: 'guest-id',
      playerName: 'Guest',
    } as ReconnectPayload);

    expect(message.type).toBe('RECONNECT');
    expect(message.senderId).toBe('guest-id');
    expect((message.payload as ReconnectPayload).playerId).toBe('guest-id');
    expect((message.payload as ReconnectPayload).playerName).toBe('Guest');
    expect(message.timestamp).toBeDefined();
  });

  it('should create REQUEST_STATE_SYNC message with correct structure', () => {
    const message = createMessage('REQUEST_STATE_SYNC', 'guest-id', {
      playerId: 'guest-id',
    } as RequestStateSyncPayload);

    expect(message.type).toBe('REQUEST_STATE_SYNC');
    expect(message.senderId).toBe('guest-id');
    expect((message.payload as RequestStateSyncPayload).playerId).toBe('guest-id');
    expect(message.timestamp).toBeDefined();
  });

  it('guest should have announceReconnect method', () => {
    expect(typeof guestSync.announceReconnect).toBe('function');
  });

  it('guest should have requestStateSync method', () => {
    expect(typeof guestSync.requestStateSync).toBe('function');
  });

  it('host should not call announceReconnect', () => {
    // Mock broadcast to verify it's not called
    const broadcastSpy = vi.spyOn(hostPeerManager, 'broadcast');
    
    hostSync.announceReconnect();
    
    // Host should not broadcast reconnect messages
    expect(broadcastSpy).not.toHaveBeenCalled();
  });

  it('guest should be able to call announceReconnect', () => {
    // Mock broadcast - it won't actually send since no peers connected
    const broadcastSpy = vi.spyOn(guestPeerManager, 'broadcast');
    
    guestSync.announceReconnect();
    
    // Guest should attempt to broadcast reconnect message
    expect(broadcastSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'RECONNECT',
        senderId: 'guest-id',
        payload: expect.objectContaining({
          playerId: 'guest-id',
          playerName: 'Guest',
        }),
      })
    );
  });

  it('guest should be able to call requestStateSync', () => {
    const broadcastSpy = vi.spyOn(guestPeerManager, 'broadcast');
    
    guestSync.requestStateSync();
    
    expect(broadcastSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'REQUEST_STATE_SYNC',
        senderId: 'guest-id',
        payload: expect.objectContaining({
          playerId: 'guest-id',
        }),
      })
    );
  });
});
