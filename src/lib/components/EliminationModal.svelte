<script lang="ts">
  import type { PlayerState } from '../types';
  import { modalTimerRemaining } from '../stores/game';

  export let player: PlayerState | undefined;
  export let onDismiss: () => void;

  // Timer state - driven by host via modalTimerRemaining store
  const TOTAL_TIME = 10;
  $: remainingTime = $modalTimerRemaining ?? TOTAL_TIME;

  let dismissed = false;
  let lastEliminationReason: string | undefined;

  // Reset dismissed state when elimination reason changes (new elimination)
  $: if (player?.eliminationReason !== lastEliminationReason) {
    dismissed = false;
    lastEliminationReason = player?.eliminationReason;
  }

  $: isEliminated = player?.status === 'ELIMINATED';
  $: showModal = isEliminated && player?.eliminationReason && !dismissed;
  
  // Auto-close when timer reaches 0
  $: if (remainingTime <= 0 && showModal) {
    dismiss();
  }

  function dismiss() {
    dismissed = true;
    onDismiss();
  }
</script>

{#if showModal}
  <div class="elimination-overlay" role="dialog" aria-modal="true">
    <div class="elimination-modal">
      <div class="timer-container">
        <div class="timer-ring" style="--progress: {(remainingTime / TOTAL_TIME) * 100}%">
          <span class="timer-text">{remainingTime}</span>
        </div>
      </div>
      <div class="elimination-icon">💀</div>
      <h2 class="elimination-title">You've Been Eliminated!</h2>
      <p class="elimination-reason">{player?.eliminationReason}</p>
      <button class="dismiss-btn" on:click={dismiss}>
        Continue Watching
      </button>
    </div>
  </div>
{/if}

<style>
  .elimination-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(8px);
    z-index: 200;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: overlay-fade 0.3s ease-out;
  }

  @keyframes overlay-fade {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .elimination-modal {
    background: linear-gradient(135deg, #2d1f1f 0%, #1a1a2e 100%);
    border: 2px solid #d63031;
    border-radius: 20px;
    padding: 2rem;
    max-width: 90vw;
    max-height: 90vh;
    text-align: center;
    animation: modal-pop 0.4s ease-out;
    box-shadow: 0 0 40px rgba(214, 48, 49, 0.4);
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
      #d63031 var(--progress),
      rgba(255, 255, 255, 0.2) var(--progress)
    );
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 15px rgba(214, 48, 49, 0.4);
  }

  .timer-ring::before {
    content: '';
    position: absolute;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: linear-gradient(135deg, #2d1f1f 0%, #1a1a2e 100%);
  }

  .timer-text {
    position: relative;
    z-index: 1;
    font-size: 1rem;
    font-weight: 700;
    color: #d63031;
  }

  @keyframes modal-pop {
    0% { 
      transform: scale(0.8);
      opacity: 0;
    }
    50% {
      transform: scale(1.05);
    }
    100% { 
      transform: scale(1);
      opacity: 1;
    }
  }

  .elimination-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
    animation: icon-shake 0.5s ease-in-out;
  }

  @keyframes icon-shake {
    0%, 100% { transform: rotate(0); }
    25% { transform: rotate(-10deg); }
    75% { transform: rotate(10deg); }
  }

  .elimination-title {
    color: #d63031;
    font-size: 1.5rem;
    font-weight: 700;
    margin: 0 0 1rem 0;
  }

  .elimination-reason {
    color: rgba(255, 255, 255, 0.9);
    font-size: 1.1rem;
    margin: 0 0 1.5rem 0;
    line-height: 1.4;
  }

  .dismiss-btn {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 12px;
    padding: 0.75rem 1.5rem;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
  }

  .dismiss-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
  }

  /* Mobile responsive styles */
  @media (max-width: 480px) {
    .elimination-modal {
      padding: 1.5rem;
      margin: 1rem;
    }

    .elimination-icon {
      font-size: 3rem;
    }

    .elimination-title {
      font-size: 1.25rem;
    }

    .elimination-reason {
      font-size: 1rem;
    }
  }
</style>
