<script lang="ts">
  import GameScreen from './GameScreen.svelte';
  import { GameEngine } from '../engine/game';
  import type { GameState } from '../types';

  // Props
  export let onBack: () => void;

  // Setup
  let engine = new GameEngine();
  let currentPlayerIndex = 0;
  let gameStarted = false;
  
  // Player setup
  let player1Name = 'Player 1';
  let player2Name = 'Player 2';
  let playerCount = 2;
  let player3Name = 'Player 3';
  let player4Name = 'Player 4';

  $: players = getPlayers();

  function getPlayers() {
    const result = [
      { id: 'p1', name: player1Name },
      { id: 'p2', name: player2Name },
    ];
    if (playerCount >= 3) result.push({ id: 'p3', name: player3Name });
    if (playerCount >= 4) result.push({ id: 'p4', name: player4Name });
    return result;
  }

  function startGame() {
    engine = new GameEngine();
    engine.init({ 
      players: getPlayers().map((p, i) => ({ ...p, isHost: i === 0 }))
    });
    engine.startRound();
    engine.drawPhase();
    currentPlayerIndex = 0;
    gameStarted = true;
  }

  function handlePlayCard(cardId: string, targetPlayerId?: string, targetCardGuess?: string) {
    const state = engine.getState();
    const activePlayer = state.players[state.activePlayerIndex];
    
    const result = engine.applyMove({
      type: 'PLAY_CARD',
      playerId: activePlayer.id,
      cardId,
      targetPlayerId,
      targetCardGuess
    });

    // Check game state after move
    const newState = engine.getState();
    
    if (newState.phase === 'TURN_START') {
      // Auto-draw for next player
      engine.drawPhase();
    }
    
    // Force refresh
    engine = engine;
  }

  function handleStartRound() {
    engine.startRound();
    engine.drawPhase();
    engine = engine;
  }

  function getCurrentPlayerId(): string {
    const state = engine.getState();
    return state.players[state.activePlayerIndex]?.id || 'p1';
  }

  function handleBackToSetup() {
    gameStarted = false;
    engine = new GameEngine();
  }
</script>

{#if !gameStarted}
  <div class="local-setup">
    <div class="setup-container">
      <h2>🎮 Local Game Setup</h2>
      <p class="subtitle">Play Love Letter on one device - pass the phone between players!</p>

      <div class="player-count">
        <span id="player-count-label">Number of players:</span>
        <div class="count-buttons" role="group" aria-labelledby="player-count-label">
          {#each [2, 3, 4] as count}
            <button 
              class="count-btn"
              class:active={playerCount === count}
              on:click={() => playerCount = count}
            >
              {count}
            </button>
          {/each}
        </div>
      </div>

      <div class="player-inputs">
        <div class="player-input">
          <label for="p1">Player 1:</label>
          <input id="p1" type="text" bind:value={player1Name} placeholder="Enter name" />
        </div>
        <div class="player-input">
          <label for="p2">Player 2:</label>
          <input id="p2" type="text" bind:value={player2Name} placeholder="Enter name" />
        </div>
        {#if playerCount >= 3}
          <div class="player-input">
            <label for="p3">Player 3:</label>
            <input id="p3" type="text" bind:value={player3Name} placeholder="Enter name" />
          </div>
        {/if}
        {#if playerCount >= 4}
          <div class="player-input">
            <label for="p4">Player 4:</label>
            <input id="p4" type="text" bind:value={player4Name} placeholder="Enter name" />
          </div>
        {/if}
      </div>

      <div class="button-group">
        <button class="start-btn" on:click={startGame}>Start Game</button>
        <button class="back-btn" on:click={onBack}>Back</button>
      </div>
    </div>
  </div>
{:else}
  <div class="local-game-wrapper">
    <button class="exit-btn" on:click={handleBackToSetup}>← Exit Game</button>
    <div class="current-player-banner">
      📱 {engine.getState().players[engine.getState().activePlayerIndex]?.name}'s turn - pass the device!
    </div>
    <GameScreen 
      {engine}
      localPlayerId={getCurrentPlayerId()}
      onPlayCard={handlePlayCard}
      onStartRound={handleStartRound}
      isHost={true}
    />
  </div>
{/if}

<style>
  .local-setup {
    min-height: 100vh;
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
  }

  .setup-container {
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    border: 2px solid rgba(255, 255, 255, 0.2);
    border-radius: 24px;
    padding: 2.5rem;
    max-width: 450px;
    width: 100%;
    color: white;
  }

  h2 {
    text-align: center;
    margin: 0 0 0.5rem 0;
    font-size: 1.8rem;
  }

  .subtitle {
    text-align: center;
    color: rgba(255, 255, 255, 0.7);
    margin-bottom: 2rem;
  }

  .player-count {
    margin-bottom: 1.5rem;
  }

  #player-count-label {
    display: block;
    margin-bottom: 0.75rem;
    font-weight: 500;
  }

  .count-buttons {
    display: flex;
    gap: 0.75rem;
  }

  .count-btn {
    flex: 1;
    padding: 0.75rem;
    background: rgba(255, 255, 255, 0.1);
    border: 2px solid rgba(255, 255, 255, 0.2);
    border-radius: 12px;
    color: white;
    font-size: 1.2rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
  }

  .count-btn:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  .count-btn.active {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-color: transparent;
  }

  .player-inputs {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .player-input {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .player-input label {
    font-weight: 500;
    font-size: 0.9rem;
  }

  .player-input input {
    padding: 0.75rem 1rem;
    background: rgba(255, 255, 255, 0.1);
    border: 2px solid rgba(255, 255, 255, 0.2);
    border-radius: 10px;
    color: white;
    font-size: 1rem;
    font-family: inherit;
    transition: all 0.3s ease;
  }

  .player-input input:focus {
    outline: none;
    border-color: #667eea;
    background: rgba(255, 255, 255, 0.15);
  }

  .player-input input::placeholder {
    color: rgba(255, 255, 255, 0.4);
  }

  .button-group {
    display: flex;
    gap: 1rem;
  }

  .start-btn, .back-btn {
    flex: 1;
    padding: 1rem;
    border: none;
    border-radius: 12px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
  }

  .start-btn {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
  }

  .start-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
  }

  .back-btn {
    background: rgba(255, 255, 255, 0.1);
    color: white;
    border: 2px solid rgba(255, 255, 255, 0.2);
  }

  .back-btn:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  /* Game wrapper */
  .local-game-wrapper {
    position: relative;
  }

  .exit-btn {
    position: fixed;
    top: 1rem;
    left: 1rem;
    z-index: 100;
    padding: 0.5rem 1rem;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    color: white;
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.3s ease;
  }

  .exit-btn:hover {
    background: rgba(0, 0, 0, 0.7);
  }

  .current-player-banner {
    position: fixed;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    z-index: 90;
    padding: 0.5rem 1.5rem;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 0 0 12px 12px;
    font-weight: 600;
    color: white;
    font-size: 0.9rem;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
  }
</style>
