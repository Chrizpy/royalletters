<script lang="ts">
  import cardsData from '../data/cards.json';
  import type { CardDefinition, Ruleset, PlayerState } from '../types';
  import { gameState } from '../stores/game';
  import { getCardDefinition } from '../engine/deck';

  export let onSelect: (cardGuess: string) => void;
  export let onCancel: () => void;
  export let title: string = 'Guess their card!';
  export let subtitle: string = 'Which card do you think they have?';
  export let showCancel: boolean = true;
  export let headerIcon: string = '';
  export let headerStyle: 'default' | 'revenge' = 'default';
  export let players: PlayerState[] = [];
  export let localPlayerId: string = '';
  
  // Type for the new card data structure
  interface CardRegistry {
    cards: Record<string, CardDefinition>;
    decks: Record<string, Record<string, number>>;
    classicCardValues: Record<string, number>;
  }
  
  const registry = cardsData as unknown as CardRegistry;
  
  // Get current ruleset from game state
  $: ruleset = $gameState?.ruleset || 'classic';
  
  // Get cards available in current deck, excluding Guard and tillbakakaka (can't guess Guard, but CAN guess Spy)
  $: guessableCards = Object.values(registry.cards)
    .filter(card => {
      // Can't guess Guard or tillbakakaka
      if (card.id === 'guard' || card.id === 'tillbakakaka') return false;
      // Only include cards that are in the current deck
      const deckDef = registry.decks[ruleset];
      return deckDef && deckDef[card.id] !== undefined;
    })
    .map(card => ({
      ...card,
      // Use classic values for classic ruleset
      value: ruleset === 'classic' && registry.classicCardValues[card.id] !== undefined 
        ? registry.classicCardValues[card.id] 
        : card.value
    }))
    .sort((a, b) => a.value - b.value);

  function getCardEmoji(id: string): string {
    const emojis: Record<string, string> = {
      'spy': '🕵️',
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

  function getCardColor(id: string): string {
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
    return colors[id] || '#95a5a6';
  }

  // Filter players who have played cards (non-empty discard pile)
  $: playersWithCards = players.filter(p => p.discardPile.length > 0);
</script>

<div class="guess-selector-overlay" role="dialog" aria-modal="true" tabindex="0" on:click={showCancel ? onCancel : undefined} on:keydown={(e) => e.key === 'Escape' && showCancel && onCancel()}>
  <div class="guess-selector" class:revenge-style={headerStyle === 'revenge'} on:click|stopPropagation>
    {#if headerIcon}
      <div class="header-icon">{headerIcon}</div>
    {/if}
    <h3 class:revenge-title={headerStyle === 'revenge'}>{title}</h3>
    <p class="subtitle">{subtitle}</p>

    {#if playersWithCards.length > 0}
      <div class="played-cards-summary">
        <div class="summary-header">📜 Played this round:</div>
        <div class="players-played">
          {#each playersWithCards as player}
            <div class="player-played" class:is-local={player.id === localPlayerId} class:is-eliminated={player.status === 'ELIMINATED'}>
              <span class="player-name-tag" style="color: {player.color}">
                {player.id === localPlayerId ? 'You' : player.name}{player.status === 'ELIMINATED' ? ' 💀' : ''}:
              </span>
              <span class="played-cards">
                {#each player.discardPile as cardId}
                  <span 
                    class="mini-card" 
                    style="--card-color: {getCardColor(cardId)}"
                    title={getCardDefinition(cardId)?.name}
                  >
                    {getCardDefinition(cardId)?.value}{#if cardId === 'tillbakakaka'}🍪{/if}
                  </span>
                {/each}
              </span>
            </div>
          {/each}
        </div>
      </div>
    {/if}
    
    <div class="card-grid">
      {#each guessableCards as card}
        <button 
          class="guess-card"
          style="--card-color: {getCardColor(card.id)}"
          on:click={() => onSelect(card.id)}
        >
          <div class="guess-value">{card.value}</div>
          <div class="guess-emoji">{getCardEmoji(card.id)}</div>
          <div class="guess-name">{card.name}</div>
        </button>
      {/each}
    </div>

    {#if showCancel}
      <button class="cancel-btn" on:click={onCancel}>Cancel</button>
    {/if}
  </div>
</div>

<style>
  .guess-selector-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    animation: overlay-fade 0.3s ease-out;
    padding: 1rem;
    overflow-y: auto;
  }

  @keyframes overlay-fade {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .guess-selector {
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    border: 2px solid rgba(255, 255, 255, 0.2);
    border-radius: 20px;
    padding: 2rem;
    max-width: 500px;
    width: 100%;
    max-height: calc(100vh - 2rem);
    overflow-y: auto;
    animation: modal-pop 0.3s ease-out;
  }

  /* Mobile-specific adjustments */
  @media (max-width: 480px) {
    .guess-selector-overlay {
      padding: 0.5rem;
      align-items: flex-start;
    }

    .guess-selector {
      padding: 1.25rem;
      max-height: calc(100vh - 1rem);
      margin: 0.5rem 0;
    }
  }

  @keyframes modal-pop {
    from { transform: scale(0.9); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }

  .header-icon {
    text-align: center;
    font-size: 2.5rem;
    margin-bottom: 0.5rem;
  }

  h3 {
    text-align: center;
    margin: 0 0 0.5rem 0;
    color: white;
    font-size: 1.4rem;
  }

  h3.revenge-title {
    font-size: 1.6rem;
    color: #ff6b6b;
  }

  .guess-selector.revenge-style {
    border-color: #e74c3c;
    box-shadow: 0 0 30px rgba(231, 76, 60, 0.4);
    animation: modal-pop 0.3s ease-out, revenge-pulse 1.5s ease-in-out infinite;
  }

  @keyframes revenge-pulse {
    0%, 100% { box-shadow: 0 0 20px rgba(231, 76, 60, 0.4); }
    50% { box-shadow: 0 0 40px rgba(231, 76, 60, 0.7); }
  }

  .subtitle {
    text-align: center;
    color: rgba(255, 255, 255, 0.7);
    margin: 0 0 1.5rem 0;
  }

  .card-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 0.75rem;
    margin-bottom: 1.5rem;
  }

  .guess-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1rem 0.5rem;
    background: linear-gradient(135deg, var(--card-color) 0%, color-mix(in srgb, var(--card-color) 70%, black) 100%);
    border: 2px solid rgba(255, 255, 255, 0.2);
    border-radius: 12px;
    color: white;
    cursor: pointer;
    transition: all 0.3s ease;
    position: relative;
  }

  .guess-card:hover {
    transform: translateY(-5px) scale(1.05);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.4);
    border-color: white;
  }

  .guess-value {
    position: absolute;
    top: 5px;
    left: 8px;
    font-size: 1rem;
    font-weight: 700;
    text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.3);
  }

  .guess-emoji {
    font-size: 2rem;
    margin-bottom: 0.25rem;
  }

  .guess-name {
    font-size: 0.75rem;
    font-weight: 600;
    text-align: center;
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

  /* Played cards summary styles */
  .played-cards-summary {
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 10px;
    padding: 0.75rem 1rem;
    margin-bottom: 1.25rem;
  }

  .summary-header {
    font-size: 0.8rem;
    color: rgba(255, 255, 255, 0.6);
    margin-bottom: 0.5rem;
    font-weight: 500;
  }

  .players-played {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1rem;
  }

  .player-played {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }

  .player-played.is-eliminated {
    opacity: 0.6;
  }

  .player-name-tag {
    font-size: 0.75rem;
    font-weight: 600;
  }

  .played-cards {
    display: flex;
    gap: 0.2rem;
  }

  .mini-card {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 20px;
    height: 26px;
    padding: 0 4px;
    background: linear-gradient(135deg, var(--card-color) 0%, color-mix(in srgb, var(--card-color) 70%, black) 100%);
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 3px;
    font-size: 0.7rem;
    font-weight: 700;
    color: white;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  }
</style>
