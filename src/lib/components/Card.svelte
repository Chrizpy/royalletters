<script lang="ts">
  import { getCardDefinition } from '../engine/deck';
  
  export let cardId: string;
  export let isSelected: boolean = false;
  export let isPlayable: boolean = false;
  export let onClick: () => void = () => {};
  export let delay: number = 0;

  $: card = getCardDefinition(cardId);
  $: cardColor = getCardColor(cardId);

  function getCardColor(id: string): string {
    const colors: Record<string, string> = {
      'guard': '#e74c3c',
      'priest': '#9b59b6',
      'baron': '#3498db',
      'handmaid': '#1abc9c',
      'prince': '#f39c12',
      'king': '#e67e22',
      'countess': '#e91e63',
      'princess': '#ff69b4'
    };
    return colors[id] || '#95a5a6';
  }

  function getCardEmoji(id: string): string {
    const emojis: Record<string, string> = {
      'guard': '⚔️',
      'priest': '🙏',
      'baron': '⚖️',
      'handmaid': '🛡️',
      'prince': '👑',
      'king': '👔',
      'countess': '💃',
      'princess': '👸'
    };
    return emojis[id] || '🎴';
  }
</script>

<button 
  class="card"
  class:selected={isSelected}
  class:playable={isPlayable}
  style="--card-color: {cardColor}; --delay: {delay}ms;"
  on:click={onClick}
  disabled={!isPlayable}
>
  <div class="card-inner">
    <div class="card-value">{card?.value || '?'}</div>
    <div class="card-emoji">{getCardEmoji(cardId)}</div>
    <div class="card-name">{card?.name || 'Unknown'}</div>
    <div class="card-description">{card?.description || ''}</div>
  </div>
  {#if isPlayable}
    <div class="playable-glow"></div>
  {/if}
</button>

<style>
  .card {
    position: relative;
    width: 120px;
    height: 180px;
    perspective: 1000px;
    cursor: pointer;
    border: none;
    background: none;
    padding: 0;
    transition: transform 0.3s ease;
    animation: card-enter 0.5s ease-out var(--delay) both;
  }

  @keyframes card-enter {
    from {
      opacity: 0;
      transform: translateY(50px) rotateX(20deg);
    }
    to {
      opacity: 1;
      transform: translateY(0) rotateX(0);
    }
  }

  .card:disabled {
    cursor: not-allowed;
    opacity: 0.7;
  }

  .card:not(:disabled):hover {
    transform: translateY(-15px) scale(1.05);
  }

  .card.selected {
    transform: translateY(-20px) scale(1.08);
  }

  .card.playable:not(.selected) {
    animation: card-enter 0.5s ease-out var(--delay) both;
  }

  .card.playable:not(.selected):hover {
    transform: translateY(-15px) scale(1.05);
    box-shadow: 0 8px 30px rgba(255, 255, 255, 0.2);
  }

  .card-inner {
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, var(--card-color) 0%, color-mix(in srgb, var(--card-color) 70%, black) 100%);
    border-radius: 12px;
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    box-shadow: 
      0 4px 15px rgba(0, 0, 0, 0.3),
      inset 0 2px 4px rgba(255, 255, 255, 0.2),
      inset 0 -2px 4px rgba(0, 0, 0, 0.2);
    border: 2px solid rgba(255, 255, 255, 0.2);
    transition: all 0.3s ease;
  }

  .card.selected .card-inner {
    box-shadow: 
      0 8px 30px rgba(255, 255, 255, 0.3),
      inset 0 2px 4px rgba(255, 255, 255, 0.2);
    border-color: white;
  }

  .playable-glow {
    position: absolute;
    inset: -3px;
    border-radius: 14px;
    background: linear-gradient(135deg, var(--card-color), transparent, var(--card-color));
    z-index: -1;
    opacity: 0.5;
    animation: glow-rotate 3s linear infinite;
  }

  @keyframes glow-rotate {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .card-value {
    position: absolute;
    top: 8px;
    left: 10px;
    font-size: 1.5rem;
    font-weight: 700;
    color: white;
    text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.3);
  }

  .card-emoji {
    font-size: 3rem;
    margin-top: 1rem;
    filter: drop-shadow(2px 2px 2px rgba(0, 0, 0, 0.3));
  }

  .card-name {
    font-size: 0.9rem;
    font-weight: 600;
    color: white;
    text-align: center;
    margin-top: 0.5rem;
    text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.3);
  }

  .card-description {
    font-size: 0.65rem;
    color: rgba(255, 255, 255, 0.9);
    text-align: center;
    margin-top: 0.25rem;
    line-height: 1.2;
    flex: 1;
    display: flex;
    align-items: flex-end;
    padding-bottom: 0.25rem;
  }

  /* Mobile responsive styles */
  @media (max-width: 480px) {
    .card {
      width: 90px;
      height: 135px;
    }

    .card:not(:disabled):hover {
      transform: translateY(-10px) scale(1.03);
    }

    .card.selected {
      transform: translateY(-15px) scale(1.05);
    }

    .card-inner {
      padding: 0.5rem;
      border-radius: 10px;
    }

    .card-value {
      font-size: 1.1rem;
      top: 5px;
      left: 7px;
    }

    .card-emoji {
      font-size: 2rem;
      margin-top: 0.5rem;
    }

    .card-name {
      font-size: 0.75rem;
      margin-top: 0.25rem;
    }

    .card-description {
      font-size: 0.55rem;
    }

    .playable-glow {
      inset: -2px;
      border-radius: 12px;
    }
  }
</style>
