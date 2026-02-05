<script lang="ts">
  export let conflictingCard: 'king' | 'prince';
  export let onDismiss: () => void;

  $: cardName = conflictingCard === 'king' ? 'King' : 'Prince';
  $: cardEmoji = conflictingCard === 'king' ? '👑' : '🤴';
</script>

<div class="countess-overlay" role="dialog" aria-modal="true">
  <div class="countess-modal">
    <div class="countess-icon">👸</div>
    <h2 class="countess-title">Countess Must Be Played!</h2>
    <p class="countess-reason">
      You're holding the <strong>Countess</strong> along with the <strong>{cardEmoji} {cardName}</strong>.
    </p>
    <p class="countess-rule">
      According to the rules, when you have the Countess together with the King or Prince, 
      you <em>must</em> play the Countess.
    </p>
    <button class="dismiss-btn" on:click={onDismiss}>
      Got it!
    </button>
  </div>
</div>

<style>
  .countess-overlay {
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

  .countess-modal {
    background: linear-gradient(135deg, #2d1f3f 0%, #1a1a2e 100%);
    border: 2px solid #a855f7;
    border-radius: 20px;
    padding: 2rem;
    max-width: 90vw;
    max-height: 90vh;
    text-align: center;
    animation: modal-pop 0.4s ease-out;
    box-shadow: 0 0 40px rgba(168, 85, 247, 0.4);
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

  .countess-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
    animation: icon-bounce 0.6s ease-out;
  }

  @keyframes icon-bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-10px); }
  }

  .countess-title {
    color: #a855f7;
    font-size: 1.5rem;
    font-weight: 700;
    margin: 0 0 1rem 0;
  }

  .countess-reason {
    color: rgba(255, 255, 255, 0.9);
    font-size: 1.1rem;
    margin: 0 0 0.75rem 0;
    line-height: 1.4;
  }

  .countess-rule {
    color: rgba(255, 255, 255, 0.7);
    font-size: 0.95rem;
    margin: 0 0 1.5rem 0;
    line-height: 1.5;
    font-style: italic;
  }

  .dismiss-btn {
    background: linear-gradient(135deg, #a855f7 0%, #7c3aed 100%);
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
    box-shadow: 0 4px 15px rgba(168, 85, 247, 0.4);
  }

  /* Mobile responsive styles */
  @media (max-width: 480px) {
    .countess-modal {
      padding: 1.5rem;
      margin: 1rem;
    }

    .countess-icon {
      font-size: 3rem;
    }

    .countess-title {
      font-size: 1.25rem;
    }

    .countess-reason {
      font-size: 1rem;
    }

    .countess-rule {
      font-size: 0.9rem;
    }
  }
</style>
