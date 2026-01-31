<script lang="ts">
  import { onMount } from 'svelte';
  import QRCode from 'qrcode';
  import { PeerManager } from '../network/peer';
  import { peerId, connectionState, connectedPlayers, isHost } from '../stores/network';
  import { v4 as uuidv4 } from 'uuid';

  let qrCodeDataUrl = '';
  let generatedPeerId = '';
  let peerManager: PeerManager;
  let error = '';
  let localConnectionState: string = 'disconnected';
  let players: Array<{ id: string; name: string }> = [];

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
      
      // Set up connection listener
      peerManager.onConnection((newPeerId) => {
        console.log('New player connected:', newPeerId);
        players = [...players, { id: newPeerId, name: 'Guest Player' }];
        connectedPlayers.update(p => [...p, { 
          id: newPeerId, 
          name: 'Guest Player',
          avatarId: 'default',
          isHost: false
        }]);
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

  function handleStartGame() {
    // TODO: Start game logic
    console.log('Starting game...');
  }

  function handleBack() {
    if (peerManager) {
      peerManager.disconnect();
    }
    isHost.set(null);
  }
</script>

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
      
      <div class="players-section">
        <h3>Players ({players.length + 1}/4)</h3>
        <div class="player-list">
          <div class="player-item host">
            <span class="player-icon">👑</span>
            <span class="player-name">You (Host)</span>
          </div>
          {#each players as player}
            <div class="player-item">
              <span class="player-icon">👤</span>
              <span class="player-name">{player.name}</span>
            </div>
          {/each}
        </div>
        
        {#if players.length === 0}
          <p class="waiting">Waiting for players to join...</p>
        {/if}
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
    {:else}
      <div class="loading">
        <div class="spinner"></div>
        <p>Setting up host...</p>
      </div>
    {/if}
  </div>
</div>

<style>
  .host-lobby {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    padding: 2rem;
  }

  .host-container {
    background: white;
    border-radius: 16px;
    padding: 2rem;
    max-width: 500px;
    width: 100%;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
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
    padding: 1rem;
    background: white;
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
