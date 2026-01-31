<script lang="ts">
  import { connectionState, peerId, remotePeerId } from '../stores/network';
  
  let showDetails = false;
  
  function toggleDetails() {
    showDetails = !showDetails;
  }
  
  $: statusColor = $connectionState === 'connected' ? '#4caf50' : 
                   $connectionState === 'connecting' ? '#ff9800' : 
                   $connectionState === 'error' ? '#f44336' : '#9e9e9e';
  
  $: statusText = $connectionState === 'connected' ? 'Connected' : 
                  $connectionState === 'connecting' ? 'Connecting...' : 
                  $connectionState === 'error' ? 'Connection Error' : 'Disconnected';
</script>

<div class="connection-status">
  <button class="status-indicator" on:click={toggleDetails}>
    <div class="status-dot" style="background-color: {statusColor}"></div>
    <span class="status-text">{statusText}</span>
  </button>
  
  {#if showDetails}
    <div class="details-popup">
      <div class="details-header">
        <h3>Connection Details</h3>
        <button class="close-btn" on:click={toggleDetails}>×</button>
      </div>
      <div class="details-content">
        <div class="detail-row">
          <span class="detail-label">Status:</span>
          <span class="detail-value" style="color: {statusColor}">{statusText}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Your Peer ID:</span>
          <span class="detail-value mono">{$peerId || 'N/A'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Remote Peer ID:</span>
          <span class="detail-value mono">{$remotePeerId || 'N/A'}</span>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .connection-status {
    position: fixed;
    top: 1rem;
    right: 1rem;
    z-index: 1000;
  }

  .status-indicator {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: white;
    border: 2px solid #ddd;
    border-radius: 20px;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .status-indicator:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  .status-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    animation: pulse 2s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }

  .status-text {
    font-size: 0.9rem;
    font-weight: 500;
    color: #333;
  }

  .details-popup {
    position: absolute;
    top: calc(100% + 0.5rem);
    right: 0;
    background: white;
    border: 2px solid #ddd;
    border-radius: 12px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
    min-width: 300px;
    overflow: hidden;
  }

  .details-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    background: #f5f5f5;
    border-bottom: 1px solid #ddd;
  }

  .details-header h3 {
    margin: 0;
    font-size: 1rem;
    color: #333;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    color: #666;
    cursor: pointer;
    padding: 0;
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: background 0.3s ease;
  }

  .close-btn:hover {
    background: #e0e0e0;
  }

  .details-content {
    padding: 1rem;
  }

  .detail-row {
    display: flex;
    justify-content: space-between;
    padding: 0.5rem 0;
    border-bottom: 1px solid #f0f0f0;
  }

  .detail-row:last-child {
    border-bottom: none;
  }

  .detail-label {
    font-weight: 500;
    color: #666;
  }

  .detail-value {
    color: #333;
  }

  .detail-value.mono {
    font-family: monospace;
    font-size: 0.9rem;
  }
</style>
