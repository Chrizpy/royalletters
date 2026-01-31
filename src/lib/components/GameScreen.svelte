<script lang="ts">
  import Card from './Card.svelte';
  import PlayerArea from './PlayerArea.svelte';
  import TargetSelector from './TargetSelector.svelte';
  import GuessSelector from './GuessSelector.svelte';
  import GameLog from './GameLog.svelte';
  import CardReveal from './CardReveal.svelte';
  import { getCardDefinition } from '../engine/deck';
  import { gameState as gameStateStore, drawCard, revealedCard, clearRevealedCard } from '../stores/game';
  import type { PlayerState } from '../types';

  // Props
  export let localPlayerId: string;
  export let onPlayCard: (cardId: string, targetPlayerId?: string, targetCardGuess?: string) => void;
  export let onStartRound: () => void;
  export let isHost: boolean = false;

  // Local state
  let selectedCard: string | null = null;
  let selectingTarget: boolean = false;
  let selectingGuess: boolean = false;
  let pendingCardId: string | null = null;
  let pendingTargetId: string | null = null;

  // Get state from store for reactivity
  $: gameState = $gameStateStore;
  $: revealed = $revealedCard;
  $: localPlayer = gameState?.players.find(p => p.id === localPlayerId);
  $: isMyTurn = gameState?.players[gameState?.activePlayerIndex]?.id === localPlayerId;
  $: activePlayer = gameState?.players[gameState?.activePlayerIndex];
  $: opponents = gameState?.players.filter(p => p.id !== localPlayerId) || [];
  $: canPlay = isMyTurn && gameState?.phase === 'WAITING_FOR_ACTION';
  $: tokensToWin = getTokensToWin(gameState?.players.length || 2);

  function getTokensToWin(playerCount: number): number {
    const map: Record<number, number> = { 2: 7, 3: 5, 4: 4 };
    return map[playerCount] || 4;
  }

  function selectCard(cardId: string) {
    if (!canPlay) return;
    
    const card = getCardDefinition(cardId);
    if (!card) return;

    selectedCard = cardId;
    pendingCardId = cardId;

    // Check if card needs a target
    if (card.effect.requiresTargetPlayer) {
      // Check if there are valid targets available
      const validTargets = getValidTargets();
      if (validTargets.length === 0) {
        // No valid targets - play card with no effect
        playCardWithSelection(cardId);
      } else {
        selectingTarget = true;
      }
    } else {
      // Play card immediately
      playCardWithSelection(cardId);
    }
  }

  function selectTarget(targetId: string) {
    pendingTargetId = targetId;
    
    const card = getCardDefinition(pendingCardId!);
    if (card?.effect.requiresTargetCardType) {
      // Need to guess a card (Guard)
      selectingTarget = false;
      selectingGuess = true;
    } else {
      // Play the card
      playCardWithSelection(pendingCardId!, targetId);
    }
  }

  function selectGuess(cardGuess: string) {
    playCardWithSelection(pendingCardId!, pendingTargetId!, cardGuess);
  }

  function playCardWithSelection(cardId: string, targetId?: string, guess?: string) {
    onPlayCard(cardId, targetId, guess);
    resetSelection();
  }

  function resetSelection() {
    selectedCard = null;
    selectingTarget = false;
    selectingGuess = false;
    pendingCardId = null;
    pendingTargetId = null;
  }

  function cancelSelection() {
    resetSelection();
  }

  function handleDraw() {
    if (gameState?.phase === 'TURN_START' && isMyTurn) {
      drawCard();
    }
  }

  function handleStartRound() {
    onStartRound();
  }

  function getValidTargets(): PlayerState[] {
    if (!pendingCardId || !gameState) return [];
    const card = getCardDefinition(pendingCardId);
    if (!card) return [];
    
    return gameState.players.filter(p => {
      if (p.status === 'ELIMINATED') return false;
      if (p.status === 'PROTECTED' && p.id !== localPlayerId) return false;
      if (p.id === localPlayerId && !card.effect.canTargetSelf) return false;
      return true;
    });
  }
</script>

{#if gameState}
<div class="game-screen">
  <!-- Status bar -->
  <div class="status-bar">
    <div class="round-info">
      Round {gameState.roundCount} · {tokensToWin} tokens to win
    </div>
    <div class="turn-indicator" class:my-turn={isMyTurn}>
      {#if gameState.phase === 'GAME_END'}
        🎉 Game Over!
      {:else if gameState.phase === 'ROUND_END'}
        Round Complete
      {:else if isMyTurn}
        Your Turn
      {:else}
        {activePlayer?.name}'s Turn
      {/if}
    </div>
  </div>

  <!-- Opponents area -->
  <div class="opponents-area">
    {#each opponents as opponent}
      <PlayerArea 
        player={opponent} 
        isActive={gameState.players[gameState.activePlayerIndex]?.id === opponent.id}
        isTargetable={selectingTarget && getValidTargets().some(t => t.id === opponent.id)}
        onSelect={() => selectTarget(opponent.id)}
      />
    {/each}
  </div>

  <!-- Center area - deck and messages -->
  <div class="center-area">
    <div class="deck-area">
      <div class="deck" class:can-draw={gameState.phase === 'TURN_START' && isMyTurn}>
        <button class="deck-card" on:click={handleDraw} aria-label="Draw a card">
          <span class="deck-icon">📚</span>
          <span class="deck-count">{gameState.deck.length}</span>
        </button>
        {#if gameState.phase === 'TURN_START' && isMyTurn}
          <div class="draw-prompt">Click to draw!</div>
        {/if}
      </div>
    </div>

    {#if gameState.phase === 'LOBBY' || (gameState.phase === 'ROUND_END' && !gameState.winnerId)}
      <div class="start-area">
        {#if isHost}
          <button class="start-round-btn" on:click={handleStartRound}>
            {gameState.roundCount === 0 ? 'Start Game' : 'Next Round'}
          </button>
        {:else}
          <p class="waiting-msg">Waiting for host to start...</p>
        {/if}
      </div>
    {/if}

    {#if gameState.phase === 'GAME_END'}
      <div class="winner-banner">
        <div class="winner-icon">👑</div>
        <div class="winner-text">
          {gameState.players.find(p => p.id === gameState.winnerId)?.name} wins!
        </div>
      </div>
    {/if}

    {#if selectingTarget}
      <TargetSelector 
        validTargets={getValidTargets()} 
        onSelect={selectTarget}
        onCancel={cancelSelection}
        cardName={getCardDefinition(pendingCardId!)?.name || ''}
      />
    {/if}

    {#if selectingGuess}
      <GuessSelector 
        onSelect={selectGuess}
        onCancel={cancelSelection}
      />
    {/if}
  </div>

  <!-- Local player hand -->
  <div class="player-hand-area">
    <div class="player-info">
      <span class="player-name">You ({localPlayer?.name})</span>
      <div class="tokens">
        {#each Array(localPlayer?.tokens || 0) as _, i}
          <span class="token">💎</span>
        {/each}
        {#if !localPlayer?.tokens}
          <span class="no-tokens">0 tokens</span>
        {/if}
      </div>
      {#if localPlayer?.status === 'PROTECTED'}
        <span class="status-badge protected">Protected</span>
      {:else if localPlayer?.status === 'ELIMINATED'}
        <span class="status-badge eliminated">Eliminated</span>
      {/if}
    </div>

    <div class="hand">
      {#each localPlayer?.hand || [] as cardId, index}
        <Card 
          {cardId}
          isSelected={selectedCard === cardId}
          isPlayable={canPlay}
          onClick={() => selectCard(cardId)}
          delay={index * 100}
        />
      {/each}
      {#if localPlayer?.hand.length === 0 && gameState.phase !== 'LOBBY'}
        <div class="empty-hand">
          {#if gameState.phase === 'TURN_START' && isMyTurn}
            Draw a card to begin
          {:else}
            Waiting...
          {/if}
        </div>
      {/if}
    </div>

    {#if localPlayer?.discardPile && localPlayer.discardPile.length > 0}
      <div class="discard-pile">
        <span class="discard-label">Discarded:</span>
        {#each localPlayer.discardPile as cardId}
          <span class="discarded-card">{getCardDefinition(cardId)?.name}</span>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Game log -->
  <GameLog logs={gameState.logs} />
  
  <!-- Card reveal modal (for Priest) - only show to the player who played Priest -->
  {#if revealed && revealed.viewerPlayerId === localPlayerId}
    <CardReveal 
      cardId={revealed.cardId}
      playerName={revealed.playerName}
      onDismiss={clearRevealedCard}
    />
  {/if}
</div>
{:else}
  <div class="loading-screen">
    <p>Loading game...</p>
  </div>
{/if}

<style>
  .loading-screen {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
    color: white;
  }

  .game-screen {
    min-height: 100vh;
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
    display: flex;
    flex-direction: column;
    padding: 1rem;
    color: white;
    overflow: hidden;
  }

  /* Status bar */
  .status-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    backdrop-filter: blur(10px);
    margin-bottom: 1rem;
  }

  .round-info {
    font-size: 0.9rem;
    color: rgba(255, 255, 255, 0.8);
  }

  .turn-indicator {
    font-weight: 600;
    padding: 0.5rem 1rem;
    border-radius: 20px;
    background: rgba(255, 255, 255, 0.1);
    transition: all 0.3s ease;
  }

  .turn-indicator.my-turn {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    animation: pulse-glow 2s ease-in-out infinite;
  }

  @keyframes pulse-glow {
    0%, 100% { box-shadow: 0 0 5px rgba(102, 126, 234, 0.5); }
    50% { box-shadow: 0 0 20px rgba(102, 126, 234, 0.8); }
  }

  /* Opponents area */
  .opponents-area {
    display: flex;
    justify-content: center;
    gap: 1rem;
    flex-wrap: wrap;
    margin-bottom: 1rem;
  }

  /* Center area */
  .center-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    position: relative;
  }

  .deck-area {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .deck {
    position: relative;
    cursor: pointer;
    transition: transform 0.3s ease;
  }

  .deck.can-draw:hover {
    transform: scale(1.05);
  }

  .deck-card {
    width: 80px;
    height: 120px;
    background: linear-gradient(135deg, #2d3436 0%, #636e72 100%);
    border: 3px solid #74b9ff;
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    box-shadow: 
      0 4px 15px rgba(0, 0, 0, 0.3),
      inset 0 2px 4px rgba(255, 255, 255, 0.1);
    cursor: pointer;
    color: white;
    font-family: inherit;
  }

  .can-draw .deck-card {
    animation: deck-pulse 1.5s ease-in-out infinite;
  }

  @keyframes deck-pulse {
    0%, 100% { 
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3), 0 0 10px rgba(116, 185, 255, 0.3);
    }
    50% { 
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3), 0 0 25px rgba(116, 185, 255, 0.6);
    }
  }

  .deck-icon {
    font-size: 2rem;
  }

  .deck-count {
    font-size: 1.2rem;
    font-weight: 600;
    color: #74b9ff;
  }

  .draw-prompt {
    position: absolute;
    bottom: -30px;
    font-size: 0.9rem;
    color: #74b9ff;
    animation: bounce 1s ease-in-out infinite;
  }

  @keyframes bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-5px); }
  }

  .start-area {
    text-align: center;
  }

  .start-round-btn {
    padding: 1rem 2rem;
    font-size: 1.2rem;
    font-weight: 600;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
  }

  .start-round-btn:hover {
    transform: translateY(-3px);
    box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
  }

  .waiting-msg {
    color: rgba(255, 255, 255, 0.7);
    font-style: italic;
  }

  .winner-banner {
    background: linear-gradient(135deg, #f5af19 0%, #f12711 100%);
    padding: 2rem 3rem;
    border-radius: 20px;
    text-align: center;
    animation: winner-pop 0.5s ease-out;
    box-shadow: 0 10px 40px rgba(245, 175, 25, 0.4);
  }

  @keyframes winner-pop {
    0% { transform: scale(0); opacity: 0; }
    50% { transform: scale(1.1); }
    100% { transform: scale(1); opacity: 1; }
  }

  .winner-icon {
    font-size: 4rem;
    margin-bottom: 0.5rem;
  }

  .winner-text {
    font-size: 1.5rem;
    font-weight: 700;
  }

  /* Player hand area */
  .player-hand-area {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 20px 20px 0 0;
    padding: 1rem;
    margin: 0 -1rem -1rem -1rem;
    backdrop-filter: blur(10px);
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  .player-info {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .player-name {
    font-weight: 600;
    font-size: 1.1rem;
  }

  .tokens {
    display: flex;
    gap: 0.25rem;
  }

  .token {
    font-size: 1.2rem;
    animation: token-shine 2s ease-in-out infinite;
  }

  @keyframes token-shine {
    0%, 100% { filter: brightness(1); }
    50% { filter: brightness(1.3); }
  }

  .no-tokens {
    font-size: 0.9rem;
    color: rgba(255, 255, 255, 0.5);
  }

  .status-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.8rem;
    font-weight: 600;
  }

  .status-badge.protected {
    background: linear-gradient(135deg, #00b894 0%, #00cec9 100%);
  }

  .status-badge.eliminated {
    background: linear-gradient(135deg, #d63031 0%, #e17055 100%);
  }

  .hand {
    display: flex;
    justify-content: center;
    gap: 1rem;
    min-height: 160px;
  }

  .empty-hand {
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(255, 255, 255, 0.5);
    font-style: italic;
  }

  .discard-pile {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  .discard-label {
    font-size: 0.9rem;
    color: rgba(255, 255, 255, 0.6);
  }

  .discarded-card {
    padding: 0.25rem 0.5rem;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    font-size: 0.8rem;
  }

  /* Mobile responsive styles */
  @media (max-width: 480px) {
    .game-screen {
      padding: 0.5rem;
    }

    .status-bar {
      padding: 0.5rem 0.75rem;
      margin-bottom: 0.5rem;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .round-info {
      font-size: 0.8rem;
    }

    .turn-indicator {
      font-size: 0.85rem;
      padding: 0.4rem 0.75rem;
    }

    .opponents-area {
      gap: 0.5rem;
      margin-bottom: 0.5rem;
    }

    .deck-card {
      width: 60px;
      height: 90px;
    }

    .deck-icon {
      font-size: 1.5rem;
    }

    .deck-count {
      font-size: 1rem;
    }

    .draw-prompt {
      font-size: 0.8rem;
      bottom: -25px;
    }

    .start-round-btn {
      padding: 0.75rem 1.5rem;
      font-size: 1rem;
    }

    .winner-banner {
      padding: 1.5rem 2rem;
    }

    .winner-icon {
      font-size: 3rem;
    }

    .winner-text {
      font-size: 1.2rem;
    }

    .player-hand-area {
      padding: 0.75rem;
      padding-bottom: 5rem; /* Space for FAB button */
    }

    .player-info {
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-bottom: 0.75rem;
    }

    .player-name {
      font-size: 1rem;
    }

    .token {
      font-size: 1rem;
    }

    .hand {
      gap: 0.5rem;
      min-height: 120px;
    }

    .discard-pile {
      flex-wrap: wrap;
      gap: 0.25rem;
      margin-top: 0.5rem;
      padding-top: 0.5rem;
    }

    .discard-label {
      font-size: 0.8rem;
      width: 100%;
    }

    .discarded-card {
      font-size: 0.75rem;
    }
  }

  /* Tablet responsive styles */
  @media (min-width: 481px) and (max-width: 768px) {
    .game-screen {
      padding: 0.75rem;
    }

    .player-hand-area {
      padding-bottom: 4.5rem; /* Space for FAB button */
    }
  }
</style>
