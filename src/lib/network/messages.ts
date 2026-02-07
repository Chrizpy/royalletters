import type { GameState } from '../types';

export type MessageType = 
  | 'PLAYER_JOINED'      // Guest announces themselves to host
  | 'PLAYER_INFO'        // Host sends player list to guest
  | 'GAME_STATE_SYNC'    // Full state synchronization
  | 'PLAYER_ACTION'      // A player plays a card
  | 'ROUND_START'        // Host starts a new round (includes RNG seed)
  | 'CONNECTION_ACK'     // Acknowledge connection established
  | 'PRIEST_REVEAL'      // Private reveal for Priest card effect
  | 'CHAT_MESSAGE'       // In-game chat message
  | 'RECONNECT'          // Player reconnecting to existing game
  | 'REQUEST_STATE_SYNC';// Request current game state from host

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
  cardId?: string;
  targetPlayerId?: string;
  targetCardGuess?: string;
  cardsToReturn?: string[];  // For Chancellor effect
  isRevengeGuess?: boolean;  // For tillbakakaka revenge guess
}

export interface RoundStartPayload {
  rngSeed: string;
}

export interface ConnectionAckPayload {
  playerId: string;
  playerName: string;
}

export interface PriestRevealPayload {
  cardId: string;
  targetPlayerName: string;
}

export interface ChatMessagePayload {
  text: string;
  senderName: string;
  timestamp: number;
}

export interface ReconnectPayload {
  playerId: string;
  playerName: string;
}

export interface RequestStateSyncPayload {
  playerId: string;
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
