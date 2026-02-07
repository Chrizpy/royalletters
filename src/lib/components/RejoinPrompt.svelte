<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { PeerManager } from '../network/peer';
  import { peerId, remotePeerId, connectionState, isHost } from '../stores/network';
  import { gameState, gameStarted, setGameState, revealedCard } from '../stores/game';
  import { createMessage, type NetworkMessage, type GameStateSyncPayload, type PlayerActionPayload, type PriestRevealPayload, type ChatMessagePayload, type ReconnectPayload } from '../network/messages';
  import GameScreen from './GameScreen.svelte';
  import { addChatMessage, clearChatMessages } from '../stores/chat';
  import { type GameSession, clearSession, getSessionAge } from '../stores/session';
  import { v4 as uuidv4 } from 'uuid';

  export let session: GameSession;
  export let onDismiss: () => void;

  let peerManager: PeerManager;
  let localConnectionState: string = 'disconnected';
  let isReconnecting = false;
  let error = '';

  // Subscribe to game started state
  $: inGame = $gameStarted;

  onDestroy(() => {
    if (peerManager && !inGame) {
      peerManager.disconnect();
    }
  });

  function handleMessage(message: NetworkMessage) {
    console.log('Rejoining guest received message:', message.type);
    
    if (message.type === 'GAME_STATE_SYNC') {
      const payload = message.payload as GameStateSyncPayload;
      setGameState(payload.state);
      isReconnecting = false; // Successfully reconnected
    } else if (message.type === 'PRIEST_REVEAL') {
      const payload = message.payload as PriestRevealPayload;
      revealedCard.set({
        cardId: payload.cardId,
        playerName: payload.targetPlayerName,
        viewerPlayerId: session.guestPeerId
      });
    } else if (message.type === 'CHAT_MESSAGE') {
      const payload = message.payload as ChatMessagePayload;
      const chatMsg = {
        id: uuidv4(),
        senderId: message.senderId,
        senderName: payload.senderName,
        text: payload.text,
        timestamp: payload.timestamp
      };
      addChatMessage(chatMsg);
    }
  }

  async function handleRejoin() {
    isReconnecting = true;
    error = '';
    
    // Clear stale state from previous session
    revealedCard.set(null);
    clearChatMessages();
    gameState.set(null);
    gameStarted.set(false);
    
    try {
      // Create peer manager with the SAME peer ID as before
      peerManager = new PeerManager();
      
      // Set up state listener
      peerManager.onStateChange((state) => {
        localConnectionState = state;
        connectionState.set(state);
        
        if (state === 'connected') {
          remotePeerId.set(session.hostPeerId);
          peerId.set(session.guestPeerId);
          isHost.set(false);
          
          // Send RECONNECT message instead of PLAYER_JOINED
          const reconnectPayload: ReconnectPayload = {
            playerId: session.guestPeerId,
            playerName: session.nickname
          };
          const reconnectMessage = createMessage('RECONNECT', session.guestPeerId, reconnectPayload);
          peerManager.broadcast(reconnectMessage);
        } else if (state === 'disconnected' || state === 'error') {
          isReconnecting = false;
          error = 'Could not reconnect to the game. The host may have closed the session.';
        }
      });

      // Set up message handler
      peerManager.onMessage((message, conn) => {
        handleMessage(message);
      });
      
      // Connect to host using the SAME guest peer ID
      await peerManager.connectToHost(session.hostPeerId, session.guestPeerId);
      
    } catch (err) {
      error = `Failed to reconnect: ${err}`;
      isReconnecting = false;
      console.error(err);
    }
  }

  function handleDecline() {
    clearSession();
    onDismiss();
  }

  function handlePlayCard(cardId: string, targetPlayerId?: string, targetCardGuess?: string) {
    if (!peerManager) return;
    
    const payload: PlayerActionPayload = {
      cardId,
      targetPlayerId,
      targetCardGuess
    };
    
    const message = createMessage('PLAYER_ACTION', session.guestPeerId, payload);
    peerManager.broadcast(message);
  }

  function handleChancellorReturn(cardsToReturn: string[]) {
    if (!peerManager) return;
    
    const payload: PlayerActionPayload = {
      cardId: 'chancellor-return',
      cardsToReturn
    };
    
    const message = createMessage('PLAYER_ACTION', session.guestPeerId, payload);
    peerManager.broadcast(message);
  }

  function handleSendChat(text: string) {
    if (!peerManager) return;
    
    const payload: ChatMessagePayload = {
      senderName: session.nickname,
      text,
      timestamp: Date.now()
    };
    
    const message = createMessage('CHAT_MESSAGE', session.guestPeerId, payload);
    peerManager.broadcast(message);
    
    // Add to local chat
    addChatMessage({
      id: uuidv4(),
      senderId: session.guestPeerId,
      senderName: session.nickname,
      text,
      timestamp: Date.now()
    });
  }
</script>

{#if inGame && $gameState}
  <GameScreen 
    state={$gameState} 
    localPlayerId={session.guestPeerId}
    onPlayCard={handlePlayCard}
    onChancellorReturn={handleChancellorReturn}
    onSendChat={handleSendChat}
  />
{:else}
  <div class="rejoin-overlay">
    <div class="rejoin-modal">
      <h2>🔄 Rejoin Game?</h2>
      
      <div class="session-info">
        <p>You were playing as <strong>{session.nickname}</strong></p>
        <p class="timestamp">Left {getSessionAge(session)}</p>
      </div>

      {#if error}
        <div class="error">{error}</div>
      {/if}

      <div class="actions">
        <button 
          class="rejoin-btn" 
          onclick={handleRejoin}
          disabled={isReconnecting}
        >
          {#if isReconnecting}
            Reconnecting...
          {:else}
            Rejoin Game
          {/if}
        </button>
        
        <button 
          class="decline-btn" 
          onclick={handleDecline}
          disabled={isReconnecting}
        >
          Start Fresh
        </button>
      </div>

      {#if isReconnecting}
        <p class="status">Connecting to host...</p>
      {/if}
    </div>
  </div>
{/if}

<style>
  .rejoin-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .rejoin-modal {
    background: #1e1e2e;
    border-radius: 16px;
    padding: 2rem;
    max-width: 400px;
    width: 90%;
    text-align: center;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  h2 {
    margin: 0 0 1.5rem;
    color: #fff;
    font-size: 1.5rem;
  }

  .session-info {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    padding: 1rem;
    margin-bottom: 1.5rem;
  }

  .session-info p {
    margin: 0.25rem 0;
    color: #ccc;
  }

  .session-info strong {
    color: #4ecdc4;
  }

  .timestamp {
    font-size: 0.875rem;
    opacity: 0.7;
  }

  .error {
    background: rgba(231, 76, 60, 0.2);
    border: 1px solid rgba(231, 76, 60, 0.5);
    border-radius: 8px;
    padding: 0.75rem;
    margin-bottom: 1rem;
    color: #e74c3c;
    font-size: 0.875rem;
  }

  .actions {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  button {
    padding: 0.875rem 1.5rem;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    border: none;
  }

  button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .rejoin-btn {
    background: linear-gradient(135deg, #4ecdc4 0%, #44a08d 100%);
    color: #fff;
  }

  .rejoin-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(78, 205, 196, 0.4);
  }

  .decline-btn {
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: #aaa;
  }

  .decline-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.05);
    color: #fff;
  }

  .status {
    margin-top: 1rem;
    color: #4ecdc4;
    font-size: 0.875rem;
  }
</style>
