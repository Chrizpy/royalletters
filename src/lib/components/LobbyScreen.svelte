<script lang="ts">
  import { isHost } from '../stores/network';

  function handleHost() {
    isHost.set(true);
  }

  function handleJoin() {
    isHost.set(false);
  }
</script>

<div class="lobby-screen">
  <div class="lobby-container">
    <h1>Royal Letters</h1>
    <p class="subtitle">A Game of Risk, Deduction, and Luck</p>
    
    <div class="menu-buttons">
      <button class="menu-btn host-btn" on:click={handleHost}>
        <span class="btn-icon">👑</span>
        <span class="btn-text">Host Game</span>
        <span class="btn-description">Create a new game and share QR code</span>
      </button>
      
      <button class="menu-btn join-btn" on:click={handleJoin}>
        <span class="btn-icon">📱</span>
        <span class="btn-text">Join Game</span>
        <span class="btn-description">Scan QR code to join</span>
      </button>
    </div>
  </div>
</div>

<style>
  .lobby-screen {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    padding: 2rem;
  }

  .lobby-container {
    text-align: center;
    max-width: 500px;
    width: 100%;
  }

  h1 {
    font-size: 3rem;
    color: white;
    margin-bottom: 0.5rem;
    text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
  }

  .subtitle {
    font-size: 1.1rem;
    color: rgba(255, 255, 255, 0.9);
    margin-bottom: 3rem;
  }

  .menu-buttons {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .menu-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 2rem;
    background: white;
    border: none;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }

  .menu-btn:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 12px rgba(0, 0, 0, 0.2);
  }

  .btn-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
  }

  .btn-text {
    font-size: 1.5rem;
    font-weight: 600;
    color: #333;
    margin-bottom: 0.5rem;
  }

  .btn-description {
    font-size: 0.9rem;
    color: #666;
  }

  .host-btn:hover {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  }

  .host-btn:hover .btn-text,
  .host-btn:hover .btn-description {
    color: white;
  }

  .join-btn:hover {
    background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  }

  .join-btn:hover .btn-text,
  .join-btn:hover .btn-description {
    color: white;
  }
</style>
