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
  | 'PAUSE_TIMER_TICK'   // Host sends timer tick to player showing modal
  | 'MODAL_DISMISS';     // Player tells host they dismissed the modal

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

export interface PauseTimerTickPayload {
  reason: 'priest_reveal' | 'elimination';
  remainingSeconds: number;
  targetPlayerId: string;  // The player who should see this modal
}

export interface ModalDismissPayload {
  reason: 'priest_reveal' | 'elimination';
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
