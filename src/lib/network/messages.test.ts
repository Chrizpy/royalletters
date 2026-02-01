import { describe, it, expect } from 'vitest';
import { createMessage, type NetworkMessage, type PlayerJoinedPayload } from './messages';

describe('Network Messages Tests', () => {
  it('should create a valid network message', () => {
    const payload: PlayerJoinedPayload = {
      playerId: 'p1',
      playerName: 'Alice',
      avatarId: 'avatar1'
    };

    const message = createMessage('PLAYER_JOINED', 'sender-id', payload);

    expect(message.type).toBe('PLAYER_JOINED');
    expect(message.senderId).toBe('sender-id');
    expect(message.payload).toEqual(payload);
    expect(message.timestamp).toBeGreaterThan(0);
  });

  it('should create messages with current timestamp', () => {
    const beforeTime = Date.now();
    const message = createMessage('CONNECTION_ACK', 'sender-id', {});
    const afterTime = Date.now();

    expect(message.timestamp).toBeGreaterThanOrEqual(beforeTime);
    expect(message.timestamp).toBeLessThanOrEqual(afterTime);
  });

  it('should handle different message types', () => {
    const messageTypes = [
      'PLAYER_JOINED',
      'PLAYER_INFO',
      'GAME_STATE_SYNC',
      'PLAYER_ACTION',
      'ROUND_START',
      'CONNECTION_ACK',
      'CHAT_MESSAGE'
    ] as const;

    messageTypes.forEach(type => {
      const message = createMessage(type, 'sender', {});
      expect(message.type).toBe(type);
    });
  });
});
