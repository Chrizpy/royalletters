<script lang="ts">
  import cardsData from '../data/cards.json';
  import type { CardDefinition, Ruleset, GameState } from '../types';

  export let gameState: GameState;
  export let onClose: () => void;

  // Type for the card data structure
  interface CardRegistry {
    cards: Record<string, CardDefinition>;
    decks: Record<string, Record<string, number>>;
    classicCardValues: Record<string, number>;
  }

  const registry = cardsData as unknown as CardRegistry;

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

  // Calculate remaining count for a card type
  function getRemainingCount(cardId: string): { remaining: number; total: number } {
    const ruleset = gameState.ruleset;
    const deckDef = registry.decks[ruleset];
    const total = deckDef?.[cardId] || 0;

    // Count cards in discard piles
    let discarded = 0;
    for (const player of gameState.players) {
      discarded += player.discardPile.filter(c => c === cardId).length;
    }

    // Count cards in face-up burned cards
    const faceUpBurned = gameState.burnedCardsFaceUp.filter(c => c === cardId).length;

    const remaining = total - discarded - faceUpBurned;
    return { remaining, total };
  }

  // Get card value based on ruleset
  function getCardValue(cardId: string): number {
    const card = registry.cards[cardId];
    if (!card) return 0;

    if (gameState.ruleset === 'classic' && registry.classicCardValues[cardId] !== undefined) {
      return registry.classicCardValues[cardId];
    }
    return card.value;
  }

  // Get all cards in the current ruleset, sorted by value
  $: cardsInDeck = Object.keys(registry.decks[gameState.ruleset] || {})
    .map(cardId => {
      const card = registry.cards[cardId];
      const { remaining, total } = getRemainingCount(cardId);
      return {
        id: cardId,
        name: card.name,
        value: getCardValue(cardId),
        description: card.description,
        remaining,
        total
      };
    })
    .sort((a, b) => a.value - b.value);

  function handleOverlayClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }
</script>

<div 
  class="deck-info-overlay" 
  role="dialog" 
  aria-modal="true" 
  aria-labelledby="deck-info-title"
  on:click={handleOverlayClick}
  on:keydown={(e) => e.key === 'Escape' && onClose()}
  tabindex="0"
>
  <div class="deck-info-modal" on:click|stopPropagation>
    <div class="modal-header">
      <h3 id="deck-info-title">📚 Deck Information</h3>
      <button class="close-btn" on:click={onClose} aria-label="Close modal">✕</button>
    </div>

    <p class="subtitle">Cards in the {gameState.ruleset === 'classic' ? 'Classic' : '2019'} deck</p>

    <div class="cards-list">
      {#each cardsInDeck as card}
        <div class="card-info-item">
          <div class="card-header">
            <span class="card-emoji">{getCardEmoji(card.id)}</span>
            <div class="card-title">
              <span class="card-name">{card.name}</span>
              <span class="card-value">Value: {card.value}</span>
            </div>
          </div>
          <div class="card-count">
            <span class="remaining" class:none-left={card.remaining === 0}>
              {card.remaining} remaining
            </span>
            <span class="total">/ {card.total} total</span>
          </div>
          <p class="card-description">{card.description}</p>
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  .deck-info-overlay {
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

  .deck-info-modal {
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    border: 2px solid rgba(142, 68, 173, 0.6);
    border-radius: 20px;
    padding: 2rem;
    max-width: 600px;
    width: 100%;
    max-height: 85vh;
    overflow-y: auto;
    animation: modal-pop 0.3s ease-out;
    box-shadow: 0 0 40px rgba(142, 68, 173, 0.4);
  }

  @keyframes modal-pop {
    from { transform: scale(0.9); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.5rem;
  }

  h3 {
    margin: 0;
    color: white;
    font-size: 1.4rem;
  }

  .close-btn {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    color: white;
    font-size: 1.5rem;
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.3s ease;
    padding: 0;
    line-height: 1;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: scale(1.1);
  }

  .subtitle {
    text-align: center;
    color: rgba(255, 255, 255, 0.7);
    margin: 0 0 1.5rem 0;
    font-size: 0.95rem;
  }

  .cards-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .card-info-item {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 1rem;
    transition: all 0.3s ease;
  }

  .card-info-item:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(142, 68, 173, 0.5);
  }

  .card-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.5rem;
  }

  .card-emoji {
    font-size: 2rem;
    line-height: 1;
  }

  .card-title {
    display: flex;
    flex-direction: column;
    flex: 1;
  }

  .card-name {
    font-size: 1.1rem;
    font-weight: 600;
    color: white;
  }

  .card-value {
    font-size: 0.85rem;
    color: rgba(255, 255, 255, 0.6);
  }

  .card-count {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
    font-size: 0.9rem;
  }

  .remaining {
    font-weight: 600;
    color: #8e44ad;
  }

  .remaining.none-left {
    color: #e74c3c;
    text-decoration: line-through;
  }

  .total {
    color: rgba(255, 255, 255, 0.5);
  }

  .card-description {
    margin: 0;
    font-size: 0.9rem;
    color: rgba(255, 255, 255, 0.7);
    line-height: 1.4;
  }

  /* Mobile responsive styles */
  @media (max-width: 480px) {
    .deck-info-modal {
      padding: 1.5rem;
      max-width: 95vw;
    }

    h3 {
      font-size: 1.2rem;
    }

    .card-emoji {
      font-size: 1.5rem;
    }

    .card-name {
      font-size: 1rem;
    }

    .card-value {
      font-size: 0.75rem;
    }

    .card-info-item {
      padding: 0.75rem;
    }
  }
</style>
