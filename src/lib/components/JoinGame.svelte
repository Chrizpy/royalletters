<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Html5Qrcode } from 'html5-qrcode';
  import { PeerManager } from '../network/peer';
  import { peerId, remotePeerId, connectionState, isHost } from '../stores/network';
  import { v4 as uuidv4 } from 'uuid';

  let manualPeerId = '';
  let error = '';
  let showManualInput = false;
  let isScanning = false;
  let scanner: Html5Qrcode | null = null;
  let peerManager: PeerManager;
  let localConnectionState: string = 'disconnected';
  let cameraPermissionDenied = false;

  onMount(async () => {
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
    try {
      const data = JSON.parse(decodedText);
      if (data.game === 'royalletters' && data.peerId) {
        // Stop scanner
        if (scanner) {
          scanner.stop().catch(console.error);
        }
        isScanning = false;
        
        // Connect to host
        connectToHost(data.peerId);
      }
    } catch (err) {
      console.error('Invalid QR code:', err);
    }
  }

  function onScanError(errorMessage: string) {
    // Ignore scan errors (they happen continuously while scanning)
  }

  async function connectToHost(hostPeerId: string) {
    try {
      error = '';
      
      // Generate guest peer ID
      const randomId = Math.random().toString(36).substring(2, 6);
      const guestPeerId = `guest-${randomId}`;
      
      // Create peer manager
      peerManager = new PeerManager();
      
      // Set up state listener
      peerManager.onStateChange((state) => {
        localConnectionState = state;
        connectionState.set(state);
        
        if (state === 'connected') {
          remotePeerId.set(hostPeerId);
          peerId.set(guestPeerId);
        }
      });
      
      // Connect to host
      await peerManager.connectToHost(hostPeerId, guestPeerId);
      
    } catch (err) {
      error = `Failed to connect: ${err}`;
      console.error(err);
    }
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
      {#if !showManualInput && !cameraPermissionDenied}
        <div class="scanner-section">
          <p class="instruction">Point your camera at the host's QR code</p>
          <div id="qr-reader" class="qr-reader"></div>
          <button class="toggle-btn" on:click={toggleManualInput}>
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
            on:click={handleManualConnect}
            disabled={!manualPeerId.trim()}
          >
            Connect
          </button>
          
          {#if !cameraPermissionDenied}
            <button class="toggle-btn" on:click={toggleManualInput}>
              Use camera instead
            </button>
          {/if}
        </div>
      {/if}
    {/if}
    
    <button class="back-btn" on:click={handleBack}>Back</button>
  </div>
</div>

<style>
  .join-game {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    padding: 2rem;
  }

  .join-container {
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

  .info {
    background: #e3f2fd;
    color: #1976d2;
    padding: 1rem;
    border-radius: 8px;
    margin-bottom: 1rem;
    text-align: center;
  }

  .info-detail {
    font-size: 0.9rem;
    margin-top: 0.5rem;
  }

  .scanner-section {
    text-align: center;
  }

  .instruction {
    font-size: 1.1rem;
    color: #666;
    margin-bottom: 1rem;
  }

  .qr-reader {
    margin-bottom: 1.5rem;
    border-radius: 12px;
    overflow: hidden;
  }

  .manual-section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  label {
    font-weight: 500;
    color: #333;
  }

  .peer-input {
    padding: 0.75rem;
    border: 2px solid #ddd;
    border-radius: 8px;
    font-size: 1rem;
    font-family: monospace;
  }

  .peer-input:focus {
    outline: none;
    border-color: #f5576c;
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
    background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    color: white;
  }

  .connect-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(245, 87, 108, 0.4);
  }

  .connect-btn:disabled {
    background: #ccc;
    cursor: not-allowed;
  }

  .toggle-btn {
    background: #f5f5f5;
    color: #666;
  }

  .toggle-btn:hover {
    background: #e5e5e5;
  }

  .back-btn {
    background: #f5f5f5;
    color: #666;
    margin-top: 1rem;
  }

  .back-btn:hover {
    background: #e5e5e5;
  }

  .success {
    text-align: center;
    padding: 2rem;
  }

  .success-icon {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background: linear-gradient(135deg, #4caf50 0%, #81c784 100%);
    color: white;
    font-size: 3rem;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 1rem;
  }

  .waiting {
    color: #999;
    font-style: italic;
    margin-top: 1rem;
  }

  .loading {
    text-align: center;
    padding: 2rem;
  }

  .spinner {
    border: 4px solid #f3f3f3;
    border-top: 4px solid #f5576c;
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
