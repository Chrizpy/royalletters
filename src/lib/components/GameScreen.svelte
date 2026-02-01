<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import Card from './Card.svelte';
  import PlayerArea from './PlayerArea.svelte';
  import TargetSelector from './TargetSelector.svelte';
  import GuessSelector from './GuessSelector.svelte';
  import GameMenu from './GameMenu.svelte';
  import CardReveal from './CardReveal.svelte';
  import GameFeed from './GameFeed.svelte';
  import EliminationModal from './EliminationModal.svelte';
  import { getCardDefinition } from '../engine/deck';
  import { gameState as gameStateStore, drawCard, revealedCard, clearRevealedCard } from '../stores/game';
  import type { PlayerState } from '../types';

  // Props
  export let localPlayerId: string;
  export let onPlayCard: (cardId: string, targetPlayerId?: string, targetCardGuess?: string) => void;
  export let onChancellorReturn: ((cardsToReturn: string[]) => void) | undefined = undefined;
  export let onStartRound: () => void;
  export let onPlayAgain: (() => void) | undefined = undefined;
  export let isHost: boolean = false;
  export let onSendChat: ((text: string) => void) | undefined = undefined;

  // Local state
  let selectedCard: string | null = null;
  let selectingTarget: boolean = false;
  let selectingGuess: boolean = false;
  let pendingCardId: string | null = null;
  let pendingTargetId: string | null = null;
  let chancellorSelectedIndices: number[] = [];  // Track by index to handle duplicate cards

  // Pause countdown state
  let now = Date.now();
  let pauseIntervalId: ReturnType<typeof setInterval> | null = null;

  // Get state from store for reactivity
  $: gameState = $gameStateStore;
  $: revealed = $revealedCard;
  $: localPlayer = gameState?.players.find(p => p.id === localPlayerId);
  $: isMyTurn = gameState?.players[gameState?.activePlayerIndex]?.id === localPlayerId;
  $: activePlayer = gameState?.players[gameState?.activePlayerIndex];
  $: opponents = gameState?.players.filter(p => p.id !== localPlayerId) || [];
  $: canPlay = isMyTurn && gameState?.phase === 'WAITING_FOR_ACTION';
  $: isChancellorPhase = gameState?.phase === 'CHANCELLOR_RESOLVING' && isMyTurn;
  $: tokensToWin = getTokensToWin(gameState?.players.length || 2);
  // Calculate how many cards need to be returned in Chancellor phase (hand size - 1)
  $: chancellorCardsToReturnCount = isChancellorPhase && localPlayer ? localPlayer.hand.length - 1 : 2;

  // Pause mechanic reactive values
  $: pauseReason = gameState?.pauseReason;
  $: pausedUntil = gameState?.pausedUntil;
  $: secondsRemaining = pausedUntil ? Math.max(0, Math.ceil((pausedUntil - now) / 1000)) : 0;
  $: isPaused = pausedUntil && secondsRemaining > 0;

  // Start/stop interval based on pause state
  $: {
    if (pausedUntil && pausedUntil > now) {
      // Start interval if not already running
      if (!pauseIntervalId) {
        pauseIntervalId = setInterval(() => {
          now = Date.now();
        }, 100);
      }
    } else {
      // Clear interval if running
      if (pauseIntervalId) {
        clearInterval(pauseIntervalId);
        pauseIntervalId = null;
      }
    }
  }

  onMount(() => {
    now = Date.now();
  });

  onDestroy(() => {
    if (pauseIntervalId) {
      clearInterval(pauseIntervalId);
    }
  });

  function getTokensToWin(playerCount: number): number {
    const map: Record<number, number> = { 2: 6, 3: 5, 4: 4, 5: 3, 6: 3 };
    return map[playerCount] || 4;
  }
  
  function toggleChancellorCard(cardIndex: number) {
    if (!isChancellorPhase) return;
    
    const indexInSelection = chancellorSelectedIndices.indexOf(cardIndex);
    if (indexInSelection === -1) {
      // Only allow selecting up to the required number of cards
      if (chancellorSelectedIndices.length < chancellorCardsToReturnCount) {
        chancellorSelectedIndices = [...chancellorSelectedIndices, cardIndex];
      }
    } else {
      chancellorSelectedIndices = chancellorSelectedIndices.filter(i => i !== cardIndex);
    }
  }
  
  function confirmChancellorReturn() {
    if (chancellorSelectedIndices.length !== chancellorCardsToReturnCount || !onChancellorReturn || !localPlayer) return;
    // Validate indices are still valid for current hand
    const hand = localPlayer.hand;
    if (chancellorSelectedIndices.some(i => i < 0 || i >= hand.length)) {
      chancellorSelectedIndices = [];
      return;
    }
    // Convert indices back to card IDs for the callback
    const cardsToReturn = chancellorSelectedIndices.map(i => hand[i]);
    onChancellorReturn(cardsToReturn);
    chancellorSelectedIndices = [];
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
      {:else if gameState.phase === 'CHANCELLOR_RESOLVING'}
        {#if isMyTurn}
          📜 Select 2 cards to return
        {:else}
          {activePlayer?.name} is using Chancellor
        {/if}
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
        {#if isHost && onPlayAgain}
          <button class="play-again-btn" on:click={onPlayAgain}>
            🔄 Play Again
          </button>
        {:else if !isHost}
          <p class="waiting-restart">Waiting for host to restart...</p>
        {/if}
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
    
    {#if isChancellorPhase}
      <div class="chancellor-modal">
        <div class="chancellor-content">
          <h3>📜 Chancellor Effect</h3>
          <p>Select {chancellorCardsToReturnCount} card{chancellorCardsToReturnCount !== 1 ? 's' : ''} to return to the deck bottom.</p>
          {#if chancellorCardsToReturnCount > 1}
            <p class="chancellor-order-hint">
              First selected → very bottom | Second selected → above it
            </p>
          {/if}
          <div class="chancellor-selected-list">
            {#if chancellorSelectedIndices.length > 1 && localPlayer}
              <div class="selected-card-item">
                <span class="position-badge">⬆️ 2nd</span>
                <span class="selected-card-name">{getCardDefinition(localPlayer.hand[chancellorSelectedIndices[1]])?.name}</span>
              </div>
            {/if}
            {#if chancellorSelectedIndices.length > 0 && localPlayer}
              <div class="selected-card-item bottom-card">
                <span class="position-badge">⬇️ Bottom</span>
                <span class="selected-card-name">{getCardDefinition(localPlayer.hand[chancellorSelectedIndices[0]])?.name}</span>
              </div>
            {/if}
          </div>
          <p class="selected-count">Selected: {chancellorSelectedIndices.length}/{chancellorCardsToReturnCount}</p>
          {#if chancellorSelectedIndices.length === chancellorCardsToReturnCount}
            <button class="confirm-chancellor-btn" on:click={confirmChancellorReturn}>
              Confirm Return
            </button>
          {/if}
        </div>
      </div>
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

    <!-- Discard pile moved above the hand to prevent UI jumping -->
    <div class="discard-pile" class:has-cards={localPlayer?.discardPile && localPlayer.discardPile.length > 0}>
      <span class="discard-label">Discarded:</span>
      {#if localPlayer?.discardPile && localPlayer.discardPile.length > 0}
        {#each localPlayer.discardPile as cardId}
          <span class="discarded-card">{getCardDefinition(cardId)?.name}</span>
        {/each}
      {:else}
        <span class="no-discards">None</span>
      {/if}
    </div>

    <div class="hand" class:chancellor-mode={isChancellorPhase}>
      {#each localPlayer?.hand || [] as cardId, index}
        <Card 
          {cardId}
          isSelected={isChancellorPhase ? chancellorSelectedIndices.includes(index) : selectedCard === cardId}
          isPlayable={canPlay || isChancellorPhase}
          onClick={() => isChancellorPhase ? toggleChancellorCard(index) : selectCard(cardId)}
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
  </div>

  <!-- Game Feed overlay for log messages -->
  <GameFeed logs={gameState.logs} />

  <!-- Game menu (log + chat) -->
  <GameMenu logs={gameState.logs} {onSendChat} />
  
  <!-- Card reveal modal (for Priest) - only show to the player who played Priest -->
  {#if revealed && revealed.viewerPlayerId === localPlayerId}
    <CardReveal 
      cardId={revealed.cardId}
      playerName={revealed.playerName}
      onDismiss={clearRevealedCard}
    />
  {/if}
  
  <!-- Elimination modal - show when local player is eliminated -->
  <EliminationModal player={localPlayer} />

  <!-- Pause overlay - show during timed pauses -->
  {#if isPaused}
    <div class="pause-overlay">
      <div class="pause-content">
        <h2 class="pause-reason">{pauseReason}</h2>
        <div class="pause-timer">{secondsRemaining}</div>
        <p class="pause-message">Game resumes shortly...</p>
      </div>
    </div>
  {/if}
</div>
{:else}
  <div class="loading-screen">
    <p>Loading game...</p>
  </div>
{/if}

<style>
  .loading-screen {
    height: 100dvh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
    color: white;
    box-sizing: border-box;
  }

  .game-screen {
    height: 100dvh;
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
    display: flex;
    flex-direction: column;
    padding: 1rem;
    padding-bottom: env(safe-area-inset-bottom, 1rem);
    color: white;
    box-sizing: border-box;
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

  .play-again-btn {
    margin-top: 1rem;
    padding: 0.75rem 1.5rem;
    font-size: 1rem;
    font-weight: 600;
    background: rgba(255, 255, 255, 0.9);
    color: #f12711;
    border: none;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.3s ease;
  }

  .play-again-btn:hover {
    background: white;
    transform: scale(1.05);
  }

  .waiting-restart {
    margin-top: 1rem;
    font-size: 0.9rem;
    color: rgba(255, 255, 255, 0.8);
    font-style: italic;
  }

  /* Chancellor modal */
  .chancellor-modal {
    background: rgba(0, 0, 0, 0.5);
    padding: 1.5rem;
    border-radius: 16px;
    backdrop-filter: blur(10px);
    border: 2px solid rgba(142, 68, 173, 0.5);
    animation: modal-pop 0.3s ease-out;
  }

  .chancellor-content {
    text-align: center;
    color: white;
  }

  .chancellor-content h3 {
    margin: 0 0 0.5rem 0;
    font-size: 1.3rem;
  }

  .chancellor-content p {
    margin: 0 0 1rem 0;
    color: rgba(255, 255, 255, 0.8);
  }

  .selected-count {
    font-weight: 600;
    color: #8e44ad !important;
  }

  .chancellor-order-hint {
    font-size: 0.85rem;
    color: rgba(255, 255, 255, 0.6) !important;
    margin-bottom: 0.75rem !important;
  }

  .chancellor-selected-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
    min-height: 70px;
  }

  .selected-card-item {
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
  }

  .selected-card-name {
    font-weight: 500;
  }

  .confirm-chancellor-btn {
    padding: 0.75rem 2rem;
    font-size: 1rem;
    font-weight: 600;
    background: linear-gradient(135deg, #8e44ad 0%, #9b59b6 100%);
    color: white;
    border: none;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.3s ease;
    margin-top: 0.5rem;
  }

  .confirm-chancellor-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 15px rgba(142, 68, 173, 0.4);
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

  .hand.chancellor-mode {
    border: 2px dashed rgba(142, 68, 173, 0.5);
    border-radius: 12px;
    padding: 0.5rem;
    background: rgba(142, 68, 173, 0.1);
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
    margin-bottom: 0.75rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    min-height: 32px;
  }

  .discard-label {
    font-size: 0.9rem;
    color: rgba(255, 255, 255, 0.6);
  }

  .no-discards {
    font-size: 0.8rem;
    color: rgba(255, 255, 255, 0.4);
    font-style: italic;
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
      margin-bottom: 0.5rem;
      padding-bottom: 0.5rem;
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

  /* Pause overlay styles */
  .pause-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.75);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    backdrop-filter: blur(5px);
    animation: fade-in 0.3s ease-out;
  }

  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .pause-content {
    text-align: center;
    padding: 2rem 3rem;
    background: linear-gradient(135deg, rgba(26, 26, 46, 0.95) 0%, rgba(22, 33, 62, 0.95) 100%);
    border-radius: 20px;
    border: 2px solid rgba(102, 126, 234, 0.5);
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
    animation: pop-in 0.3s ease-out;
  }

  @keyframes pop-in {
    0% { transform: scale(0.8); opacity: 0; }
    100% { transform: scale(1); opacity: 1; }
  }

  .pause-reason {
    margin: 0 0 1rem 0;
    font-size: 1.5rem;
    font-weight: 700;
    color: #f5af19;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .pause-timer {
    font-size: 4rem;
    font-weight: 700;
    color: white;
    line-height: 1;
    margin-bottom: 1rem;
    animation: pulse-timer 1s ease-in-out infinite;
  }

  @keyframes pulse-timer {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.1); }
  }

  .pause-message {
    margin: 0;
    font-size: 1rem;
    color: rgba(255, 255, 255, 0.7);
    font-style: italic;
  }

  /* Mobile responsive styles for pause overlay */
  @media (max-width: 480px) {
    .pause-content {
      padding: 1.5rem 2rem;
      margin: 1rem;
    }

    .pause-reason {
      font-size: 1.2rem;
    }

    .pause-timer {
      font-size: 3rem;
    }

    .pause-message {
      font-size: 0.9rem;
    }
  }
</style>
