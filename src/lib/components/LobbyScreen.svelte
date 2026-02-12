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
      <button class="menu-btn host-btn" onclick={handleHost}>
        <span class="btn-icon">👑</span>
        <span class="btn-text">Host Game</span>
        <span class="btn-description">Create a new game and share QR code</span>
      </button>
      
      <button class="menu-btn join-btn" onclick={handleJoin}>
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
    height: 100dvh;
    background: 
      radial-gradient(ellipse at top, rgba(139, 0, 0, 0.3) 0%, transparent 50%),
      linear-gradient(135deg, #2c0a0a 0%, #1a0505 50%, #0d0202 100%);
    padding: 1rem;
    box-sizing: border-box;
    overflow: hidden;
  }

  .lobby-container {
    text-align: center;
    max-width: 500px;
    width: 100%;
  }

  h1 {
    font-size: 2.5rem;
    color: #d4a64a;
    margin-bottom: 0.5rem;
    text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5), 0 0 20px rgba(212, 166, 74, 0.3);
    font-weight: 700;
    letter-spacing: 0.05em;
  }

  .subtitle {
    font-size: 1rem;
    color: rgba(255, 220, 180, 0.8);
    margin-bottom: 2rem;
    font-style: italic;
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
    padding: 1.5rem;
    background: linear-gradient(135deg, #fdf6e3 0%, #f5e6c8 100%);
    border: 2px solid #d4a64a;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.5);
  }

  .menu-btn:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.4), 0 0 20px rgba(212, 166, 74, 0.3);
    border-color: #e6b84d;
  }

  .btn-icon {
    font-size: 2.5rem;
    margin-bottom: 0.75rem;
  }

  .btn-text {
    font-size: 1.25rem;
    font-weight: 600;
    color: #2c1810;
    margin-bottom: 0.25rem;
  }

  .btn-description {
    font-size: 0.85rem;
    color: #5c4033;
  }

  .host-btn:hover {
    background: linear-gradient(135deg, #d4a64a 0%, #b8860b 100%);
  }

  .host-btn:hover .btn-text,
  .host-btn:hover .btn-description {
    color: #1a0505;
  }

  .join-btn:hover {
    background: linear-gradient(135deg, #8b2020 0%, #6b1515 100%);
  }

  .join-btn:hover .btn-text,
  .join-btn:hover .btn-description {
    color: #fdf6e3;
  }
</style>
