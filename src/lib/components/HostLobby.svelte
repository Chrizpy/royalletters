<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import QRCode from 'qrcode';
  import { PeerManager } from '../network/peer';
  import { peerId, connectionState, connectedPlayers, isHost } from '../stores/network';
  import { gameState, gameStarted, initGame, startRound, applyAction, getEngine, checkIfAITurn, executeAIMove } from '../stores/game';
  import { createMessage, type NetworkMessage, type GameStateSyncPayload, type PlayerActionPayload, type PriestRevealPayload, type PlayerJoinedPayload, type ChatMessagePayload, type ReconnectPayload } from '../network/messages';
  import GameScreen from './GameScreen.svelte';
  import { addChatMessage } from '../stores/chat';
  import { v4 as uuidv4 } from 'uuid';
  import type { Ruleset } from '../types';

  let qrCodeDataUrl = '';
  let generatedPeerId = '';
  let peerManager: PeerManager;
  let error = '';
  let localConnectionState: string = 'disconnected';
  let players: Array<{ id: string; name: string; isAI?: boolean }> = [];
  let hostName = 'Host';
  let selectedRuleset: Ruleset = 'house';
  let aiCounter = 1;  // Counter for AI player names
  let aiMoveDelayMs = 2000;  // Default AI move delay (configurable)
  let aiCount = 0;  // Desired number of AI players (controlled by slider)
  let showAIOptions = false;  // Toggle for AI options visibility
  let tokensToWin: number | null = null;  // null means use default based on player count
  let hasCustomTokens = false;  // Track if user has manually adjusted tokens

  // Default tokens based on player count
  const DEFAULT_TOKENS_MAP: Record<number, number> = {
    2: 6,
    3: 5,
    4: 4,
    5: 3,
    6: 3,
  };

  // Max players depends on ruleset: classic = 4, 2019/house = 6
  $: maxPlayers = (selectedRuleset === '2019' || selectedRuleset === 'house') ? 6 : 4;
  
  // Total players including host
  $: totalPlayers = players.length + 1;
  
  // Default tokens for current player count
  $: defaultTokens = DEFAULT_TOKENS_MAP[totalPlayers] || 4;
  
  // Update tokensToWin when player count changes (only if user hasn't customized)
  $: if (!hasCustomTokens) {
    tokensToWin = defaultTokens;
  }
  
  // Effective tokens value (use custom or default)
  $: effectiveTokens = tokensToWin ?? defaultTokens;
  
  // Maximum AI players that can be added
  $: maxAI = maxPlayers - 1;  // Leave room for at least the host
  
  // Count of human players (non-AI, excluding host)
  $: humanPlayerCount = players.filter(p => !p.isAI).length;
  
  // Available slots for AI after accounting for humans
  $: availableAISlots = maxPlayers - 1 - humanPlayerCount;

  // Subscribe to game started state
  $: inGame = $gameStarted;

  onMount(async () => {
    try {
      // Generate unique peer ID
      const randomSuffix = Math.random().toString(36).substring(2, 6);
      generatedPeerId = `royal-${randomSuffix}`;
      
      // Create peer manager
      peerManager = new PeerManager();
      
      // Set up state listener
      peerManager.onStateChange((state) => {
        localConnectionState = state;
        connectionState.set(state);
      });
      
      // Set up connection listener - just log the connection, player info comes via PLAYER_JOINED message
      peerManager.onConnection((newPeerId) => {
        console.log('New player connected:', newPeerId);
        // Player will be added when we receive their PLAYER_JOINED message with nickname
      });

      // Set up message handler for player actions
      peerManager.onMessage((message, conn) => {
        handleMessage(message, conn.peer);
      });
      
      // Create host
      await peerManager.createHost(generatedPeerId);
      peerId.set(generatedPeerId);
      
      // Generate QR code
      const qrData = JSON.stringify({
        peerId: generatedPeerId,
        game: 'royalletters',
        version: '1.0'
      });
      
      qrCodeDataUrl = await QRCode.toDataURL(qrData, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      });
    } catch (err) {
      error = `Failed to create host: ${err}`;
      console.error(err);
    }
  });

  onDestroy(() => {
    if (peerManager) {
      peerManager.disconnect();
    }
  });

  function handleMessage(message: NetworkMessage, fromPeerId: string) {
    console.log('Host received message:', message.type, 'from:', fromPeerId);
    
    if (message.type === 'PLAYER_JOINED') {
      const payload = message.payload as PlayerJoinedPayload;
      // Use guest's chosen nickname, or fallback to "Player N" where N = host (1) + existing players + 1
      const playerName = payload.playerName || `Player ${players.length + 2}`;
      
      // Check if player is already in the list (avoid duplicates)
      if (!players.some(p => p.id === fromPeerId)) {
        players = [...players, { id: fromPeerId, name: playerName }];
        connectedPlayers.update(p => [...p, { 
          id: fromPeerId, 
          name: playerName,
          avatarId: 'default',
          isHost: false
        }]);
      }
    } else if (message.type === 'PLAYER_ACTION') {
      const payload = message.payload as PlayerActionPayload;
      
      // Check if this is a revenge guess action
      if (payload.isRevengeGuess) {
        applyAction({
          type: 'REVENGE_GUESS',
          playerId: message.senderId,
          targetCardGuess: payload.targetCardGuess
        });
      }
      // Check if this is a Chancellor return action
      else if (payload.cardsToReturn) {
        applyAction({
          type: 'CHANCELLOR_RETURN',
          playerId: message.senderId,
          cardsToReturn: payload.cardsToReturn
        });
      } else {
        const result = applyAction({
          type: 'PLAY_CARD',
          playerId: message.senderId,
          cardId: payload.cardId,
          targetPlayerId: payload.targetPlayerId,
          targetCardGuess: payload.targetCardGuess
        });
        
        // If a Priest reveal happened, send it privately to the player who played Priest
        if (result?.revealedCard && peerManager) {
          const engine = getEngine();
          const targetPlayer = engine?.getState().players.find(p => p.id === payload.targetPlayerId);
          const priestRevealPayload: PriestRevealPayload = {
            cardId: result.revealedCard,
            targetPlayerName: targetPlayer?.name || 'Unknown'
          };
          const priestRevealMessage = createMessage('PRIEST_REVEAL', generatedPeerId, priestRevealPayload);
          peerManager.sendTo(fromPeerId, priestRevealMessage);
        }
      }
      
      // Broadcast updated state to all clients
      broadcastGameState();
      
      // Check if next turn is AI
      scheduleAIMove();
    } else if (message.type === 'CHAT_MESSAGE') {
      // Received chat message from a guest - add to local store and broadcast to all except sender
      const payload = message.payload as ChatMessagePayload;
      const chatMsg = {
        id: uuidv4(),
        senderId: message.senderId,
        senderName: payload.senderName,
        text: payload.text,
        timestamp: payload.timestamp
      };
      addChatMessage(chatMsg);
      
      // Broadcast to all other clients except the original sender
      peerManager.broadcastExcept(message, fromPeerId);
    } else if (message.type === 'RECONNECT') {
      // Handle player reconnecting to existing game
      const payload = message.payload as ReconnectPayload;
      console.log('Player reconnecting:', payload.playerName, 'with ID:', payload.playerId);
      
      // Check if this player exists in the game
      const engine = getEngine();
      const state = engine?.getState();
      const existingPlayer = state?.players.find(p => p.id === payload.playerId);
      
      if (existingPlayer && $gameStarted) {
        console.log('Reconnecting existing player:', existingPlayer.name);
        
        // Update local players array (might have been removed on disconnect)
        if (!players.some(p => p.id === payload.playerId)) {
          players = [...players, { id: payload.playerId, name: existingPlayer.name }];
        }
        
        // Send current game state to reconnected player
        if (peerManager && state) {
          const syncMessage = createMessage('GAME_STATE_SYNC', generatedPeerId, { state } as GameStateSyncPayload);
          peerManager.sendTo(fromPeerId, syncMessage);
        }
        
        // Resume AI play if it's an AI's turn
        scheduleAIMove();
      } else {
        console.warn('Unknown player trying to reconnect or game not started:', payload.playerId);
        // Treat as new player if game not started yet
        if (!$gameStarted && !players.some(p => p.id === fromPeerId)) {
          players = [...players, { id: fromPeerId, name: payload.playerName }];
        }
      }
    } else if (message.type === 'REQUEST_STATE_SYNC') {
      // Handle explicit request for state sync
      console.log('State sync requested by:', fromPeerId);
      
      const engine = getEngine();
      const state = engine?.getState();
      
      if (peerManager && state && $gameStarted) {
        const syncMessage = createMessage('GAME_STATE_SYNC', generatedPeerId, { state } as GameStateSyncPayload);
        peerManager.sendTo(fromPeerId, syncMessage);
      }
    }
  }

  function handleStartGame() {
    console.log('Starting game...');
    
    // Build player list with host first
    const allPlayers = [
      { id: generatedPeerId, name: hostName, isHost: true, isAI: false },
      ...players.map(p => ({ id: p.id, name: p.name, isHost: false, isAI: p.isAI || false }))
    ];
    
    // Initialize and start the game with selected ruleset and tokens to win
    initGame(allPlayers, selectedRuleset, effectiveTokens);
    startRound();
    
    // Broadcast state to all connected players
    broadcastGameState();
    
    // Check if it's an AI's turn after starting
    scheduleAIMove();
  }

  function broadcastGameState() {
    const engine = getEngine();
    if (!engine || !peerManager) return;
    
    const state = engine.getState();
    const payload: GameStateSyncPayload = { state };
    const message = createMessage('GAME_STATE_SYNC', generatedPeerId, payload);
    
    peerManager.broadcast(message);
  }
  
  /**
   * Schedule AI move if it's an AI player's turn
   * Uses setTimeout to allow state updates to propagate and create natural pacing
   */
  function scheduleAIMove() {
    setTimeout(() => {
      processAITurn();
    }, aiMoveDelayMs);
  }
  
  /**
   * Process AI turn if it's an AI player's turn
   */
  function processAITurn() {
    if (!checkIfAITurn()) return;
    
    const result = executeAIMove();
    if (result) {
      // Broadcast updated state
      broadcastGameState();
      
      // Check if it's still an AI's turn (could be another AI)
      scheduleAIMove();
    }
  }

  function handlePlayCard(cardId: string, targetPlayerId?: string, targetCardGuess?: string) {
    // Host applies actions directly
    applyAction({
      type: 'PLAY_CARD',
      playerId: generatedPeerId,
      cardId,
      targetPlayerId,
      targetCardGuess
    });
    
    // Broadcast updated state to all clients
    broadcastGameState();
    
    // Check if next turn is AI
    scheduleAIMove();
  }
  
  function handleChancellorReturn(cardsToReturn: string[]) {
    // Host applies Chancellor return action directly
    applyAction({
      type: 'CHANCELLOR_RETURN',
      playerId: generatedPeerId,
      cardsToReturn
    });
    
    // Broadcast updated state to all clients
    broadcastGameState();
    
    // Check if next turn is AI
    scheduleAIMove();
  }

  function handleRevengeGuess(targetCardGuess: string) {
    // Host applies revenge guess action directly
    applyAction({
      type: 'REVENGE_GUESS',
      playerId: generatedPeerId,
      targetCardGuess
    });
    
    // Broadcast updated state to all clients
    broadcastGameState();
    
    // Check if next turn is AI
    scheduleAIMove();
  }

  function handleStartRound() {
    startRound();
    broadcastGameState();
    
    // Check if first turn is AI
    scheduleAIMove();
  }

  function handlePlayAgain() {
    // Re-initialize the game with the same players and ruleset
    const allPlayers = [
      { id: generatedPeerId, name: hostName, isHost: true, isAI: false },
      ...players.map(p => ({ id: p.id, name: p.name, isHost: false, isAI: p.isAI || false }))
    ];
    
    initGame(allPlayers, selectedRuleset, effectiveTokens);
    startRound();
    broadcastGameState();
    
    // Check if first turn is AI
    scheduleAIMove();
  }
  
  // Sync AI players with slider value
  function syncAIPlayers(targetCount: number) {
    const currentAIs = players.filter(p => p.isAI);
    const currentAICount = currentAIs.length;
    
    if (targetCount > currentAICount) {
      // Add more AI players
      const toAdd = targetCount - currentAICount;
      const newAIs = [];
      for (let i = 0; i < toAdd; i++) {
        newAIs.push({
          id: `ai-${uuidv4().substring(0, 8)}`,
          name: `AI ${aiCounter++}`,
          isAI: true
        });
      }
      players = [...players, ...newAIs];
    } else if (targetCount < currentAICount) {
      // Remove AI players (from the end)
      const toRemove = currentAICount - targetCount;
      const aiIds = currentAIs.slice(-toRemove).map(p => p.id);
      players = players.filter(p => !aiIds.includes(p.id));
    }
  }
  
  // Handle AI count slider change
  function handleAICountChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const newCount = Math.min(parseInt(target.value, 10), availableAISlots);
    aiCount = newCount;
    syncAIPlayers(newCount);
  }
  
  // Clamp aiCount when human players join (reduces available AI slots)
  $: if (aiCount > availableAISlots) {
    aiCount = availableAISlots;
    syncAIPlayers(aiCount);
  }
  
  // Handle AI options toggle - add 1 AI when enabled, remove all when disabled
  $: if (showAIOptions && aiCount === 0) {
    aiCount = 1;
    syncAIPlayers(1);
  } else if (!showAIOptions && aiCount > 0) {
    aiCount = 0;
    syncAIPlayers(0);
  }

  function handleSendChat(text: string) {
    // Create chat message
    const chatMsg = {
      id: uuidv4(),
      senderId: generatedPeerId,
      senderName: hostName,
      text,
      timestamp: Date.now()
    };
    
    // Add to local store
    addChatMessage(chatMsg);
    
    // Broadcast to all clients
    const payload: ChatMessagePayload = {
      text,
      senderName: hostName,
      timestamp: chatMsg.timestamp
    };
    const message = createMessage('CHAT_MESSAGE', generatedPeerId, payload);
    peerManager.broadcast(message);
  }

  function handleBack() {
    if (peerManager) {
      peerManager.disconnect();
    }
    isHost.set(null);
  }
</script>

{#if inGame && $gameState}
  <GameScreen 
    localPlayerId={generatedPeerId}
    onPlayCard={handlePlayCard}
    onChancellorReturn={handleChancellorReturn}
    onRevengeGuess={handleRevengeGuess}
    onStartRound={handleStartRound}
    onPlayAgain={handlePlayAgain}
    onSendChat={handleSendChat}
    isHost={true}
  />
{:else}
  <div class="host-lobby">
    <div class="host-container">
      <h2>Host Game</h2>
      
      {#if error}
        <div class="error">{error}</div>
      {/if}
      
      {#if localConnectionState === 'connected' && qrCodeDataUrl}
        <div class="qr-section">
          <p class="instruction">Scan this QR code to join:</p>
          <div class="qr-code">
            <img src={qrCodeDataUrl} alt="QR Code" />
          </div>
          
          <div class="peer-id-section">
            <p class="peer-id-label">Or enter this code manually:</p>
            <div class="peer-id-display">{generatedPeerId}</div>
          </div>
        </div>

        <div class="ruleset-section">
          <label for="ruleset">Game Edition:</label>
          <select 
            id="ruleset" 
            bind:value={selectedRuleset}
            class="ruleset-select"
          >
            <option value="classic">Classic (16 cards)</option>
            <option value="2019">2019 Edition (21 cards)</option>
            <option value="house">House Rules (21 cards)</option>
          </select>
          <p class="ruleset-hint">
            {#if selectedRuleset === '2019'}
              Includes Spy and Chancellor cards with new mechanics!
            {:else if selectedRuleset === 'house'}
              2019 Edition with custom rules: King swaps with burned card when no targets!
            {:else}
              The original Love Letter experience.
            {/if}
          </p>
        </div>

        <div class="tokens-section">
          <label for="tokens-to-win">Tokens to Win:</label>
          <div class="tokens-controls">
            <input 
              id="tokens-to-win" 
              type="range" 
              min="1" 
              max="10" 
              step="1"
              bind:value={tokensToWin}
              on:input={() => hasCustomTokens = true}
              class="tokens-slider"
            />
            <span class="tokens-value">{effectiveTokens}</span>
          </div>
          <p class="tokens-hint">
            {#if effectiveTokens === defaultTokens}
              Default for {totalPlayers} players
            {:else if effectiveTokens < defaultTokens}
              Shorter game
            {:else}
              Longer game
            {/if}
            <button 
              class="reset-tokens-btn" 
              on:click={() => { hasCustomTokens = false; tokensToWin = defaultTokens; }}
              disabled={!hasCustomTokens}
            >
              Reset
            </button>
          </p>
        </div>
        
        <div class="ai-options-section">
          <label class="ai-toggle">
            <input 
              type="checkbox" 
              bind:checked={showAIOptions}
            />
            <span class="ai-toggle-label">🤖 Add AI Players</span>
          </label>
          
          {#if showAIOptions}
            <div class="ai-options-content">
              <div class="ai-option">
                <label for="ai-count">Number of AI:</label>
                <div class="ai-slider-controls">
                  <input
                    type="range"
                    id="ai-count"
                    class="ai-count-slider"
                    min="1"
                    max={availableAISlots}
                    bind:value={aiCount}
                    on:input={handleAICountChange}
                  />
                  <span class="ai-count-value">{aiCount}</span>
                </div>
              </div>
              
              <div class="ai-option">
                <label for="ai-delay">AI Speed:</label>
                <div class="ai-slider-controls">
                  <input 
                    id="ai-delay" 
                    type="range" 
                    min="500" 
                    max="5000" 
                    step="250"
                    bind:value={aiMoveDelayMs}
                    class="ai-delay-slider"
                  />
                  <span class="ai-delay-value">{(aiMoveDelayMs / 1000).toFixed(1)}s</span>
                </div>
              </div>
              
              <p class="ai-options-hint">
                {#if aiMoveDelayMs <= 1000}
                  ⚡ Fast pace
                {:else if aiMoveDelayMs <= 2500}
                  🎯 Normal pace
                {:else}
                  🐢 Slow pace
                {/if}
              </p>
            </div>
          {/if}
        </div>

        <div class="name-section">
          <label for="host-name">Your Name:</label>
          <input 
            id="host-name" 
            type="text" 
            bind:value={hostName} 
            placeholder="Enter your name"
            class="name-input"
          />
        </div>
        
        <div class="button-group">
          <button 
            class="start-btn" 
            on:click={handleStartGame}
            disabled={players.length === 0}
          >
            Start Game
          </button>
          <button class="back-btn" on:click={handleBack}>Cancel</button>
        </div>
        
        <div class="players-section">
          <h3>Players ({players.length + 1}/{maxPlayers})</h3>
          <div class="player-list">
            <div class="player-item host">
              <span class="player-icon">👑</span>
              <span class="player-name">{hostName} (You)</span>
            </div>
            {#each players as player}
              <div class="player-item" class:ai={player.isAI}>
                <span class="player-icon">{player.isAI ? '🤖' : '👤'}</span>
                <span class="player-name">{player.name}</span>
              </div>
            {/each}
          </div>
          
          {#if players.length === 0}
            <p class="waiting">Waiting for players to join or add AI opponents...</p>
          {/if}
        </div>
      {:else}
        <div class="loading">
          <div class="spinner"></div>
          <p>Setting up host...</p>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .host-lobby {
    display: flex;
    justify-content: center;
    align-items: flex-start;
    height: 100dvh;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    padding: 1rem;
    box-sizing: border-box;
    overflow-y: auto;
  }

  .host-container {
    background: white;
    border-radius: 16px;
    padding: 1.5rem;
    max-width: 500px;
    width: 100%;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
    margin-top: 1rem;
    margin-bottom: 1rem;
  }

  h2 {
    text-align: center;
    color: #333;
    margin-bottom: 2rem;
  }

  .error {
    background: #fee;
    color: #c33;
    padding: 1rem;
    border-radius: 8px;
    margin-bottom: 1rem;
  }

  .name-section {
    margin-bottom: 1.5rem;
  }

  .name-section label {
    display: block;
    font-weight: 500;
    color: #000;
    margin-bottom: 0.5rem;
  }

  .name-input {
    width: 100%;
    padding: 0.75rem 1rem;
    border: 2px solid #ddd;
    border-radius: 8px;
    font-size: 1rem;
    font-family: inherit;
    box-sizing: border-box;
    transition: border-color 0.3s ease;
    background: white;
    color: #333;
  }

  .name-input:focus {
    outline: none;
    border-color: #667eea;
  }

  .ruleset-section {
    margin-bottom: 1.5rem;
  }

  .ruleset-section label {
    display: block;
    font-weight: 500;
    color: #000;
    margin-bottom: 0.5rem;
  }

  .ruleset-select {
    width: 100%;
    padding: 0.75rem 1rem;
    border: 2px solid #ddd;
    border-radius: 8px;
    font-size: 1rem;
    font-family: inherit;
    box-sizing: border-box;
    transition: border-color 0.3s ease;
    background: white;
    cursor: pointer;
    color: #333;
  }

  .ruleset-select:focus {
    outline: none;
    border-color: #667eea;
  }

  .ruleset-hint {
    margin-top: 0.5rem;
    font-size: 0.85rem;
    color: #666;
    font-style: italic;
  }

  .ai-options-section {
    margin-bottom: 1.5rem;
    border: 2px solid #e5e7eb;
    border-radius: 8px;
    overflow: hidden;
  }

  .ai-toggle {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: #f9fafb;
    cursor: pointer;
    user-select: none;
  }

  .ai-toggle input[type="checkbox"] {
    width: 18px;
    height: 18px;
    accent-color: #22c55e;
    cursor: pointer;
  }

  .ai-toggle-label {
    font-weight: 500;
    color: #374151;
  }

  .ai-options-content {
    padding: 1rem;
    background: #f0fdf4;
    border-top: 1px solid #bbf7d0;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .ai-option {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .ai-option label {
    font-weight: 500;
    color: #166534;
    font-size: 0.9rem;
  }

  .ai-slider-controls {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .ai-options-hint {
    font-size: 0.85rem;
    color: #166534;
    margin: 0;
    text-align: center;
  }

  .ai-count-slider {
    flex: 1;
    height: 8px;
    border-radius: 4px;
    background: #bbf7d0;
    outline: none;
    -webkit-appearance: none;
    appearance: none;
  }

  .ai-count-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: linear-gradient(135deg, #4ade80 0%, #22c55e 100%);
    cursor: pointer;
    border: 2px solid white;
    box-shadow: 0 2px 6px rgba(34, 197, 94, 0.4);
  }

  .ai-count-slider::-moz-range-thumb {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: linear-gradient(135deg, #4ade80 0%, #22c55e 100%);
    cursor: pointer;
    border: 2px solid white;
    box-shadow: 0 2px 6px rgba(34, 197, 94, 0.4);
  }

  .ai-count-value {
    font-weight: 600;
    color: #166534;
    min-width: 24px;
    text-align: center;
  }

  .ai-delay-slider {
    flex: 1;
    height: 8px;
    border-radius: 4px;
    background: #bbf7d0;
    outline: none;
    -webkit-appearance: none;
    appearance: none;
  }

  .ai-delay-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: linear-gradient(135deg, #4ade80 0%, #22c55e 100%);
    cursor: pointer;
    border: 2px solid white;
    box-shadow: 0 2px 6px rgba(34, 197, 94, 0.4);
  }

  .ai-delay-slider::-moz-range-thumb {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: linear-gradient(135deg, #4ade80 0%, #22c55e 100%);
    cursor: pointer;
    border: 2px solid white;
    box-shadow: 0 2px 6px rgba(34, 197, 94, 0.4);
  }

  .ai-delay-value {
    font-weight: 600;
    color: #166534;
    min-width: 40px;
    text-align: right;
  }

  .tokens-section {
    margin-bottom: 1.5rem;
  }

  .tokens-section label {
    display: block;
    font-weight: 500;
    color: #000;
    margin-bottom: 0.5rem;
  }

  .tokens-controls {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .tokens-slider {
    flex: 1;
    height: 8px;
    border-radius: 4px;
    background: #ddd;
    outline: none;
    -webkit-appearance: none;
    appearance: none;
  }

  .tokens-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: linear-gradient(135deg, #f6d365 0%, #fda085 100%);
    cursor: pointer;
    border: none;
    box-shadow: 0 2px 6px rgba(253, 160, 133, 0.4);
  }

  .tokens-slider::-moz-range-thumb {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: linear-gradient(135deg, #f6d365 0%, #fda085 100%);
    cursor: pointer;
    border: none;
    box-shadow: 0 2px 6px rgba(253, 160, 133, 0.4);
  }

  .tokens-value {
    font-weight: 600;
    color: #fda085;
    min-width: 24px;
    text-align: right;
  }

  .tokens-hint {
    margin-top: 0.5rem;
    font-size: 0.85rem;
    color: #666;
    font-style: italic;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .reset-tokens-btn {
    background: none;
    border: 1px solid #ccc;
    border-radius: 4px;
    padding: 0.2rem 0.5rem;
    font-size: 0.75rem;
    color: #666;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .reset-tokens-btn:hover:not(:disabled) {
    border-color: #667eea;
    color: #667eea;
  }

  .reset-tokens-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .qr-section {
    text-align: center;
    margin-bottom: 2rem;
  }

  .instruction {
    font-size: 1.1rem;
    color: #666;
    margin-bottom: 1rem;
  }

  .qr-code {
    display: flex;
    justify-content: center;
    margin-bottom: 1.5rem;
  }

  .qr-code img {
    border: 4px solid #667eea;
    border-radius: 12px;
    padding: 0.5rem;
    background: white;
    max-width: 200px;
    height: auto;
  }

  .peer-id-section {
    margin-top: 1.5rem;
  }

  .peer-id-label {
    font-size: 0.9rem;
    color: #666;
    margin-bottom: 0.5rem;
  }

  .peer-id-display {
    font-family: monospace;
    font-size: 1.2rem;
    font-weight: 600;
    color: #667eea;
    background: #f5f5f5;
    padding: 0.75rem;
    border-radius: 8px;
    border: 2px solid #667eea;
  }

  .players-section {
    margin-bottom: 2rem;
  }

  .players-section h3 {
    color: #333;
    margin-bottom: 1rem;
  }

  .player-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    max-height: 180px;
    overflow-y: auto;
    padding-right: 0.25rem;
  }

  .player-list::-webkit-scrollbar {
    width: 6px;
  }

  .player-list::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 3px;
  }

  .player-list::-webkit-scrollbar-thumb {
    background: #c4c4c4;
    border-radius: 3px;
  }

  .player-list::-webkit-scrollbar-thumb:hover {
    background: #a8a8a8;
  }

  .player-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    background: #f5f5f5;
    border-radius: 8px;
  }

  .player-item.host {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
  }

  .player-icon {
    font-size: 1.5rem;
  }

  .player-name {
    font-weight: 500;
    flex: 1;
  }
  
  .player-item.ai {
    background: linear-gradient(135deg, #4ade80 0%, #22c55e 100%);
    color: white;
  }

  .waiting {
    text-align: center;
    color: #999;
    font-style: italic;
    margin-top: 1rem;
  }

  .button-group {
    display: flex;
    gap: 1rem;
  }

  .start-btn, .back-btn {
    flex: 1;
    padding: 1rem;
    border: none;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
  }

  .start-btn {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
  }

  .start-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  }

  .start-btn:disabled {
    background: #ccc;
    cursor: not-allowed;
  }

  .back-btn {
    background: #f5f5f5;
    color: #666;
  }

  .back-btn:hover {
    background: #e5e5e5;
  }

  .loading {
    text-align: center;
    padding: 2rem;
  }

  .spinner {
    border: 4px solid #f3f3f3;
    border-top: 4px solid #667eea;
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
