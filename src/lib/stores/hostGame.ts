import { writable, get } from 'svelte/store';
import QRCode from 'qrcode';
import { PeerManager } from '../network/peer';
import { peerId, connectionState, connectedPlayers, isHost } from './network';
import {
  gameState,
  gameStarted,
  initGame,
  startRound,
  applyAction,
  getEngine,
  checkIfAITurn,
  executeAIMove,
} from './game';
import {
  createMessage,
  type NetworkMessage,
  type GameStateSyncPayload,
  type PriestRevealPayload,
  type PlayerActionPayload,
  type ChatMessagePayload,
  type ReconnectPayload,
  type PlayerJoinedPayload,
} from '../network/messages';
import { addChatMessage } from './chat';
import { v4 as uuidv4 } from 'uuid';
import type { Ruleset } from '../types';

// ---------------------------------------------------------------------------
// Reactive stores (UI subscribes to these)
// ---------------------------------------------------------------------------
export const hostPeerId = writable<string>('');
export const hostError = writable<string>('');
export const hostConnectionState = writable<string>('disconnected');
export const hostPlayers = writable<Array<{ id: string; name: string; isAI?: boolean }>>([]);
export const hostQrCodeDataUrl = writable<string>('');

// ---------------------------------------------------------------------------
// Private module state (not directly reactive)
// ---------------------------------------------------------------------------
let peerManager: PeerManager;
let aiCounter = 1;
let aiMoveDelayMs = 2000;

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

/**
 * Set up PeerManager, generate peer ID, generate QR code.
 * Call this from onMount in HostLobby.
 */
export async function initializeHost(): Promise<void> {
  try {
    const randomSuffix = Math.random().toString(36).substring(2, 6);
    const generatedPeerId = `royal-${randomSuffix}`;

    peerManager = new PeerManager();

    peerManager.onStateChange((state) => {
      hostConnectionState.set(state);
      connectionState.set(state);
    });

    peerManager.onConnection((newPeerId) => {
      console.log('New player connected:', newPeerId);
    });

    peerManager.onMessage((message, conn) => {
      handleMessage(message, conn.peer);
    });

    await peerManager.createHost(generatedPeerId);
    peerId.set(generatedPeerId);
    hostPeerId.set(generatedPeerId);

    // Generate QR code
    const qrData = JSON.stringify({
      peerId: generatedPeerId,
      game: 'royalletters',
      version: '1.0',
    });

    const dataUrl = await QRCode.toDataURL(qrData, {
      width: 300,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    });
    hostQrCodeDataUrl.set(dataUrl);
  } catch (err) {
    hostError.set(`Failed to create host: ${err}`);
    console.error(err);
  }
}

// ---------------------------------------------------------------------------
// Message handling
// ---------------------------------------------------------------------------

function handleMessage(message: NetworkMessage, fromPeerId: string): void {
  console.log('Host received message:', message.type, 'from:', fromPeerId);

  if (message.type === 'PLAYER_JOINED') {
    handlePlayerJoined(message.payload, fromPeerId);
  } else if (message.type === 'PLAYER_ACTION') {
    handlePlayerAction(message.payload, message.senderId, fromPeerId);
  } else if (message.type === 'CHAT_MESSAGE') {
    handleChatMessage(message.payload, message, fromPeerId);
  } else if (message.type === 'RECONNECT') {
    handleReconnect(message.payload, fromPeerId);
  } else if (message.type === 'REQUEST_STATE_SYNC') {
    handleRequestStateSync(fromPeerId);
  }
}

function handlePlayerJoined(payload: PlayerJoinedPayload, fromPeerId: string): void {
  const players = get(hostPlayers);
  const playerName = payload.playerName || `Player ${players.length + 2}`;

  if (!players.some((p) => p.id === fromPeerId)) {
    hostPlayers.update((p) => [...p, { id: fromPeerId, name: playerName }]);
    connectedPlayers.update((p) => [
      ...p,
      { id: fromPeerId, name: playerName, avatarId: 'default', isHost: false },
    ]);
  }
}

function handlePlayerAction(
  payload: PlayerActionPayload,
  senderId: string,
  fromPeerId: string,
): void {
  const generatedPeerId = get(hostPeerId);

  if (payload.isRevengeGuess) {
    applyAction({
      type: 'REVENGE_GUESS',
      playerId: senderId,
      targetCardGuess: payload.targetCardGuess,
    });
  } else if (payload.cardsToReturn) {
    applyAction({
      type: 'CHANCELLOR_RETURN',
      playerId: senderId,
      cardsToReturn: payload.cardsToReturn,
    });
  } else {
    const result = applyAction({
      type: 'PLAY_CARD',
      playerId: senderId,
      cardId: payload.cardId,
      targetPlayerId: payload.targetPlayerId,
      targetCardGuess: payload.targetCardGuess,
    });

    // If a Priest reveal happened, send it privately to the player who played Priest
    if (result?.revealedCard && peerManager) {
      const engine = getEngine();
      const targetPlayer = engine
        ?.getState()
        .players.find((p) => p.id === payload.targetPlayerId);
      const priestRevealPayload: PriestRevealPayload = {
        cardId: result.revealedCard,
        targetPlayerName: targetPlayer?.name || 'Unknown',
      };
      const priestRevealMessage = createMessage(
        'PRIEST_REVEAL',
        generatedPeerId,
        priestRevealPayload,
      );
      peerManager.sendTo(fromPeerId, priestRevealMessage);
    }
  }

  broadcastAndScheduleAI();
}

function handleChatMessage(
  payload: ChatMessagePayload,
  message: NetworkMessage,
  fromPeerId: string,
): void {
  const chatMsg = {
    id: uuidv4(),
    senderId: message.senderId,
    senderName: payload.senderName,
    text: payload.text,
    timestamp: payload.timestamp,
  };
  addChatMessage(chatMsg);
  peerManager.broadcastExcept(message, fromPeerId);
}

function handleReconnect(payload: ReconnectPayload, fromPeerId: string): void {
  console.log('Player reconnecting:', payload.playerName, 'with ID:', payload.playerId);

  const engine = getEngine();
  const state = engine?.getState();
  const existingPlayer = state?.players.find((p) => p.id === payload.playerId);

  if (existingPlayer && get(gameStarted)) {
    console.log('Reconnecting existing player:', existingPlayer.name);

    const players = get(hostPlayers);
    if (!players.some((p) => p.id === payload.playerId)) {
      hostPlayers.update((p) => [...p, { id: payload.playerId, name: existingPlayer.name }]);
    }

    if (peerManager && state) {
      const generatedPeerId = get(hostPeerId);
      const syncMessage = createMessage('GAME_STATE_SYNC', generatedPeerId, { state });
      peerManager.sendTo(fromPeerId, syncMessage);
    }

    scheduleAIMove();
  } else {
    console.warn('Unknown player trying to reconnect or game not started:', payload.playerId);
    if (!get(gameStarted)) {
      const players = get(hostPlayers);
      if (!players.some((p) => p.id === fromPeerId)) {
        hostPlayers.update((p) => [...p, { id: fromPeerId, name: payload.playerName }]);
      }
    }
  }
}

function handleRequestStateSync(fromPeerId: string): void {
  console.log('State sync requested by:', fromPeerId);

  const engine = getEngine();
  const state = engine?.getState();
  const generatedPeerId = get(hostPeerId);

  if (peerManager && state && get(gameStarted)) {
    const syncMessage = createMessage('GAME_STATE_SYNC', generatedPeerId, { state });
    peerManager.sendTo(fromPeerId, syncMessage);
  }
}

// ---------------------------------------------------------------------------
// Broadcasting & AI
// ---------------------------------------------------------------------------

function broadcastGameState(): void {
  const engine = getEngine();
  if (!engine || !peerManager) return;

  const state = engine.getState();
  const generatedPeerId = get(hostPeerId);
  const payload: GameStateSyncPayload = { state };
  const message = createMessage('GAME_STATE_SYNC', generatedPeerId, payload);
  peerManager.broadcast(message);
}

function broadcastAndScheduleAI(): void {
  broadcastGameState();
  scheduleAIMove();
}

function scheduleAIMove(): void {
  setTimeout(() => {
    processAITurn();
  }, aiMoveDelayMs);
}

function processAITurn(): void {
  if (!checkIfAITurn()) return;

  const result = executeAIMove();
  if (result) {
    broadcastAndScheduleAI();
  }
}

// ---------------------------------------------------------------------------
// Game lifecycle (called by the component)
// ---------------------------------------------------------------------------

export function handleStartGame(
  hostName: string,
  players: Array<{ id: string; name: string; isAI?: boolean }>,
  selectedRuleset: Ruleset,
  effectiveTokens: number,
): void {
  console.log('Starting game...');

  const generatedPeerId = get(hostPeerId);
  const allPlayers = [
    { id: generatedPeerId, name: hostName, isHost: true, isAI: false },
    ...players.map((p) => ({ id: p.id, name: p.name, isHost: false, isAI: p.isAI || false })),
  ];

  initGame(allPlayers, selectedRuleset, effectiveTokens);
  startRound();
  broadcastAndScheduleAI();
}

export function handleHostPlayCard(
  cardId: string,
  targetPlayerId?: string,
  targetCardGuess?: string,
): void {
  const generatedPeerId = get(hostPeerId);
  applyAction({
    type: 'PLAY_CARD',
    playerId: generatedPeerId,
    cardId,
    targetPlayerId,
    targetCardGuess,
  });
  broadcastAndScheduleAI();
}

export function handleHostChancellorReturn(cardsToReturn: string[]): void {
  const generatedPeerId = get(hostPeerId);
  applyAction({
    type: 'CHANCELLOR_RETURN',
    playerId: generatedPeerId,
    cardsToReturn,
  });
  broadcastAndScheduleAI();
}

export function handleHostRevengeGuess(targetCardGuess: string): void {
  const generatedPeerId = get(hostPeerId);
  applyAction({
    type: 'REVENGE_GUESS',
    playerId: generatedPeerId,
    targetCardGuess,
  });
  broadcastAndScheduleAI();
}

export function handleHostStartRound(): void {
  startRound();
  broadcastAndScheduleAI();
}

export function handleHostPlayAgain(
  hostName: string,
  players: Array<{ id: string; name: string; isAI?: boolean }>,
  selectedRuleset: Ruleset,
  effectiveTokens: number,
): void {
  const generatedPeerId = get(hostPeerId);
  const allPlayers = [
    { id: generatedPeerId, name: hostName, isHost: true, isAI: false },
    ...players.map((p) => ({ id: p.id, name: p.name, isHost: false, isAI: p.isAI || false })),
  ];

  initGame(allPlayers, selectedRuleset, effectiveTokens);
  startRound();
  broadcastAndScheduleAI();
}

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

export function sendHostChat(text: string, hostName: string): void {
  const generatedPeerId = get(hostPeerId);
  const chatMsg = {
    id: uuidv4(),
    senderId: generatedPeerId,
    senderName: hostName,
    text,
    timestamp: Date.now(),
  };

  addChatMessage(chatMsg);

  const payload: ChatMessagePayload = {
    text,
    senderName: hostName,
    timestamp: chatMsg.timestamp,
  };
  const message = createMessage('CHAT_MESSAGE', generatedPeerId, payload);
  peerManager.broadcast(message);
}

// ---------------------------------------------------------------------------
// AI Player Management
// ---------------------------------------------------------------------------

export function setAIMoveDelay(delayMs: number): void {
  aiMoveDelayMs = delayMs;
}

export function syncAIPlayers(targetCount: number): void {
  const players = get(hostPlayers);
  const currentAIs = players.filter((p) => p.isAI);
  const currentAICount = currentAIs.length;

  if (targetCount > currentAICount) {
    const toAdd = targetCount - currentAICount;
    const newAIs: Array<{ id: string; name: string; isAI: boolean }> = [];
    for (let i = 0; i < toAdd; i++) {
      newAIs.push({
        id: `ai-${uuidv4().substring(0, 8)}`,
        name: `AI ${aiCounter++}`,
        isAI: true,
      });
    }
    hostPlayers.set([...players, ...newAIs]);
  } else if (targetCount < currentAICount) {
    const toRemove = currentAICount - targetCount;
    const aiIds = currentAIs.slice(-toRemove).map((p) => p.id);
    hostPlayers.set(players.filter((p) => !aiIds.includes(p.id)));
  }
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

export function cleanupHost(): void {
  if (peerManager) {
    peerManager.disconnect();
  }
}

export function handleHostBack(): void {
  cleanupHost();
  isHost.set(null);
}

/**
 * Reset all host-specific state. Call when leaving host mode.
 */
export function resetHostState(): void {
  hostPeerId.set('');
  hostError.set('');
  hostConnectionState.set('disconnected');
  hostPlayers.set([]);
  hostQrCodeDataUrl.set('');
  aiCounter = 1;
  aiMoveDelayMs = 2000;
}
