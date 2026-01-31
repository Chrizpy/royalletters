<script lang="ts">
  import LobbyScreen from './lib/components/LobbyScreen.svelte';
  import HostLobby from './lib/components/HostLobby.svelte';
  import JoinGame from './lib/components/JoinGame.svelte';
  import LocalGame from './lib/components/LocalGame.svelte';
  import ConnectionStatus from './lib/components/ConnectionStatus.svelte';
  import { isHost, connectionState } from './lib/stores/network';

  // Routing state
  type Screen = 'lobby' | 'host' | 'join' | 'game' | 'local';
  let currentScreen: Screen = 'lobby';

  // Track if we're in local game mode
  let isLocalGame = false;

  // Subscribe to network stores to determine routing
  $: {
    if (isLocalGame) {
      currentScreen = 'local';
    } else if ($isHost === true) {
      currentScreen = 'host';
    } else if ($isHost === false) {
      currentScreen = 'join';
    } else {
      // isHost is null, show lobby
      currentScreen = 'lobby';
    }
  }

  function handleLocalPlay() {
    isLocalGame = true;
  }

  function handleBackFromLocal() {
    isLocalGame = false;
  }
</script>

<main>
  {#if !isLocalGame}
    <ConnectionStatus />
  {/if}

  {#if currentScreen === 'lobby'}
    <LobbyScreen onLocalPlay={handleLocalPlay} />
  {:else if currentScreen === 'host'}
    <HostLobby />
  {:else if currentScreen === 'join'}
    <JoinGame />
  {:else if currentScreen === 'local'}
    <LocalGame onBack={handleBackFromLocal} />
  {:else if currentScreen === 'game'}
    <div class="game-screen">
      <h1>Game Screen</h1>
      <p>Game will be displayed here when host starts the game</p>
    </div>
  {/if}
</main>

<style>
  main {
    width: 100%;
    min-height: 100vh;
  }

  .game-screen {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
  }
</style>
