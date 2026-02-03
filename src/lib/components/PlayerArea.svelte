<script lang="ts">
  import type { PlayerState } from '../types';
  import { getCardDefinition } from '../engine/deck';

  export let player: PlayerState;
  export let isActive: boolean = false;
  export let isTargetable: boolean = false;
  export let onSelect: () => void = () => {};
</script>

<button 
  class="player-area"
  class:active={isActive}
  class:targetable={isTargetable}
  class:eliminated={player.status === 'ELIMINATED'}
  class:protected={player.status === 'PROTECTED'}
  on:click={() => isTargetable && onSelect()}
  disabled={!isTargetable}
>
  <div class="player-avatar">
    {#if player.status === 'ELIMINATED'}
      💀
    {:else if player.status === 'PROTECTED'}
      🛡️
    {:else}
      👤
    {/if}
  </div>
  
  <div class="player-details">
    <div class="player-name">{player.name}</div>
    <div class="player-tokens">
      {#each Array(player.tokens) as _, i}
        <span class="token">💎</span>
      {/each}
      {#if player.tokens === 0}
        <span class="no-tokens">0 tokens</span>
      {/if}
    </div>
  </div>

  <div class="card-count">
    {#if player.status !== 'ELIMINATED'}
      <div class="mini-card">
        <span class="card-icon">🎴</span>
        <span class="count">{player.hand.length}</span>
      </div>
    {/if}
  </div>

  {#if player.discardPile.length > 0}
    <div class="discard-preview">
      {#each player.discardPile as cardId}
        <span class="discarded-mini" title={getCardDefinition(cardId)?.name}>
          {getCardDefinition(cardId)?.value}
        </span>
      {/each}
    </div>
  {/if}

  {#if isActive}
    <div class="active-indicator">Playing...</div>
  {/if}

  {#if isTargetable}
    <div class="target-overlay">
      <span class="target-text">Select Target</span>
    </div>
  {/if}
</button>

<style>
  .player-area {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem 1.25rem;
    background: rgba(255, 255, 255, 0.1);
    border: 2px solid rgba(255, 255, 255, 0.2);
    border-radius: 16px;
    min-width: 180px;
    cursor: default;
    transition: all 0.3s ease;
    color: white;
    font-family: inherit;
    text-align: left;
  }

  .player-area:disabled {
    cursor: default;
  }

  .player-area.active {
    border-color: #667eea;
    box-shadow: 0 0 20px rgba(102, 126, 234, 0.4);
  }

  .player-area.targetable {
    cursor: pointer;
    border-color: #00b894;
    animation: target-pulse 1s ease-in-out infinite;
  }

  @keyframes target-pulse {
    0%, 100% { box-shadow: 0 0 10px rgba(0, 184, 148, 0.4); }
    50% { box-shadow: 0 0 25px rgba(0, 184, 148, 0.7); }
  }

  .player-area.targetable:hover {
    background: rgba(0, 184, 148, 0.2);
    transform: scale(1.02);
  }

  .player-area.eliminated {
    opacity: 0.5;
    filter: grayscale(0.5);
  }

  .player-area.protected {
    border-color: #00cec9;
    background: rgba(0, 206, 201, 0.1);
  }

  .player-avatar {
    font-size: 2rem;
    width: 50px;
    height: 50px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 50%;
  }

  .player-details {
    flex: 1;
  }

  .player-name {
    font-weight: 600;
    margin-bottom: 0.25rem;
  }

  .player-tokens {
    display: flex;
    gap: 0.25rem;
  }

  .token {
    font-size: 0.9rem;
  }

  .no-tokens {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.5);
  }

  .card-count {
    position: relative;
  }

  .mini-card {
    width: 50px;
    height: 70px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border: 2px solid rgba(255, 255, 255, 0.4);
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: space-between;
    font-size: 0.8rem;
    padding: 0.25rem;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }

  .card-icon {
    font-size: 1.2rem;
  }

  .count {
    font-size: 0.85rem;
    font-weight: 700;
    color: white;
    align-self: flex-start;
  }

  .discard-preview {
    position: absolute;
    bottom: -8px;
    right: 10px;
    display: flex;
    flex-wrap: wrap;
    gap: 3px;
    max-width: 150px;
    justify-content: flex-end;
  }

  .discarded-mini {
    width: 28px;
    height: 40px;
    background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 4px;
    display: flex;
    align-items: flex-end;
    justify-content: flex-start;
    padding: 0.15rem;
    font-size: 0.75rem;
    font-weight: 700;
    color: white;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
  }

  .active-indicator {
    position: absolute;
    top: -10px;
    left: 50%;
    transform: translateX(-50%);
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 600;
    animation: pulse 1.5s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }

  .target-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0, 184, 148, 0.3);
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: target-fade 0.5s ease-out;
  }

  @keyframes target-fade {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .target-text {
    background: white;
    color: #00b894;
    padding: 0.5rem 1rem;
    border-radius: 8px;
    font-weight: 600;
    font-size: 0.9rem;
  }

  /* Mobile responsive styles */
  @media (max-width: 480px) {
    .player-area {
      padding: 0.5rem 0.75rem;
      min-width: 140px;
      gap: 0.5rem;
      border-radius: 12px;
    }

    .player-avatar {
      font-size: 1.5rem;
      width: 36px;
      height: 36px;
    }

    .player-name {
      font-size: 0.85rem;
    }

    .token {
      font-size: 0.75rem;
    }

    .no-tokens {
      font-size: 0.65rem;
    }

    .mini-card {
      width: 42px;
      height: 60px;
    }

    .card-icon {
      font-size: 1rem;
    }

    .count {
      font-size: 0.75rem;
    }

    .discarded-mini {
      width: 24px;
      height: 34px;
      font-size: 0.65rem;
    }

    .active-indicator {
      font-size: 0.65rem;
      padding: 0.2rem 0.5rem;
      top: -8px;
    }

    .target-text {
      padding: 0.35rem 0.75rem;
      font-size: 0.75rem;
    }
  }
</style>
