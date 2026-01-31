import { GameEngine } from '../engine/game';
import { PeerManager } from './peer';
import {
  createMessage,
  type NetworkMessage,
  type PlayerJoinedPayload,
  type PlayerInfoPayload,
  type GameStateSyncPayload,
  type PlayerActionPayload,
  type ConnectionAckPayload,
} from './messages';
import type { GameAction, GameState } from '../types';

export class GameSync {
  private engine: GameEngine;
  private peerManager: PeerManager;
  private isHost: boolean;
  private localPlayerId: string;
  private localPlayerName: string;

  constructor(
    engine: GameEngine,
    peerManager: PeerManager,
    isHost: boolean,
    localPlayerId: string,
    localPlayerName: string
  ) {
    this.engine = engine;
    this.peerManager = peerManager;
    this.isHost = isHost;
    this.localPlayerId = localPlayerId;
    this.localPlayerName = localPlayerName;

    this.setupMessageHandler();
  }

  /**
   * Set up message handler for incoming messages
   */
  private setupMessageHandler(): void {
    this.peerManager.onMessage((message, conn) => {
      this.handleMessage(message, conn.peer);
    });
  }

  /**
   * Handle incoming network messages
   */
  private handleMessage(message: NetworkMessage, fromPeerId: string): void {
    console.log('Received message:', message.type, 'from:', fromPeerId);

    try {
      switch (message.type) {
        case 'PLAYER_JOINED':
          this.handlePlayerJoined(message, fromPeerId);
          break;
        case 'PLAYER_INFO':
          this.handlePlayerInfo(message);
          break;
        case 'GAME_STATE_SYNC':
          this.handleGameStateSync(message);
          break;
        case 'PLAYER_ACTION':
          this.handlePlayerAction(message);
          break;
        case 'ROUND_START':
          this.handleRoundStart(message);
          break;
        case 'CONNECTION_ACK':
          this.handleConnectionAck(message);
          break;
        default:
          console.warn('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Error handling message:', error);
    }
  }

  /**
   * HOST: Handle guest announcing themselves
   */
  private handlePlayerJoined(message: NetworkMessage, fromPeerId: string): void {
    if (!this.isHost) return;

    const payload = message.payload as PlayerJoinedPayload;
    console.log('Player joined:', payload.playerName);

    // Send acknowledgment
    const ackMessage = createMessage('CONNECTION_ACK', this.localPlayerId, {
      playerId: this.localPlayerId,
      playerName: this.localPlayerName,
    } as ConnectionAckPayload);
    this.peerManager.sendTo(fromPeerId, ackMessage);

    // Broadcast updated player info to all clients
    this.broadcastPlayerInfo();
  }

  /**
   * GUEST: Handle receiving player info from host
   */
  private handlePlayerInfo(message: NetworkMessage): void {
    if (this.isHost) return;

    const payload = message.payload as PlayerInfoPayload;
    console.log('Received player info:', payload.players);
    
    // Update local state (can be used to update UI)
    // This would typically update a Svelte store
  }

  /**
   * Handle full game state synchronization
   */
  private handleGameStateSync(message: NetworkMessage): void {
    const payload = message.payload as GameStateSyncPayload;
    console.log('Received game state sync');
    
    // Update local game state
    this.engine.setState(payload.state);
  }

  /**
   * HOST: Handle player action from guest
   */
  private handlePlayerAction(message: NetworkMessage): void {
    if (!this.isHost) return;

    const payload = message.payload as PlayerActionPayload;
    
    const action: GameAction = {
      type: 'PLAY_CARD',
      playerId: message.senderId,
      cardId: payload.cardId,
      targetPlayerId: payload.targetPlayerId,
      targetCardGuess: payload.targetCardGuess,
    };

    // Validate and apply action
    const result = this.engine.applyMove(action);
    
    if (result.success) {
      // Broadcast updated state to all clients
      this.broadcastGameState();
    } else {
      console.error('Action failed:', result.message);
    }
  }

  /**
   * Handle round start message
   */
  private handleRoundStart(message: NetworkMessage): void {
    if (this.isHost) return;

    console.log('Round started by host');
    // The game state sync will be sent separately
  }

  /**
   * GUEST: Handle connection acknowledgment from host
   */
  private handleConnectionAck(message: NetworkMessage): void {
    if (this.isHost) return;

    const payload = message.payload as ConnectionAckPayload;
    console.log('Connection acknowledged by host:', payload.playerName);
  }

  /**
   * HOST: Announce a new player joining (guest calls this)
   */
  announceJoin(): void {
    if (this.isHost) return;

    const message = createMessage('PLAYER_JOINED', this.localPlayerId, {
      playerId: this.localPlayerId,
      playerName: this.localPlayerName,
    } as PlayerJoinedPayload);

    this.peerManager.broadcast(message);
  }

  /**
   * HOST: Broadcast player info to all connected peers
   */
  broadcastPlayerInfo(): void {
    if (!this.isHost) return;

    const state = this.engine.getState();
    const payload: PlayerInfoPayload = {
      players: state.players.map((p) => ({
        id: p.id,
        name: p.name,
        avatarId: p.avatarId,
        isHost: p.isHost,
      })),
    };

    const message = createMessage('PLAYER_INFO', this.localPlayerId, payload);
    this.peerManager.broadcast(message);
  }

  /**
   * HOST: Broadcast full game state to all connected peers
   */
  broadcastGameState(): void {
    if (!this.isHost) return;

    const state = this.engine.getState();
    const payload: GameStateSyncPayload = { state };
    const message = createMessage('GAME_STATE_SYNC', this.localPlayerId, payload);
    
    this.peerManager.broadcast(message);
  }

  /**
   * GUEST: Send player action to host
   */
  sendPlayerAction(
    cardId: string,
    targetPlayerId?: string,
    targetCardGuess?: string
  ): void {
    if (this.isHost) {
      // Host applies actions directly
      const action: GameAction = {
        type: 'PLAY_CARD',
        playerId: this.localPlayerId,
        cardId,
        targetPlayerId,
        targetCardGuess,
      };
      
      const result = this.engine.applyMove(action);
      
      if (result.success) {
        this.broadcastGameState();
      }
    } else {
      // Guest sends to host
      const payload: PlayerActionPayload = {
        cardId,
        targetPlayerId,
        targetCardGuess,
      };
      
      const message = createMessage('PLAYER_ACTION', this.localPlayerId, payload);
      this.peerManager.broadcast(message);
    }
  }

  /**
   * HOST: Start a new round
   */
  startRound(): void {
    if (!this.isHost) return;

    this.engine.startRound();
    
    // Broadcast the new state
    this.broadcastGameState();
  }

  /**
   * Get current game state
   */
  getGameState(): GameState {
    return this.engine.getState();
  }
}
