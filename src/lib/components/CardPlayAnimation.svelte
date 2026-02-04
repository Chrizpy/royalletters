<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { getCardDefinition } from '../engine/deck';

  export let cardId: string;
  export let playerName: string;
  export let onComplete: () => void;

  const ANIMATION_DURATION_MS = 2000; // Total animation duration (0.6s fly-in + 0.8s hold + 0.6s fly-out)
  
  let animationComplete = false;

  $: card = getCardDefinition(cardId);

  function getCardColor(id: string): string {
    const colors: Record<string, string> = {
      'spy': '#2c3e50',
      'guard': '#e74c3c',
      'priest': '#9b59b6',
      'baron': '#3498db',
      'handmaid': '#1abc9c',
      'prince': '#f39c12',
      'chancellor': '#8e44ad',
      'king': '#e67e22',
      'countess': '#e91e63',
      'princess': '#ff69b4'
    };
    return colors[id] || '#95a5a6';
  }

  function getCardEmoji(id: string): string {
    const emojis: Record<string, string> = {
      'spy': '🕵️',
      'guard': '⚔️',
      'priest': '🙏',
      'baron': '⚖️',
      'handmaid': '🛡️',
      'prince': '👑',
      'chancellor': '📜',
      'king': '👔',
      'countess': '💃',
      'princess': '👸'
    };
    return emojis[id] || '🎴';
  }

  onMount(() => {
    // Complete animation after duration
    const timer = setTimeout(() => {
      animationComplete = true;
      onComplete();
    }, ANIMATION_DURATION_MS);

    return () => clearTimeout(timer);
  });
</script>

<div class="card-play-animation">
  <div class="card-container" class:complete={animationComplete}>
    <div class="played-card" style="--card-color: {getCardColor(cardId)}">
      <div class="card-inner">
        <div class="card-value">{card?.value || 0}</div>
        <div class="card-emoji">{getCardEmoji(cardId)}</div>
        <div class="card-name">{card?.name || 'Unknown'}</div>
      </div>
    </div>
    
    <!-- Particle effects -->
    <div class="particles">
      {#each Array(12) as _, i}
        <div class="particle" style="--particle-index: {i}"></div>
      {/each}
    </div>
  </div>

  <div class="player-label">{playerName}</div>
</div>

<style>
  .card-play-animation {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 100;
    pointer-events: none;
  }

  .card-container {
    position: relative;
    animation: card-fly-in 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards,
               card-scale-pulse 0.8s ease-in-out 0.6s forwards;
  }

  .card-container.complete {
    animation: card-fly-out 0.6s cubic-bezier(0.55, 0.085, 0.68, 0.53) forwards;
  }

  @keyframes card-fly-in {
    from {
      opacity: 0;
      transform: translateY(200px) scale(0.5) rotate(-10deg);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1.3) rotate(0deg);
    }
  }

  @keyframes card-scale-pulse {
    0%, 100% {
      transform: scale(1.3);
    }
    50% {
      transform: scale(1.4);
    }
  }

  @keyframes card-fly-out {
    from {
      opacity: 1;
      transform: translateY(0) scale(1.3);
    }
    to {
      opacity: 0;
      transform: translateY(-100px) scale(0.8);
    }
  }

  .played-card {
    width: 160px;
    height: 240px;
    position: relative;
  }

  .card-inner {
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, var(--card-color) 0%, color-mix(in srgb, var(--card-color) 70%, black) 100%);
    border-radius: 16px;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    box-shadow: 
      0 10px 40px rgba(0, 0, 0, 0.5),
      inset 0 2px 4px rgba(255, 255, 255, 0.3),
      0 0 30px rgba(255, 255, 255, 0.2);
    border: 3px solid rgba(255, 255, 255, 0.4);
  }

  .card-value {
    position: absolute;
    top: 12px;
    left: 14px;
    font-size: 2rem;
    font-weight: 700;
    color: white;
    text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
  }

  .card-emoji {
    font-size: 4.5rem;
    margin-top: 2rem;
    filter: drop-shadow(3px 3px 3px rgba(0, 0, 0, 0.5));
  }

  .card-name {
    font-size: 1.3rem;
    font-weight: 600;
    color: white;
    text-align: center;
    margin-top: 1rem;
    text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
  }

  .particles {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .particle {
    position: absolute;
    width: 8px;
    height: 8px;
    background: radial-gradient(circle, rgba(255, 255, 255, 0.9), transparent);
    border-radius: 50%;
    top: 50%;
    left: 50%;
    animation: particle-burst 1s ease-out forwards;
    animation-delay: calc(0.6s + var(--particle-index) * 0.05s);
    opacity: 0;
  }

  @keyframes particle-burst {
    0% {
      opacity: 1;
      transform: translate(-50%, -50%) translate(0, 0) scale(1);
    }
    100% {
      opacity: 0;
      transform: translate(-50%, -50%) 
                 translate(
                   calc(cos(var(--particle-index) * 30deg) * 100px),
                   calc(sin(var(--particle-index) * 30deg) * 100px)
                 )
                 scale(0);
    }
  }

  .player-label {
    margin-top: 2rem;
    padding: 0.75rem 1.5rem;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(10px);
    border-radius: 12px;
    color: white;
    font-size: 1.2rem;
    font-weight: 600;
    text-shadow: 1px 1px 3px rgba(0, 0, 0, 0.8);
    animation: label-fade-in 0.4s ease-out 0.3s both,
               label-fade-out 0.4s ease-out 1.6s forwards;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  }

  @keyframes label-fade-in {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes label-fade-out {
    from {
      opacity: 1;
      transform: translateY(0);
    }
    to {
      opacity: 0;
      transform: translateY(-20px);
    }
  }

  /* Mobile responsive styles */
  @media (max-width: 480px) {
    .played-card {
      width: 120px;
      height: 180px;
    }

    .card-inner {
      padding: 0.75rem;
      border-radius: 12px;
    }

    .card-value {
      font-size: 1.5rem;
      top: 8px;
      left: 10px;
    }

    .card-emoji {
      font-size: 3rem;
      margin-top: 1.5rem;
    }

    .card-name {
      font-size: 1rem;
      margin-top: 0.75rem;
    }

    .player-label {
      font-size: 1rem;
      padding: 0.5rem 1rem;
      margin-top: 1.5rem;
    }
  }
</style>
