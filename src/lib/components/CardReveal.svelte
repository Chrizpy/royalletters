<script lang="ts">
  import { getCardDefinition } from '../engine/deck';
  import { modalTimerRemaining, PAUSE_TIMER_SECONDS } from '../stores/game';

  export let cardId: string;
  export let playerName: string;
  export let onDismiss: () => void;

  $: card = getCardDefinition(cardId);
  
  // Timer state - driven by host via modalTimerRemaining store
  $: remainingTime = $modalTimerRemaining ?? PAUSE_TIMER_SECONDS;
  
  // Track if we've already triggered auto-dismiss to prevent multiple calls
  let hasAutoDismissed = false;
  
  // Auto-close when timer reaches 0 (only if we haven't already dismissed)
  $: if (remainingTime <= 0 && !hasAutoDismissed && cardId) {
    hasAutoDismissed = true;
    onDismiss();
  }

  function getCardEmoji(id: string): string {
    const emojis: Record<string, string> = {
      guard: '⚔️',
      priest: '🙏',
      baron: '⚖️',
      handmaid: '🛡️',
      prince: '👑',
      king: '👔',
      countess: '💃',
      princess: '👸',
    };
    return emojis[id] || '🃏';
  }

  function getCardColor(id: string): string {
    const colors: Record<string, string> = {
      guard: '#e74c3c',
      priest: '#3498db',
      baron: '#9b59b6',
      handmaid: '#27ae60',
      prince: '#f39c12',
      king: '#8e44ad',
      countess: '#e91e63',
      princess: '#ff69b4',
    };
    return colors[id] || '#95a5a6';
  }
</script>

<div class="reveal-overlay" role="dialog" aria-modal="true" tabindex="0" on:keydown={(e) => e.key === 'Escape' && onDismiss()}>
  <div class="reveal-modal">
    <div class="timer-container">
      <div class="timer-ring" style="--progress: {(remainingTime / PAUSE_TIMER_SECONDS) * 100}%">
        <span class="timer-text">{remainingTime}</span>
      </div>
    </div>
    <h3>👁️ {playerName}'s Card Revealed!</h3>
    
    {#if card}
      <div class="revealed-card" style="--card-color: {getCardColor(cardId)}">
        <div class="card-value">{card.value}</div>
        <div class="card-emoji">{getCardEmoji(cardId)}</div>
        <div class="card-name">{card.name}</div>
      </div>
      <p class="card-description">{card.description}</p>
    {/if}
    
    <button class="dismiss-btn" on:click={onDismiss}>Got it!</button>
  </div>
</div>

<style>
  .reveal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    animation: fade-in 0.3s ease-out;
  }

  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .reveal-modal {
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    border-radius: 20px;
    padding: 2rem;
    text-align: center;
    max-width: 300px;
    width: 90%;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
    animation: pop-in 0.3s ease-out;
    color: white;
    position: relative;
  }

  .timer-container {
    position: absolute;
    top: -20px;
    right: -20px;
  }

  .timer-ring {
    width: 50px;
    height: 50px;
    border-radius: 50%;
    background: conic-gradient(
      #f39c12 var(--progress),
      rgba(255, 255, 255, 0.2) var(--progress)
    );
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 15px rgba(243, 156, 18, 0.4);
  }

  .timer-ring::before {
    content: '';
    position: absolute;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  }

  .timer-text {
    position: relative;
    z-index: 1;
    font-size: 1rem;
    font-weight: 700;
    color: #f39c12;
  }

  @keyframes pop-in {
    from { transform: scale(0.8); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }

  h3 {
    margin: 0 0 1.5rem 0;
    font-size: 1.3rem;
    color: #f39c12;
  }

  .revealed-card {
    background: linear-gradient(135deg, var(--card-color) 0%, color-mix(in srgb, var(--card-color) 70%, black) 100%);
    border-radius: 15px;
    padding: 1.5rem;
    margin: 0 auto 1rem;
    width: 120px;
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.4);
    animation: reveal-pop 0.5s ease-out 0.2s both;
  }

  @keyframes reveal-pop {
    0% { transform: rotateY(90deg); opacity: 0; }
    100% { transform: rotateY(0deg); opacity: 1; }
  }

  .card-value {
    font-size: 2rem;
    font-weight: bold;
    color: white;
    text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
  }

  .card-emoji {
    font-size: 3rem;
    margin: 0.5rem 0;
  }

  .card-name {
    font-size: 1.1rem;
    font-weight: 600;
    color: white;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .card-description {
    color: #bdc3c7;
    font-size: 0.9rem;
    margin-bottom: 1.5rem;
  }

  .dismiss-btn {
    background: linear-gradient(135deg, #f39c12 0%, #e74c3c 100%);
    color: white;
    border: none;
    padding: 0.75rem 2rem;
    border-radius: 25px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }

  .dismiss-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 15px rgba(243, 156, 18, 0.4);
  }
</style>
