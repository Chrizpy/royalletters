<script lang="ts">
  import { onMount } from 'svelte';
  import LobbyScreen from './lib/components/LobbyScreen.svelte';
  import HostLobby from './lib/components/HostLobby.svelte';
  import JoinGame from './lib/components/JoinGame.svelte';
  import RejoinPrompt from './lib/components/RejoinPrompt.svelte';
  import ConnectionStatus from './lib/components/ConnectionStatus.svelte';
  import { isHost, connectionState } from './lib/stores/network';
  import { gameStarted } from './lib/stores/game';
  import { loadSession, type GameSession } from './lib/stores/session';

  // Routing state
  type Screen = 'lobby' | 'host' | 'join' | 'game' | 'rejoin';
  let currentScreen: Screen = 'lobby';
  let pendingSession: GameSession | null = null;

  // Check for saved session on mount
  onMount(() => {
    const session = loadSession();
    if (session) {
      pendingSession = session;
      currentScreen = 'rejoin';
    }
  });

  // Subscribe to network stores to determine routing
  $: {
    // Don't override rejoin screen unless explicitly dismissed
    if (currentScreen !== 'rejoin') {
      if ($isHost === true) {
        currentScreen = 'host';
      } else if ($isHost === false) {
        currentScreen = 'join';
      } else {
        // isHost is null, show lobby
        currentScreen = 'lobby';
      }
    }
  }

  function handleDismissRejoin() {
    pendingSession = null;
    currentScreen = 'lobby';
  }

  // Only show connection status when not in game and not on rejoin screen
  $: showConnectionStatus = !$gameStarted && currentScreen !== 'rejoin';
</script>

<main>
  {#if showConnectionStatus}
    <ConnectionStatus />
  {/if}

  {#if currentScreen === 'rejoin' && pendingSession}
    <RejoinPrompt session={pendingSession} onDismiss={handleDismissRejoin} />
  {:else if currentScreen === 'lobby'}
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
    height: 100dvh;
  }

  .game-screen {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
  }
</style>
