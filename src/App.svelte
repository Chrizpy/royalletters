<script lang="ts">
  import LobbyScreen from './lib/components/LobbyScreen.svelte';
  import HostLobby from './lib/components/HostLobby.svelte';
  import JoinGame from './lib/components/JoinGame.svelte';
  import ConnectionStatus from './lib/components/ConnectionStatus.svelte';
  import { isHost, connectionState } from './lib/stores/network';

  // Routing state
  type Screen = 'lobby' | 'host' | 'join' | 'game';
  let currentScreen: Screen = 'lobby';

  // Subscribe to network stores to determine routing
  $: {
    if ($isHost === true && currentScreen === 'lobby') {
      currentScreen = 'host';
    } else if ($isHost === false && currentScreen === 'lobby') {
      currentScreen = 'join';
    }
  }
</script>

<main>
  <ConnectionStatus />

  {#if currentScreen === 'lobby'}
    <LobbyScreen />
  {:else if currentScreen === 'host'}
    <HostLobby />
  {:else if currentScreen === 'join'}
    <JoinGame />
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
