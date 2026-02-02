<script lang="ts">
  import Card from './Card.svelte';
  import { getCardDefinition } from '../engine/deck';
  
  export let playerHand: string[];
  export let cardsToReturnCount: number;
  export let onConfirmReturn: (cardsToReturn: string[]) => void;
  
  let selectedIndices: number[] = [];
  
  function toggleCard(cardIndex: number) {
    const indexInSelection = selectedIndices.indexOf(cardIndex);
    if (indexInSelection === -1) {
      // Only allow selecting up to the required number of cards
      if (selectedIndices.length < cardsToReturnCount) {
        selectedIndices = [...selectedIndices, cardIndex];
      }
    } else {
      selectedIndices = selectedIndices.filter(i => i !== cardIndex);
    }
  }
  
  function confirmReturn() {
    if (selectedIndices.length !== cardsToReturnCount) return;
    // Validate indices are still valid for current hand
    if (selectedIndices.some(i => i < 0 || i >= playerHand.length)) {
      selectedIndices = [];
      return;
    }
    // Convert indices back to card IDs for the callback
    const cardsToReturn = selectedIndices.map(i => playerHand[i]);
    onConfirmReturn(cardsToReturn);
  }
</script>

<div class="chancellor-overlay" role="dialog" aria-modal="true" aria-labelledby="chancellor-title" aria-describedby="chancellor-desc">
  <div class="chancellor-modal">
    <h3 id="chancellor-title">📜 Chancellor Effect</h3>
    <p id="chancellor-desc" class="subtitle">Select {cardsToReturnCount} card{cardsToReturnCount !== 1 ? 's' : ''} to return to the deck bottom.</p>
    
    {#if cardsToReturnCount > 1}
      <p class="order-hint">
        First selected → very bottom | Second selected → above it
      </p>
    {/if}
    
    <!-- Card selection area -->
    <div class="card-selection">
      {#each playerHand as cardId, index}
        <Card 
          {cardId}
          isSelected={selectedIndices.includes(index)}
          isPlayable={true}
          onClick={() => toggleCard(index)}
          delay={index * 100}
        />
      {/each}
    </div>
    
    <!-- Selected cards display -->
    <div class="selected-list">
      {#if selectedIndices.length > 1}
        <div class="selected-item">
          <span class="position-badge">⬆️ 2nd</span>
          <span class="selected-name">{getCardDefinition(playerHand[selectedIndices[1]])?.name}</span>
        </div>
      {/if}
      {#if selectedIndices.length > 0}
        <div class="selected-item bottom-card">
          <span class="position-badge">⬇️ Bottom</span>
          <span class="selected-name">{getCardDefinition(playerHand[selectedIndices[0]])?.name}</span>
        </div>
      {/if}
    </div>
    
    <p class="selected-count">Selected: {selectedIndices.length}/{cardsToReturnCount}</p>
    
    {#if selectedIndices.length === cardsToReturnCount}
      <button class="confirm-btn" on:click={confirmReturn}>
        Confirm Return
      </button>
    {/if}
  </div>
</div>

<style>
  .chancellor-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    animation: overlay-fade 0.3s ease-out;
    padding: 1rem;
  }

  @keyframes overlay-fade {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .chancellor-modal {
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    border: 2px solid rgba(142, 68, 173, 0.6);
    border-radius: 20px;
    padding: 2rem;
    max-width: 90vw;
    max-height: 90vh;
    overflow-y: auto;
    animation: modal-pop 0.3s ease-out;
    box-shadow: 0 0 40px rgba(142, 68, 173, 0.4);
  }

  @keyframes modal-pop {
    from { transform: scale(0.9); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }

  h3 {
    text-align: center;
    margin: 0 0 0.5rem 0;
    color: white;
    font-size: 1.4rem;
  }

  .subtitle {
    text-align: center;
    color: rgba(255, 255, 255, 0.8);
    margin: 0 0 1rem 0;
  }

  .order-hint {
    text-align: center;
    font-size: 0.85rem;
    color: rgba(255, 255, 255, 0.6);
    margin: 0 0 1rem 0;
  }

  .card-selection {
    display: flex;
    justify-content: center;
    gap: 1rem;
    margin-bottom: 1.5rem;
    flex-wrap: wrap;
  }

  .selected-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 1rem;
    min-height: 70px;
  }

  .selected-item {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: rgba(142, 68, 173, 0.3);
    border-radius: 8px;
    border: 1px solid rgba(142, 68, 173, 0.5);
  }

  .position-badge {
    font-size: 0.85rem;
    padding: 0.25rem 0.5rem;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 4px;
    font-weight: 600;
    color: white;
  }

  .selected-name {
    font-weight: 500;
    color: white;
  }

  .selected-count {
    text-align: center;
    font-weight: 600;
    color: #8e44ad;
    margin: 0 0 1rem 0;
  }

  .confirm-btn {
    width: 100%;
    padding: 0.75rem 2rem;
    font-size: 1rem;
    font-weight: 600;
    background: linear-gradient(135deg, #8e44ad 0%, #9b59b6 100%);
    color: white;
    border: none;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.3s ease;
  }

  .confirm-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 15px rgba(142, 68, 173, 0.4);
  }

  /* Mobile responsive styles */
  @media (max-width: 480px) {
    .chancellor-modal {
      padding: 1.5rem;
      max-width: 95vw;
    }

    h3 {
      font-size: 1.2rem;
    }

    .subtitle {
      font-size: 0.9rem;
    }

    .order-hint {
      font-size: 0.75rem;
    }

    .card-selection {
      gap: 0.5rem;
    }

    .selected-item {
      padding: 0.4rem 0.75rem;
    }

    .position-badge {
      font-size: 0.75rem;
    }

    .selected-name {
      font-size: 0.9rem;
    }
  }
</style>
