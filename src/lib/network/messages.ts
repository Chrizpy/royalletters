import type { GameState } from '../types';

export type MessageType = 
  | 'PLAYER_JOINED'      // Guest announces themselves to host
  | 'PLAYER_INFO'        // Host sends player list to guest
  | 'GAME_STATE_SYNC'    // Full state synchronization
  | 'PLAYER_ACTION'      // A player plays a card
  | 'ROUND_START'        // Host starts a new round (includes RNG seed)
  | 'CONNECTION_ACK';    // Acknowledge connection established

export interface NetworkMessage {
  type: MessageType;
  payload: unknown;
  timestamp: number;
  senderId: string;
}

export interface PlayerJoinedPayload {
  playerId: string;
  playerName: string;
  avatarId?: string;
}

export interface PlayerInfoPayload {
  players: Array<{
    id: string;
    name: string;
    avatarId: string;
    isHost: boolean;
  }>;
}

export interface GameStateSyncPayload {
  state: GameState;
}

export interface PlayerActionPayload {
  cardId: string;
  targetPlayerId?: string;
  targetCardGuess?: string;
}

export interface RoundStartPayload {
  rngSeed: string;
}

export interface ConnectionAckPayload {
  playerId: string;
  playerName: string;
}

export function createMessage(
  type: MessageType,
  senderId: string,
  payload: unknown
): NetworkMessage {
  return {
    type,
    payload,
    timestamp: Date.now(),
    senderId,
  };
}
