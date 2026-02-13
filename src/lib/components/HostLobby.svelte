<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { gameState, gameStarted } from '../stores/game';
  import {
    hostPeerId,
    hostError,
    hostConnectionState,
    hostPlayers,
    hostQrCodeDataUrl,
    initializeHost,
    handleStartGame as storeStartGame,
    handleHostPlayCard,
    handleHostChancellorReturn,
    handleHostRevengeGuess,
    handleHostStartRound,
    handleHostPlayAgain,
    sendHostChat,
    syncAIPlayers,
    setAIMoveDelay,
    cleanupHost,
    handleHostBack,
  } from '../stores/hostGame';
  import GameScreen from './GameScreen.svelte';
  import type { Ruleset } from '../types';
  import { getTokensToWin } from '../engine/constants';

  // UI-only local state
  let hostName = $state('Host');
  let selectedRuleset = $state<Ruleset>('house');
  let aiMoveDelayMs = $state(2000);
  let aiCount = $state(0);
  let showAIOptions = $state(false);
  let tokensToWin = $state<number | null>(null);
  let hasCustomTokens = $state(false);
  let linkCopied = $state(false);

  // Derived from stores
  let players = $derived($hostPlayers);
  let generatedPeerId = $derived($hostPeerId);
  let error = $derived($hostError);
  let localConnectionState = $derived($hostConnectionState);
  let qrCodeDataUrl = $derived($hostQrCodeDataUrl);

  // Max players depends on ruleset: classic = 4, 2019/house = 6
  let maxPlayers = $derived(
    selectedRuleset === '2019' || selectedRuleset === 'house' ? 6 : 4,
  );

  // Total players including host
  let totalPlayers = $derived(players.length + 1);

  // Default tokens for current player count
  let defaultTokens = $derived(getTokensToWin(totalPlayers));

  // Update tokensToWin when player count changes (only if user hasn't customized)
  $effect(() => {
    if (!hasCustomTokens) {
      tokensToWin = defaultTokens;
    }
  });

  // Effective tokens value (use custom or default)
  let effectiveTokens = $derived(tokensToWin ?? defaultTokens);

  // Count of human players (non-AI, excluding host)
  let humanPlayerCount = $derived(players.filter((p) => !p.isAI).length);

  // Available slots for AI after accounting for humans
  let availableAISlots = $derived(maxPlayers - 1 - humanPlayerCount);

  // Subscribe to game started state
  let inGame = $derived($gameStarted);

  onMount(() => {
    initializeHost();
  });

  onDestroy(() => {
    cleanupHost();
  });

  function handleStartGame() {
    storeStartGame(hostName, players, selectedRuleset, effectiveTokens);
  }

  function handlePlayCard(
    cardId: string,
    targetPlayerId?: string,
    targetCardGuess?: string,
  ) {
    handleHostPlayCard(cardId, targetPlayerId, targetCardGuess);
  }

  function handleChancellorReturn(cardsToReturn: string[]) {
    handleHostChancellorReturn(cardsToReturn);
  }

  function handleRevengeGuess(targetCardGuess: string) {
    handleHostRevengeGuess(targetCardGuess);
  }

  function handleStartRound() {
    handleHostStartRound();
  }

  function handlePlayAgain() {
    handleHostPlayAgain(hostName, players, selectedRuleset, effectiveTokens);
  }

  // Handle AI count slider change
  function handleAICountChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const newCount = Math.min(parseInt(target.value, 10), availableAISlots);
    aiCount = newCount;
    syncAIPlayers(newCount);
  }

  // Keep AI delay in sync with the store
  $effect(() => {
    setAIMoveDelay(aiMoveDelayMs);
  });

  // Clamp aiCount when human players join (reduces available AI slots)
  $effect(() => {
    if (aiCount > availableAISlots) {
      aiCount = availableAISlots;
      syncAIPlayers(aiCount);
    }
  });

  // Handle AI options toggle - add 1 AI when enabled, remove all when disabled
  $effect(() => {
    if (showAIOptions && aiCount === 0) {
      aiCount = 1;
      syncAIPlayers(1);
    } else if (!showAIOptions && aiCount > 0) {
      aiCount = 0;
      syncAIPlayers(0);
    }
  });

  function handleSendChat(text: string) {
    sendHostChat(text, hostName);
  }

  function handleBack() {
    handleHostBack();
  }

  async function shareJoinLink() {
    const joinUrl = `${window.location.origin}${window.location.pathname}?join=${generatedPeerId}`;

    // Use Web Share API on mobile if available
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join my Royal Letters game!',
          text: 'Tap this link to join my game:',
          url: joinUrl,
        });
        return;
      } catch {
        // User cancelled or share failed – fall through to clipboard
      }
    }

    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(joinUrl);
      linkCopied = true;
      setTimeout(() => (linkCopied = false), 2000);
    } catch {
      // Very old browsers – prompt user
      window.prompt('Copy this join link:', joinUrl);
    }
  }
</script>

{#if inGame && $gameState}
  <GameScreen
    localPlayerId={generatedPeerId}
    onPlayCard={handlePlayCard}
    onChancellorReturn={handleChancellorReturn}
    onRevengeGuess={handleRevengeGuess}
    onStartRound={handleStartRound}
    onPlayAgain={handlePlayAgain}
    onSendChat={handleSendChat}
    isHost={true}
  />
{:else}
  <div class="host-lobby">
    <div class="host-container">
      <h2>Host Game</h2>

      {#if error}
        <div class="error">{error}</div>
      {/if}

      {#if localConnectionState === 'connected' && qrCodeDataUrl}
        <div class="qr-section">
          <p class="instruction">Scan this QR code to join:</p>
          <div class="qr-code">
            <img src={qrCodeDataUrl} alt="QR Code" />
          </div>

          <div class="peer-id-section">
            <p class="peer-id-label">Or enter this code manually:</p>
            <div class="peer-id-display">{generatedPeerId}</div>
          </div>

          <button
            class="share-link-btn"
            class:copied={linkCopied}
            onclick={shareJoinLink}
          >
            {#if linkCopied}
              Link Copied!
            {:else}
              Share Join Link
            {/if}
          </button>
        </div>

        <div class="ruleset-section">
          <label for="ruleset">Game Edition:</label>
          <select
            id="ruleset"
            bind:value={selectedRuleset}
            class="ruleset-select"
          >
            <option value="classic">Classic (16 cards)</option>
            <option value="2019">2019 Edition (21 cards)</option>
            <option value="house">House Rules (21 cards)</option>
          </select>
          <p class="ruleset-hint">
            {#if selectedRuleset === '2019'}
              Includes Spy and Chancellor cards with new mechanics!
            {:else if selectedRuleset === 'house'}
              2019 Edition with custom rules: King swaps with burned card when
              no targets!
            {:else}
              The original Love Letter experience.
            {/if}
          </p>
        </div>

        <div class="tokens-section">
          <label for="tokens-to-win">Tokens to Win:</label>
          <div class="tokens-controls">
            <input
              id="tokens-to-win"
              type="range"
              min="1"
              max="10"
              step="1"
              bind:value={tokensToWin}
              oninput={() => (hasCustomTokens = true)}
              class="tokens-slider"
            />
            <span class="tokens-value">{effectiveTokens}</span>
          </div>
          <p class="tokens-hint">
            {#if effectiveTokens === defaultTokens}
              Default for {totalPlayers} players
            {:else if effectiveTokens < defaultTokens}
              Shorter game
            {:else}
              Longer game
            {/if}
            <button
              class="reset-tokens-btn"
              onclick={() => {
                hasCustomTokens = false;
                tokensToWin = defaultTokens;
              }}
              disabled={!hasCustomTokens}
            >
              Reset
            </button>
          </p>
        </div>

        <div class="ai-options-section">
          <label class="ai-toggle">
            <input type="checkbox" bind:checked={showAIOptions} />
            <span class="ai-toggle-label">🤖 Add AI Players</span>
          </label>

          {#if showAIOptions}
            <div class="ai-options-content">
              <div class="ai-option">
                <label for="ai-count">Number of AI:</label>
                <div class="ai-slider-controls">
                  <input
                    type="range"
                    id="ai-count"
                    class="ai-count-slider"
                    min="1"
                    max={availableAISlots}
                    bind:value={aiCount}
                    oninput={handleAICountChange}
                  />
                  <span class="ai-count-value">{aiCount}</span>
                </div>
              </div>

              <div class="ai-option">
                <label for="ai-delay">AI Speed:</label>
                <div class="ai-slider-controls">
                  <input
                    id="ai-delay"
                    type="range"
                    min="500"
                    max="5000"
                    step="250"
                    bind:value={aiMoveDelayMs}
                    class="ai-delay-slider"
                  />
                  <span class="ai-delay-value"
                    >{(aiMoveDelayMs / 1000).toFixed(1)}s</span
                  >
                </div>
              </div>

              <p class="ai-options-hint">
                {#if aiMoveDelayMs <= 1000}
                  ⚡ Fast pace
                {:else if aiMoveDelayMs <= 2500}
                  🎯 Normal pace
                {:else}
                  🐢 Slow pace
                {/if}
              </p>
            </div>
          {/if}
        </div>

        <div class="name-section">
          <label for="host-name">Your Name:</label>
          <input
            id="host-name"
            type="text"
            bind:value={hostName}
            placeholder="Enter your name"
            class="name-input"
          />
        </div>

        <div class="button-group">
          <button
            class="start-btn"
            onclick={handleStartGame}
            disabled={players.length === 0}
          >
            Start Game
          </button>
          <button class="back-btn" onclick={handleBack}>Cancel</button>
        </div>

        <div class="players-section">
          <h3>Players ({players.length + 1}/{maxPlayers})</h3>
          <div class="player-list">
            <div class="player-item host">
              <span class="player-icon">👑</span>
              <span class="player-name">{hostName} (You)</span>
            </div>
            {#each players as player (player.id)}
              <div class="player-item" class:ai={player.isAI}>
                <span class="player-icon">{player.isAI ? '🤖' : '👤'}</span>
                <span class="player-name">{player.name}</span>
              </div>
            {/each}
          </div>

          {#if players.length === 0}
            <p class="waiting">
              Waiting for players to join or add AI opponents...
            </p>
          {/if}
        </div>
      {:else}
        <div class="loading">
          <div class="spinner"></div>
          <p>Setting up host...</p>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .host-lobby {
    display: flex;
    justify-content: center;
    align-items: flex-start;
    height: 100dvh;
    background:
      radial-gradient(ellipse at top, rgba(139, 0, 0, 0.3) 0%, transparent 50%),
      linear-gradient(135deg, #2c0a0a 0%, #1a0505 50%, #0d0202 100%);
    padding: 1rem;
    box-sizing: border-box;
    overflow-y: auto;
  }

  .host-container {
    background: linear-gradient(135deg, #fdf6e3 0%, #f5e6c8 100%);
    border-radius: 16px;
    padding: 1.5rem;
    max-width: 500px;
    width: 100%;
    box-shadow:
      0 10px 40px rgba(0, 0, 0, 0.4),
      0 0 30px rgba(212, 166, 74, 0.15);
    margin-top: 1rem;
    margin-bottom: 1rem;
    border: 2px solid #d4a64a;
  }

  h2 {
    text-align: center;
    color: #2c1810;
    margin-bottom: 2rem;
    text-shadow: 1px 1px 0 rgba(255, 255, 255, 0.5);
  }

  .error {
    background: #5c1515;
    color: #ffcccc;
    padding: 1rem;
    border-radius: 8px;
    margin-bottom: 1rem;
    border: 1px solid #8b2020;
  }

  .name-section {
    margin-bottom: 1.5rem;
  }

  .name-section label {
    display: block;
    font-weight: 500;
    color: #2c1810;
    margin-bottom: 0.5rem;
  }

  .name-input {
    width: 100%;
    padding: 0.75rem 1rem;
    border: 2px solid #c4a574;
    border-radius: 8px;
    font-size: 1rem;
    font-family: inherit;
    box-sizing: border-box;
    transition:
      border-color 0.3s ease,
      box-shadow 0.3s ease;
    background: #fffef9;
    color: #2c1810;
  }

  .name-input:focus {
    outline: none;
    border-color: #d4a64a;
    box-shadow: 0 0 8px rgba(212, 166, 74, 0.4);
  }

  .ruleset-section {
    margin-bottom: 1.5rem;
  }

  .ruleset-section label {
    display: block;
    font-weight: 500;
    color: #2c1810;
    margin-bottom: 0.5rem;
  }

  .ruleset-select {
    width: 100%;
    padding: 0.75rem 1rem;
    border: 2px solid #c4a574;
    border-radius: 8px;
    font-size: 1rem;
    font-family: inherit;
    box-sizing: border-box;
    transition:
      border-color 0.3s ease,
      box-shadow 0.3s ease;
    background: #fffef9;
    cursor: pointer;
    color: #2c1810;
  }

  .ruleset-select:focus {
    outline: none;
    border-color: #d4a64a;
    box-shadow: 0 0 8px rgba(212, 166, 74, 0.4);
  }

  .ruleset-hint {
    margin-top: 0.5rem;
    font-size: 0.85rem;
    color: #5c4033;
    font-style: italic;
  }

  .ai-options-section {
    margin-bottom: 1.5rem;
    border: 2px solid #c4a574;
    border-radius: 8px;
    overflow: hidden;
  }

  .ai-toggle {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: #f5e6c8;
    cursor: pointer;
    user-select: none;
  }

  .ai-toggle input[type='checkbox'] {
    width: 18px;
    height: 18px;
    accent-color: #8b2020;
    cursor: pointer;
  }

  .ai-toggle-label {
    font-weight: 500;
    color: #2c1810;
  }

  .ai-options-content {
    padding: 1rem;
    background: #faf3e0;
    border-top: 1px solid #c4a574;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .ai-option {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .ai-option label {
    font-weight: 500;
    color: #5c4033;
    font-size: 0.9rem;
  }

  .ai-slider-controls {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .ai-options-hint {
    font-size: 0.85rem;
    color: #5c4033;
    margin: 0;
    text-align: center;
  }

  .ai-count-slider {
    flex: 1;
    height: 8px;
    border-radius: 4px;
    background: #e5d5b5;
    outline: none;
    -webkit-appearance: none;
    appearance: none;
  }

  .ai-count-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: linear-gradient(135deg, #8b2020 0%, #6b1515 100%);
    cursor: pointer;
    border: 2px solid #fdf6e3;
    box-shadow: 0 2px 6px rgba(139, 32, 32, 0.4);
  }

  .ai-count-slider::-moz-range-thumb {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: linear-gradient(135deg, #8b2020 0%, #6b1515 100%);
    cursor: pointer;
    border: 2px solid #fdf6e3;
    box-shadow: 0 2px 6px rgba(139, 32, 32, 0.4);
  }

  .ai-count-value {
    font-weight: 600;
    color: #8b2020;
    min-width: 24px;
    text-align: center;
  }

  .ai-delay-slider {
    flex: 1;
    height: 8px;
    border-radius: 4px;
    background: #e5d5b5;
    outline: none;
    -webkit-appearance: none;
    appearance: none;
  }

  .ai-delay-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: linear-gradient(135deg, #8b2020 0%, #6b1515 100%);
    cursor: pointer;
    border: 2px solid #fdf6e3;
    box-shadow: 0 2px 6px rgba(139, 32, 32, 0.4);
  }

  .ai-delay-slider::-moz-range-thumb {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: linear-gradient(135deg, #8b2020 0%, #6b1515 100%);
    cursor: pointer;
    border: 2px solid #fdf6e3;
    box-shadow: 0 2px 6px rgba(139, 32, 32, 0.4);
  }

  .ai-delay-value {
    font-weight: 600;
    color: #8b2020;
    min-width: 40px;
    text-align: right;
  }

  .tokens-section {
    margin-bottom: 1.5rem;
  }

  .tokens-section label {
    display: block;
    font-weight: 500;
    color: #2c1810;
    margin-bottom: 0.5rem;
  }

  .tokens-controls {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .tokens-slider {
    flex: 1;
    height: 8px;
    border-radius: 4px;
    background: #e5d5b5;
    outline: none;
    -webkit-appearance: none;
    appearance: none;
  }

  .tokens-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: linear-gradient(135deg, #d4a64a 0%, #b8923d 100%);
    cursor: pointer;
    border: 2px solid #fdf6e3;
    box-shadow: 0 2px 6px rgba(212, 166, 74, 0.4);
  }

  .tokens-slider::-moz-range-thumb {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: linear-gradient(135deg, #d4a64a 0%, #b8923d 100%);
    cursor: pointer;
    border: 2px solid #fdf6e3;
    box-shadow: 0 2px 6px rgba(212, 166, 74, 0.4);
  }

  .tokens-value {
    font-weight: 600;
    color: #b8923d;
    min-width: 24px;
    text-align: right;
  }

  .tokens-hint {
    margin-top: 0.5rem;
    font-size: 0.85rem;
    color: #5c4033;
    font-style: italic;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .reset-tokens-btn {
    background: none;
    border: 1px solid #c4a574;
    border-radius: 4px;
    padding: 0.2rem 0.5rem;
    font-size: 0.75rem;
    color: #5c4033;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .reset-tokens-btn:hover:not(:disabled) {
    border-color: #d4a64a;
    color: #d4a64a;
  }

  .reset-tokens-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .qr-section {
    text-align: center;
    margin-bottom: 2rem;
  }

  .instruction {
    font-size: 1.1rem;
    color: #5c4033;
    margin-bottom: 1rem;
  }

  .qr-code {
    display: flex;
    justify-content: center;
    margin-bottom: 1.5rem;
  }

  .qr-code img {
    border: 4px solid #d4a64a;
    border-radius: 12px;
    padding: 0.5rem;
    background: white;
    max-width: 200px;
    height: auto;
  }

  .peer-id-section {
    margin-top: 1.5rem;
  }

  .peer-id-label {
    font-size: 0.9rem;
    color: #5c4033;
    margin-bottom: 0.5rem;
  }

  .peer-id-display {
    font-family: monospace;
    font-size: 1.2rem;
    font-weight: 600;
    color: #8b2020;
    background: #faf3e0;
    padding: 0.75rem;
    border-radius: 8px;
    border: 2px solid #d4a64a;
  }

  .share-link-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    margin-top: 1rem;
    padding: 0.75rem 1rem;
    background: linear-gradient(135deg, #e8d5b0 0%, #d9c49a 100%);
    color: #3d2a22;
    border: 2px solid #c4a574;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
  }

  .share-link-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(212, 166, 74, 0.3);
    background: linear-gradient(135deg, #dcc89e 0%, #cdb78d 100%);
    border-color: #d4a64a;
  }

  .share-link-btn.copied {
    background: linear-gradient(135deg, #5c4033 0%, #3d2a22 100%);
    color: #d4a64a;
    border-color: #d4a64a;
  }

  .players-section {
    margin-bottom: 2rem;
  }

  .players-section h3 {
    color: #2c1810;
    margin-bottom: 1rem;
  }

  .player-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    max-height: 180px;
    overflow-y: auto;
    padding-right: 0.25rem;
  }

  .player-list::-webkit-scrollbar {
    width: 6px;
  }

  .player-list::-webkit-scrollbar-track {
    background: #f5e6c8;
    border-radius: 3px;
  }

  .player-list::-webkit-scrollbar-thumb {
    background: #c4a574;
    border-radius: 3px;
  }

  .player-list::-webkit-scrollbar-thumb:hover {
    background: #b8923d;
  }

  .player-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    background: #faf3e0;
    border-radius: 8px;
    border: 1px solid #e5d5b5;
  }

  .player-item.host {
    background: linear-gradient(135deg, #8b2020 0%, #6b1515 100%);
    color: #fdf6e3;
    border: none;
  }

  .player-icon {
    font-size: 1.5rem;
  }

  .player-name {
    font-weight: 500;
    flex: 1;
  }

  .player-item.ai {
    background: linear-gradient(135deg, #5c4033 0%, #3d2a22 100%);
    color: #fdf6e3;
    border: none;
  }

  .waiting {
    text-align: center;
    color: #8b7355;
    font-style: italic;
    margin-top: 1rem;
  }

  .button-group {
    display: flex;
    gap: 1rem;
  }

  .start-btn,
  .back-btn {
    flex: 1;
    padding: 1rem;
    border: none;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
  }

  .start-btn {
    background: linear-gradient(135deg, #8b2020 0%, #6b1515 100%);
    color: #fdf6e3;
    border: 2px solid #d4a64a;
  }

  .start-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(139, 32, 32, 0.4);
    background: linear-gradient(135deg, #a02828 0%, #8b2020 100%);
  }

  .start-btn:disabled {
    background: #c4a574;
    border-color: #c4a574;
    color: #8b7355;
    cursor: not-allowed;
  }

  .back-btn {
    background: #faf3e0;
    color: #5c4033;
    border: 2px solid #c4a574;
  }

  .back-btn:hover {
    background: #f5e6c8;
    border-color: #d4a64a;
  }

  .loading {
    text-align: center;
    padding: 2rem;
  }

  .spinner {
    border: 4px solid #f5e6c8;
    border-top: 4px solid #8b2020;
    border-radius: 50%;
    width: 40px;
    height: 40px;
    animation: spin 1s linear infinite;
    margin: 0 auto 1rem;
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
</style>
