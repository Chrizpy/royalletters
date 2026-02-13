<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Html5Qrcode } from 'html5-qrcode';
  import { PeerManager } from '../network/peer';
  import { peerId, remotePeerId, connectionState, isHost } from '../stores/network';
  import { gameState, gameStarted, setGameState, revealedCard } from '../stores/game';
  import { createMessage, type NetworkMessage, type PlayerActionPayload, type ChatMessagePayload, type PlayerJoinedPayload } from '../network/messages';
  import GameScreen from './GameScreen.svelte';
  import { addChatMessage } from '../stores/chat';
  import { saveSession, clearSession } from '../stores/session';
  import { v4 as uuidv4 } from 'uuid';

  interface Props {
    autoJoinPeerId?: string | null;
  }
  let { autoJoinPeerId = null }: Props = $props();

  let manualPeerId = $state('');
  let error = $state('');
  let showManualInput = $state(false);
  let isScanning = $state(false);
  let scanner = $state<Html5Qrcode | null>(null);
  let peerManager: PeerManager;
  let localConnectionState = $state('disconnected');
  let cameraPermissionDenied = $state(false);
  let guestPeerId = $state('');
  let hostPeerId = $state('');
  let nickname = $state('');

  // Subscribe to game started state
  let inGame = $derived($gameStarted);

  // Pre-fill the peer ID when arriving via a join link.
  // Uses $effect so it fires reliably even if the prop arrives
  // after the component has mounted.
  $effect(() => {
    if (autoJoinPeerId && !manualPeerId) {
      manualPeerId = autoJoinPeerId;
      showManualInput = true;
    }
  });

  onMount(async () => {
    if (autoJoinPeerId) {
      // Join link flow — skip the camera scanner, manual input
      // is shown via the $effect above
      return;
    }

    try {
      // Try to start camera scanner
      await startScanner();
    } catch (err) {
      console.error('Failed to start scanner:', err);
      cameraPermissionDenied = true;
      showManualInput = true;
    }
  });

  onDestroy(() => {
    if (scanner) {
      scanner.stop().catch(console.error);
    }
    if (peerManager) {
      peerManager.disconnect();
    }
  });

  async function startScanner() {
    try {
      scanner = new Html5Qrcode("qr-reader");
      isScanning = true;
      
      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 }
        },
        onScanSuccess,
        onScanError
      );
    } catch (err) {
      console.error('Camera error:', err);
      throw err;
    }
  }

  function onScanSuccess(decodedText: string) {
    let hostId: string | null = null;

    // Try URL format first (new: ?join=<peerId>)
    try {
      const url = new URL(decodedText);
      const joinParam = url.searchParams.get('join');
      if (joinParam) {
        hostId = joinParam;
      }
    } catch {
      // Not a URL — try legacy JSON format
    }

    // Fallback: legacy JSON format { game, peerId }
    if (!hostId) {
      try {
        const data = JSON.parse(decodedText);
        if (data.game === 'royalletters' && data.peerId) {
          hostId = data.peerId;
        }
      } catch {
        // Not valid JSON either
      }
    }

    if (hostId) {
      // Stop scanner
      if (scanner) {
        scanner.stop().catch(console.error);
      }
      isScanning = false;
      connectToHost(hostId);
    }
  }

  function onScanError(errorMessage: string) {
    // Ignore scan errors (they happen continuously while scanning)
  }

  function handleMessage(message: NetworkMessage) {
    console.log('Guest received message:', message.type);
    
    if (message.type === 'GAME_STATE_SYNC') {
      const payload = message.payload;
      setGameState(payload.state);
    } else if (message.type === 'PRIEST_REVEAL') {
      // Host sent us a private Priest reveal - this guest played Priest
      const payload = message.payload;
      revealedCard.set({
        cardId: payload.cardId,
        playerName: payload.targetPlayerName,
        viewerPlayerId: guestPeerId  // This guest is the viewer
      });
    } else if (message.type === 'CHAT_MESSAGE') {
      // Received chat message - add to local store
      const payload = message.payload;
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

  async function connectToHost(targetHostPeerId: string) {
    try {
      error = '';
      hostPeerId = targetHostPeerId;
      
      // Generate guest peer ID
      const randomSuffix = Math.random().toString(36).substring(2, 6);
      guestPeerId = `guest-${randomSuffix}`;
      
      // Create peer manager
      peerManager = new PeerManager();
      
      // Set up state listener
      peerManager.onStateChange((state) => {
        localConnectionState = state;
        connectionState.set(state);
        
        if (state === 'connected') {
          remotePeerId.set(hostPeerId);
          peerId.set(guestPeerId);
          
          // Save session for reconnection
          saveSession({
            guestPeerId,
            hostPeerId,
            nickname: nickname.trim()
          });
          
          // Send player joined message with nickname
          const playerJoinedPayload: PlayerJoinedPayload = {
            playerId: guestPeerId,
            playerName: nickname.trim()
          };
          const joinMessage = createMessage('PLAYER_JOINED', guestPeerId, playerJoinedPayload);
          peerManager.broadcast(joinMessage);
        }
      });

      // Set up message handler
      peerManager.onMessage((message, conn) => {
        handleMessage(message);
      });
      
      // Connect to host
      await peerManager.connectToHost(hostPeerId, guestPeerId);
      
    } catch (err) {
      error = `Failed to connect: ${err}`;
      console.error(err);
    }
  }

  function handlePlayCard(cardId: string, targetPlayerId?: string, targetCardGuess?: string) {
    // Guest sends action to host
    if (!peerManager) return;
    
    const payload: PlayerActionPayload = {
      cardId,
      targetPlayerId,
      targetCardGuess
    };
    
    const message = createMessage('PLAYER_ACTION', guestPeerId, payload);
    peerManager.broadcast(message);
  }
  
  function handleChancellorReturn(cardsToReturn: string[]) {
    // Guest sends Chancellor return action to host
    if (!peerManager) return;
    
    const payload: PlayerActionPayload = {
      cardId: undefined,
      cardsToReturn
    };
    
    const message = createMessage('PLAYER_ACTION', guestPeerId, payload);
    peerManager.broadcast(message);
  }

  function handleRevengeGuess(targetCardGuess: string) {
    // Guest sends revenge guess action to host
    if (!peerManager) return;
    
    const payload: PlayerActionPayload = {
      cardId: undefined,
      targetCardGuess,
      isRevengeGuess: true
    };
    
    const message = createMessage('PLAYER_ACTION', guestPeerId, payload);
    peerManager.broadcast(message);
  }

  function handleStartRound() {
    // Guest can't start rounds - only host can
    console.log('Only host can start rounds');
  }

  function handleSendChat(text: string) {
    // Create chat message
    const chatMsg = {
      id: uuidv4(),
      senderId: guestPeerId,
      senderName: nickname || 'Guest',
      text,
      timestamp: Date.now()
    };
    
    // Add to local store
    addChatMessage(chatMsg);
    
    // Send to host (who will broadcast to others)
    const payload: ChatMessagePayload = {
      text,
      senderName: nickname || 'Guest',
      timestamp: chatMsg.timestamp
    };
    const message = createMessage('CHAT_MESSAGE', guestPeerId, payload);
    peerManager.broadcast(message);
  }

  function handleManualConnect() {
    if (manualPeerId.trim()) {
      connectToHost(manualPeerId.trim());
    }
  }

  function toggleManualInput() {
    showManualInput = !showManualInput;
    
    if (showManualInput && scanner && isScanning) {
      scanner.stop().catch(console.error);
      isScanning = false;
    } else if (!showManualInput && !isScanning) {
      startScanner().catch(() => {
        cameraPermissionDenied = true;
        showManualInput = true;
      });
    }
  }

  function handleBack() {
    if (scanner) {
      scanner.stop().catch(console.error);
    }
    if (peerManager) {
      peerManager.disconnect();
    }
    isHost.set(null);
  }
</script>

{#if inGame && $gameState}
  <GameScreen 
    localPlayerId={guestPeerId}
    onPlayCard={handlePlayCard}
    onChancellorReturn={handleChancellorReturn}
    onRevengeGuess={handleRevengeGuess}
    onStartRound={handleStartRound}
    onSendChat={handleSendChat}
    isHost={false}
  />
{:else}
  <div class="join-game">
    <div class="join-container">
      <h2>Join Game</h2>
      
      {#if error}
        <div class="error">{error}</div>
      {/if}
      
      {#if localConnectionState === 'connected'}
        <div class="success">
          <div class="success-icon">✓</div>
          <p>Connected successfully!</p>
          <p class="waiting">Waiting for host to start game...</p>
        </div>
      {:else if localConnectionState === 'connecting'}
        <div class="loading">
          <div class="spinner"></div>
          <p>Connecting to host...</p>
        </div>
      {:else}
        <div class="name-section">
          <label for="nickname">Your Nickname:</label>
          <input
            id="nickname"
            type="text"
            bind:value={nickname}
            placeholder="Enter your nickname"
            class="name-input"
          />
        </div>

        {#if !showManualInput && !cameraPermissionDenied}
          <div class="scanner-section">
            <p class="instruction">Point your camera at the host's QR code</p>
            <div id="qr-reader" class="qr-reader"></div>
            <button class="toggle-btn" onclick={toggleManualInput}>
              Enter code manually
            </button>
          </div>
        {:else}
        <div class="manual-section">
          {#if cameraPermissionDenied}
            <div class="info">
              <p>📷 Camera access not available</p>
              <p class="info-detail">Please enter the host's peer ID manually</p>
            </div>
          {/if}
          
          <label for="peer-id">Host Peer ID:</label>
          <input
            id="peer-id"
            type="text"
            bind:value={manualPeerId}
            placeholder="royal-xxxx"
            class="peer-input"
          />
          
          <button 
            class="connect-btn"
            onclick={handleManualConnect}
            disabled={!manualPeerId.trim()}
          >
            Connect
          </button>
          
          {#if !cameraPermissionDenied}
            <button class="toggle-btn" onclick={toggleManualInput}>
              Use camera instead
            </button>
          {/if}
        </div>
      {/if}
    {/if}
    
    <button class="back-btn" onclick={handleBack}>Back</button>
  </div>
</div>
{/if}

<style>
  .join-game {
    display: flex;
    justify-content: center;
    align-items: flex-start;
    height: 100dvh;
    background: 
      radial-gradient(ellipse at top, rgba(139, 0, 0, 0.3) 0%, transparent 50%),
      linear-gradient(135deg, #2c0a0a 0%, #1a0505 50%, #0d0202 100%);
    padding: 1rem;
    box-sizing: border-box;
    overflow-y: auto;
  }

  .join-container {
    background: linear-gradient(135deg, #fdf6e3 0%, #f5e6c8 100%);
    border-radius: 16px;
    padding: 1.5rem;
    max-width: 500px;
    width: 100%;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4), 0 0 30px rgba(212, 166, 74, 0.15);
    margin-top: 1rem;
    margin-bottom: 1rem;
    border: 2px solid #d4a64a;
  }

  h2 {
    text-align: center;
    color: #2c1810;
    margin-bottom: 2rem;
    text-shadow: 1px 1px 0 rgba(255, 255, 255, 0.5);
  }

  .error {
    background: #5c1515;
    color: #ffcccc;
    padding: 1rem;
    border-radius: 8px;
    margin-bottom: 1rem;
    border: 1px solid #8b2020;
  }

  .info {
    background: #faf3e0;
    color: #5c4033;
    padding: 1rem;
    border-radius: 8px;
    margin-bottom: 1rem;
    text-align: center;
    border: 1px solid #c4a574;
  }

  .info-detail {
    font-size: 0.9rem;
    margin-top: 0.5rem;
  }

  .name-section {
    margin-bottom: 1.5rem;
  }

  .name-section label {
    display: block;
    font-weight: 500;
    color: #2c1810;
    margin-bottom: 0.5rem;
  }

  .name-input {
    width: 100%;
    padding: 0.75rem 1rem;
    border: 2px solid #c4a574;
    border-radius: 8px;
    font-size: 1rem;
    font-family: inherit;
    box-sizing: border-box;
    transition: border-color 0.3s ease, box-shadow 0.3s ease;
    background: #fffef9;
    color: #2c1810;
  }

  .name-input:focus {
    outline: none;
    border-color: #d4a64a;
    box-shadow: 0 0 8px rgba(212, 166, 74, 0.4);
  }

  .scanner-section {
    text-align: center;
  }

  .instruction {
    font-size: 1.1rem;
    color: #5c4033;
    margin-bottom: 1rem;
  }

  .qr-reader {
    margin-bottom: 1.5rem;
    border-radius: 12px;
    overflow: hidden;
    border: 3px solid #d4a64a;
  }

  .manual-section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  label {
    font-weight: 500;
    color: #2c1810;
  }

  .peer-input {
    padding: 0.75rem;
    border: 2px solid #c4a574;
    border-radius: 8px;
    font-size: 1rem;
    font-family: monospace;
    background: #fffef9;
    color: #2c1810;
  }

  .peer-input:focus {
    outline: none;
    border-color: #d4a64a;
    box-shadow: 0 0 8px rgba(212, 166, 74, 0.4);
  }

  .connect-btn, .toggle-btn, .back-btn {
    padding: 1rem;
    border: none;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
  }

  .connect-btn {
    background: linear-gradient(135deg, #8b2020 0%, #6b1515 100%);
    color: #fdf6e3;
    border: 2px solid #d4a64a;
  }

  .connect-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(139, 32, 32, 0.4);
    background: linear-gradient(135deg, #a02828 0%, #8b2020 100%);
  }

  .connect-btn:disabled {
    background: #c4a574;
    border-color: #c4a574;
    color: #8b7355;
    cursor: not-allowed;
  }

  .toggle-btn {
    background: #faf3e0;
    color: #5c4033;
    border: 2px solid #c4a574;
  }

  .toggle-btn:hover {
    background: #f5e6c8;
    border-color: #d4a64a;
  }

  .back-btn {
    background: #faf3e0;
    color: #5c4033;
    margin-top: 1rem;
    border: 2px solid #c4a574;
  }

  .back-btn:hover {
    background: #f5e6c8;
    border-color: #d4a64a;
  }

  .success {
    text-align: center;
    padding: 2rem;
  }

  .success-icon {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background: linear-gradient(135deg, #5c4033 0%, #3d2a22 100%);
    color: #d4a64a;
    font-size: 3rem;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 1rem;
    border: 3px solid #d4a64a;
  }

  .waiting {
    color: #8b7355;
    font-style: italic;
    margin-top: 1rem;
  }

  .loading {
    text-align: center;
    padding: 2rem;
  }

  .spinner {
    border: 4px solid #f5e6c8;
    border-top: 4px solid #8b2020;
    border-radius: 50%;
    width: 40px;
    height: 40px;
    animation: spin 1s linear infinite;
    margin: 0 auto 1rem;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
</style>
