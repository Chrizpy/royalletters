<script lang="ts">
  import type { PlayerState } from '../types';
  import { getCardDefinition } from '../engine/deck';

  export let player: PlayerState;
  export let isActive: boolean = false;
  export let isTargetable: boolean = false;
  export let onSelect: () => void = () => {};
  export let isCardEffectActor: boolean = false;
  export let isCardEffectTarget: boolean = false;
  export let cardEffectId: string | null = null;

  let previousDiscardPileLength = 0;
  let newlyAddedCardIndex = -1;

  function getCardColor(cardId: string): string {
    const colors: Record<string, string> = {
      'spy': '#2c3e50',
      'guard': '#e74c3c',
      'tillbakakaka': '#e74c3c',
      'priest': '#9b59b6',
      'baron': '#3498db',
      'handmaid': '#1abc9c',
      'prince': '#f39c12',
      'chancellor': '#8e44ad',
      'king': '#e67e22',
      'countess': '#e91e63',
      'princess': '#ff69b4'
    };
    return colors[cardId] || '#95a5a6';
  }
  
  $: effectBorderColor = cardEffectId ? getCardColor(cardEffectId) : null;
  
  // Track when a new card is added to discard pile
  $: if (player.discardPile.length > previousDiscardPileLength) {
    // A new card was added - it's the last one in the array
    newlyAddedCardIndex = player.discardPile.length - 1;
    previousDiscardPileLength = player.discardPile.length;
    
    // Clear the animation flag after the animation completes
    setTimeout(() => {
      newlyAddedCardIndex = -1;
    }, 600); // Match animation duration
  } else if (player.discardPile.length < previousDiscardPileLength) {
    // Discard pile was cleared (new round)
    previousDiscardPileLength = player.discardPile.length;
    newlyAddedCardIndex = -1;
  }
</script>

<button 
  class="player-area"
  class:active={isActive}
  class:targetable={isTargetable}
  class:card-effect-actor={isCardEffectActor}
  class:card-effect-target={isCardEffectTarget}
  class:eliminated={player.status === 'ELIMINATED'}
  class:protected={player.status === 'PROTECTED'}
  style={effectBorderColor ? `--effect-border-color: ${effectBorderColor}` : ''}
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

  {#if player.discardPile.length > 0}
    <div class="discard-preview">
      {#each player.discardPile as cardId, index}
        <span 
          class="discarded-mini" 
          class:newly-played={index === newlyAddedCardIndex}
          title={getCardDefinition(cardId)?.name}
          style="--card-color: {getCardColor(cardId)}; --stack-index: {index};"
        >
          {getCardDefinition(cardId)?.value}{#if cardId === 'tillbakakaka'}🍪{/if}
        </span>
      {/each}
    </div>
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
    padding: 0;
    background: rgba(255, 255, 255, 0.1);
    border: 2px solid rgba(255, 255, 255, 0.2);
    border-radius: 16px;
    min-width: 200px;
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

  .player-area.card-effect-actor {
    border-color: var(--effect-border-color, #667eea);
    border-width: 3px;
    box-shadow: 0 0 30px var(--effect-border-color, rgba(102, 126, 234, 0.8));
    animation: effect-pulse 1.5s ease-in-out 2;
  }

  .player-area.card-effect-target {
    border-color: var(--effect-border-color, #e74c3c);
    border-width: 3px;
    box-shadow: 0 0 30px var(--effect-border-color, rgba(231, 76, 60, 0.8));
    animation: effect-pulse 1.5s ease-in-out 2;
  }

  @keyframes effect-pulse {
    0%, 100% { 
      box-shadow: 0 0 20px var(--effect-border-color, rgba(102, 126, 234, 0.5));
      transform: scale(1);
      border-width: 3px;
    }
    50% { 
      box-shadow: 0 0 40px var(--effect-border-color, rgba(102, 126, 234, 1));
      transform: scale(1.03);
      border-width: 4px;
    }
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
    margin: 1rem 0.5rem 1rem 1rem;
  }

  .player-details {
    flex: 1;
    padding: 1rem 1rem 1rem 0;
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

  .discard-preview {
    position: absolute;
    bottom: -8px;
    right: 10px;
    display: flex;
    height: 40px;
  }

  .discarded-mini {
    width: 28px;
    height: 40px;
    background: linear-gradient(135deg, var(--card-color) 0%, color-mix(in srgb, var(--card-color) 70%, black) 100%);
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 4px;
    display: flex;
    align-items: flex-end;
    justify-content: flex-end;
    padding: 0.15rem;
    font-size: 0.75rem;
    font-weight: 700;
    color: white;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
    position: absolute;
    right: calc(var(--stack-index) * 12px);
    transition: all 0.3s ease;
  }

  .discarded-mini.newly-played {
    animation: card-play 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  @keyframes card-play {
    0% {
      transform: translateY(-50px) scale(1.5) rotate(-10deg);
      opacity: 0;
      box-shadow: 0 10px 30px rgba(255, 255, 255, 0.5);
    }
    50% {
      transform: translateY(-25px) scale(1.3) rotate(-5deg);
      box-shadow: 0 8px 25px rgba(255, 255, 255, 0.4);
    }
    100% {
      transform: translateY(0) scale(1) rotate(0deg);
      opacity: 1;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
    }
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

    .discarded-mini {
      width: 24px;
      height: 34px;
      font-size: 0.65rem;
      right: calc(var(--stack-index) * 10px);
    }

    .target-text {
      padding: 0.35rem 0.75rem;
      font-size: 0.75rem;
    }
  }
</style>
