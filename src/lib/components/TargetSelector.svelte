<script lang="ts">
  import type { PlayerState } from '../types';

  export let validTargets: PlayerState[] = [];
  export let onSelect: (targetId: string) => void;
  export let onCancel: () => void;
  export let cardName: string = '';
</script>

<div class="target-selector-overlay" role="dialog" aria-modal="true" tabindex="0" on:click={onCancel} on:keydown={(e) => e.key === 'Escape' && onCancel()}>
  <div class="target-selector" on:click|stopPropagation>
    <h3>Select a target for {cardName}</h3>
    
    <div class="target-list">
      {#each validTargets as target}
        <button class="target-btn" on:click={() => onSelect(target.id)}>
          <span class="target-icon">👤</span>
          <span class="target-name">{target.name}</span>
        </button>
      {/each}

      {#if validTargets.length === 0}
        <p class="no-targets">No valid targets available!</p>
      {/if}
    </div>

    <button class="cancel-btn" on:click={onCancel}>Cancel</button>
  </div>
</div>

<style>
  .target-selector-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    animation: overlay-fade 0.3s ease-out;
  }

  @keyframes overlay-fade {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .target-selector {
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    border: 2px solid rgba(255, 255, 255, 0.2);
    border-radius: 20px;
    padding: 2rem;
    max-width: 400px;
    width: 90%;
    animation: modal-pop 0.3s ease-out;
  }

  @keyframes modal-pop {
    from { transform: scale(0.9); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }

  h3 {
    text-align: center;
    margin: 0 0 1.5rem 0;
    color: white;
    font-size: 1.2rem;
  }

  .target-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
  }

  .target-btn {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem;
    background: rgba(255, 255, 255, 0.1);
    border: 2px solid rgba(255, 255, 255, 0.2);
    border-radius: 12px;
    color: white;
    font-size: 1rem;
    cursor: pointer;
    transition: all 0.3s ease;
  }

  .target-btn:hover {
    background: rgba(0, 184, 148, 0.2);
    border-color: #00b894;
    transform: translateX(5px);
  }

  .target-icon {
    font-size: 1.5rem;
  }

  .target-name {
    flex: 1;
    font-weight: 500;
  }

  .no-targets {
    text-align: center;
    color: rgba(255, 255, 255, 0.6);
    font-style: italic;
  }

  .cancel-btn {
    width: 100%;
    padding: 0.75rem;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    color: white;
    font-size: 1rem;
    cursor: pointer;
    transition: all 0.3s ease;
  }

  .cancel-btn:hover {
    background: rgba(255, 255, 255, 0.2);
  }
</style>
