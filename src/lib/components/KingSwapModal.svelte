<script lang="ts">
  import Card from './Card.svelte';
  import { getCardDefinition } from '../engine/deck';

  let {
    actorName,
    cardGiven,
    cardReceived,
    onDismiss,
  }: {
    actorName: string;
    cardGiven: string;
    cardReceived: string;
    onDismiss: () => void;
  } = $props();

  let givenDef = $derived(getCardDefinition(cardGiven));
  let receivedDef = $derived(getCardDefinition(cardReceived));
</script>

<div class="king-overlay" role="dialog" aria-modal="true">
  <div class="king-modal">
    <div class="king-icon">👔</div>
    <h2 class="king-title">Royal Swap!</h2>
    <p class="king-reason">
      <strong>{actorName}</strong> played the <strong>King</strong> on you and swapped
      hands.
    </p>

    <div class="swap-details">
      <div class="swap-card">
        <span class="swap-label">You gave away</span>
        <Card cardId={cardGiven} isPlayable={false} />
        <span class="swap-card-name">{givenDef?.name ?? cardGiven}</span>
      </div>

      <div class="swap-arrow">⇄</div>

      <div class="swap-card">
        <span class="swap-label">You received</span>
        <Card cardId={cardReceived} isPlayable={false} />
        <span class="swap-card-name">{receivedDef?.name ?? cardReceived}</span>
      </div>
    </div>

    <button class="dismiss-btn" onclick={onDismiss}> Got it! </button>
  </div>
</div>

<style>
  .king-overlay {
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
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .king-modal {
    background: linear-gradient(135deg, #2d2a1f 0%, #1a1a2e 100%);
    border: 2px solid #f59e0b;
    border-radius: 20px;
    padding: 2rem;
    max-width: 90vw;
    max-height: 90vh;
    text-align: center;
    animation: modal-pop 0.4s ease-out;
    box-shadow: 0 0 40px rgba(245, 158, 11, 0.4);
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

  .king-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
    animation: icon-bounce 0.6s ease-out;
  }

  @keyframes icon-bounce {
    0%,
    100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-10px);
    }
  }

  .king-title {
    color: #f59e0b;
    font-size: 1.5rem;
    font-weight: 700;
    margin: 0 0 1rem 0;
  }

  .king-reason {
    color: rgba(255, 255, 255, 0.9);
    font-size: 1.1rem;
    margin: 0 0 1.5rem 0;
    line-height: 1.4;
  }

  .swap-details {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .swap-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }

  .swap-label {
    font-size: 0.85rem;
    color: rgba(255, 255, 255, 0.6);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-weight: 600;
  }

  .swap-card-name {
    font-size: 0.95rem;
    color: rgba(255, 255, 255, 0.9);
    font-weight: 600;
  }

  .swap-arrow {
    font-size: 2rem;
    color: #f59e0b;
    padding: 0 0.5rem;
    animation: arrow-pulse 1.5s ease-in-out infinite;
  }

  @keyframes arrow-pulse {
    0%,
    100% {
      opacity: 0.6;
    }
    50% {
      opacity: 1;
    }
  }

  .dismiss-btn {
    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
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
    box-shadow: 0 4px 15px rgba(245, 158, 11, 0.4);
  }

  /* Mobile responsive styles */
  @media (max-width: 480px) {
    .king-modal {
      padding: 1.5rem;
      margin: 1rem;
    }

    .king-icon {
      font-size: 3rem;
    }

    .king-title {
      font-size: 1.25rem;
    }

    .king-reason {
      font-size: 1rem;
    }

    .swap-details {
      gap: 0.5rem;
    }

    .swap-arrow {
      font-size: 1.5rem;
    }
  }
</style>
