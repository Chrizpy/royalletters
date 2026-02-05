<script lang="ts">
  import type { LogEntry, PlayerState } from '../types';

  interface FeedItem {
    id: number;
    message: string;
    timestamp: number;
    timeoutId: ReturnType<typeof setTimeout>;
    isFadingOut: boolean;
    actorId?: string;
  }

  interface PendingItem {
    log: LogEntry;
    addedAt: number;
  }

  export let logs: LogEntry[] = [];
  export let players: PlayerState[] = [];
  export let localPlayerId: string = '';
  
  // Color for the local player's actions (red to stand out)
  const LOCAL_PLAYER_COLOR = '#FF4444';

  const FEED_DISPLAY_TIME_MS = 5000;
  const FADE_OUT_DURATION_MS = 1000;
  const MAX_VISIBLE_ITEMS = 8;
  const STAGGER_DELAY_MS = 300; // Delay between each message appearing

  let feedItems: FeedItem[] = [];
  let pendingItems: PendingItem[] = [];
  let nextId = 0;
  let lastLogCount = 0;
  let processingInterval: ReturnType<typeof setInterval> | null = null;

  // Get player by ID
  function getPlayer(playerId: string | undefined): PlayerState | undefined {
    if (!playerId) return undefined;
    return players.find(p => p.id === playerId);
  }

  // Get the display color for an actor
  function getActorColor(actorId: string | undefined): string | null {
    if (!actorId) return null;
    
    // If this is the local player's action, use red
    if (actorId === localPlayerId) {
      return LOCAL_PLAYER_COLOR;
    }
    
    // Otherwise use the player's assigned color
    const player = getPlayer(actorId);
    return player?.color || null;
  }

  // Get the actor's name for display
  function getActorName(actorId: string | undefined): string | null {
    if (!actorId) return null;
    const player = getPlayer(actorId);
    return player?.name || null;
  }

  // Filter function to exclude verbose messages
  function shouldShowInFeed(message: string): boolean {
    const excludePatterns = [
      /drew.*card/i,          // Matches "drew a card", "drew 1 card", "drew 2 cards", etc.
      /returned.*card/i,      // Matches "returned 1 card", "returned 2 cards", etc.
      /Round.*started/i,      // Round start messages
      /Game initialized/i,    // Game initialization
      /Burned face-up/i,      // Burned card info
      /gained a token from Spy bonus/i,  // Spy bonus messages
      /drew a new card/i,     // "Drew a new card" from Prince effect
    ];
    
    return !excludePatterns.some(pattern => pattern.test(message));
  }

  // Condense messages into concise one-liners
  // Returns empty string for messages that should be filtered out or merged
  function condenseMessage(message: string, nextMessage?: string): string {
    // Pattern: "Player discarded CardName" (from Prince effect) -> filter out (will be merged with Prince play)
    // Exception: keep "discarded princess" (important for elimination context)
    const discardMatch = message.match(/^(.+?) discarded (.+?)$/);
    if (discardMatch && discardMatch[2].toLowerCase() !== 'princess') {
      return ''; // Empty string signals this message should be filtered
    }

    // Pattern: "Player was eliminated (had X)" -> filter (will be merged with Guard play)
    const elimGuardMatch = message.match(/^(.+?) was eliminated \(had (.+?)\)$/);
    if (elimGuardMatch) {
      return ''; // Will be merged with Guard play
    }
    
    // Pattern: "Player was eliminated (lower card)" -> filter (will be merged with Baron play)
    const elimBaronMatch = message.match(/^(.+?) was eliminated \(lower card\)$/);
    if (elimBaronMatch) {
      return ''; // Will be merged with Baron play
    }
    
    // Pattern: "Player was eliminated (other reasons)" -> "Player was eliminated"
    const elimOtherMatch = message.match(/^(.+?) was eliminated/);
    if (elimOtherMatch) {
      return `${elimOtherMatch[1]} was eliminated`;
    }

    // Pattern: "Player guessed Target had CardName (incorrectly)" OR "Player guessed CardName (incorrectly)"
    // -> filter (will be merged with Guard)
    const guessMatch = message.match(/^(.+?) guessed (.+?) had (.+?) \(incorrectly\)$/);
    const guessMatchOld = message.match(/^(.+?) guessed (.+?) \(incorrectly\)$/);
    if (guessMatch || guessMatchOld) {
      return ''; // Filter out, will be merged with Guard
    }

    // Pattern: "Player and Player traded hands" -> filter (will be merged with King)
    const tradeMatch = message.match(/^(.+?) and (.+?) traded hands$/);
    if (tradeMatch) {
      return ''; // Filter out, will be merged with King
    }

    // Pattern: "Player saw Player's hand" -> filter (will be merged with Priest)
    const sawMatch = message.match(/^(.+?) saw (.+?)'s hand$/);
    if (sawMatch) {
      return ''; // Filter out, will be merged with Priest
    }

    // Pattern: "Player swapped their card with the burned card" -> "Player swapped with burned card"
    if (message.includes('swapped their card with the burned card')) {
      const swapMatch = message.match(/^(.+?) swapped/);
      if (swapMatch) {
        return `${swapMatch[1]} swapped with burned card`;
      }
    }

    // Pattern: "Comparison was a tie" -> filter (will be merged with Baron)
    if (message === 'Comparison was a tie') {
      return ''; // Filter out, will be merged with Baron
    }

    // Pattern: "CardName had no effect (no valid targets)" -> "CardName fizzled"
    const fizzleMatch = message.match(/^(.+?) had no effect/);
    if (fizzleMatch) {
      return `${fizzleMatch[1]} fizzled`;
    }

    // Pattern: "Player played Guard on Target" - check next message for guess result
    const guardMatch = message.match(/^(.+?) played Guard on (.+?)$/);
    if (guardMatch && nextMessage) {
      const player = guardMatch[1];
      const target = guardMatch[2];
      
      // Check for incorrect guess
      const nextGuessMatch = nextMessage.match(/guessed .+? had (.+?) \(incorrectly\)$/);
      if (nextGuessMatch) {
        return `${player} played Guard on ${target}, guessed ${nextGuessMatch[1]}`;
      }
      
      // Check for elimination (correct guess)
      const nextElimMatch = nextMessage.match(/was eliminated \(had (.+?)\)$/);
      if (nextElimMatch) {
        return `${player} played Guard on ${target}, guessed ${nextElimMatch[1]} ✓`;
      }
    }
    
    // Fallback: Guard without target (all protected)
    const guardNoTargetMatch = message.match(/^(.+?) played Guard$/);
    if (guardNoTargetMatch) {
      return message;
    }
    
    // Pattern: "Player played Spy" - check if this is a duplicate
    // The game engine logs "Player played Spy" twice (once generic, once in applySpyBonus)
    // We want to filter out the second one
    const spyMatch = message.match(/^(.+?) played Spy$/);
    if (spyMatch && nextMessage) {
      // If the next message is also "X played Spy" from the same player, skip this one
      if (nextMessage === message) {
        return ''; // Filter out the duplicate
      }
    }

    // Pattern: "Player played Baron on Target" - check next for result
    const baronMatch = message.match(/^(.+?) played Baron on (.+?)$/);
    if (baronMatch && nextMessage) {
      const player = baronMatch[1];
      const target = baronMatch[2];
      const elim = nextMessage.match(/^(.+?) was eliminated \(lower card\)$/);
      if (elim) {
        if (elim[1] === player) {
          return `${player} played Baron on ${target} and lost`;
        } else {
          return `${player} played Baron on ${target} and won`;
        }
      }
      if (nextMessage === 'Comparison was a tie') {
        return `${player} played Baron on ${target} — tie`;
      }
    }
    
    // Fallback: Baron without target (all protected)
    const baronNoTargetMatch = message.match(/^(.+?) played Baron$/);
    if (baronNoTargetMatch) {
      return message;
    }

    // Pattern: "Player played Priest on Target" - already has target info
    const priestMatch = message.match(/^(.+?) played Priest on (.+?)$/);
    if (priestMatch) {
      return `${priestMatch[1]} played Priest on ${priestMatch[2]}`;
    }
    
    // Fallback: Priest without target (all protected)
    const priestNoTargetMatch = message.match(/^(.+?) played Priest$/);
    if (priestNoTargetMatch) {
      return message;
    }

    // Pattern: "Player played King on Target" - already has target info
    const kingMatch = message.match(/^(.+?) played King on (.+?)$/);
    if (kingMatch) {
      return `${kingMatch[1]} ↔ ${kingMatch[2]}`;
    }
    
    // Fallback: King without target (swapped with burned card or all protected)
    const kingNoTargetMatch = message.match(/^(.+?) played King$/);
    if (kingNoTargetMatch) {
      return message;
    }

    // Pattern: "Player played Prince on Target" - handle self-target specially
    const princeMatch = message.match(/^(.+?) played Prince on (.+?)$/);
    if (princeMatch) {
      const player = princeMatch[1];
      const target = princeMatch[2];
      if (player === target) {
        return `${player} played Prince on self`;
      }
      return `${player} played Prince on ${target}`;
    }
    
    // Fallback: Prince without target (shouldn't happen, but handle gracefully)
    const princeNoTargetMatch = message.match(/^(.+?) played Prince$/);
    if (princeNoTargetMatch) {
      return message;
    }

    // Pattern: "Player played Spy" - keep as-is (bonus message already filtered)
    if (message.match(/^(.+?) played Spy$/)) {
      return message;
    }

    // Patterns to keep as-is (already concise)
    const keepAsIsPatterns = [
      /played/,              // "Player played CardName" (for cards not handled above)
      /won with/,            // "Player won with Card (value)!"
      /tied with/,           // "Player and Player tied with Card (value)!"
      /won the game/,        // "Player won the game!"
      /Round ended/          // "Round ended in a tie"
    ];
    
    if (keepAsIsPatterns.some(pattern => pattern.test(message))) {
      return message;
    }

    // Default: return as is
    return message;
  }

  // Start fade out animation, then remove
  function startFadeOut(itemId: number) {
    // First set the flag to trigger the fade animation
    feedItems = feedItems.map(f => 
      f.id === itemId ? { ...f, isFadingOut: true } : f
    );
    
    // Remove after fade animation completes
    setTimeout(() => {
      feedItems = feedItems.filter(f => f.id !== itemId);
    }, FADE_OUT_DURATION_MS);
  }

  // Process pending items one at a time
  function processPendingItems() {
    if (pendingItems.length > 0) {
      const current = pendingItems.shift()!;
      const nextMessage = pendingItems.length > 0 ? pendingItems[0].log.message : undefined;
      
      const condensed = condenseMessage(current.log.message, nextMessage);
      
      // Skip if message was condensed to empty string (intentionally filtered or merged)
      if (condensed) {
        const itemId = nextId++;
        
        // Schedule fade out after display time
        const timeoutId = setTimeout(() => {
          startFadeOut(itemId);
        }, FEED_DISPLAY_TIME_MS);
        
        const item: FeedItem = {
          id: itemId,
          message: condensed,
          timestamp: Date.now(),
          timeoutId,
          isFadingOut: false,
          actorId: current.log.actorId
        };
        feedItems = [...feedItems, item];
        
        // If we exceed max items, fade out the oldest ones
        while (feedItems.filter(f => !f.isFadingOut).length > MAX_VISIBLE_ITEMS) {
          const oldestNonFading = feedItems.find(f => !f.isFadingOut);
          if (oldestNonFading) {
            clearTimeout(oldestNonFading.timeoutId);
            startFadeOut(oldestNonFading.id);
          } else {
            break;
          }
        }
      }
      
      pendingItems = pendingItems; // Trigger reactivity
    }
    
    if (pendingItems.length === 0 && processingInterval) {
      clearInterval(processingInterval);
      processingInterval = null;
    }
  }

  // Watch for new logs and queue them for staggered display
  $: {
    // Reset feed if logs were completely cleared or reset to initial state (when starting a new game)
    const isGameReset = logs.length === 0 || (logs.length === 1 && logs[0].message === 'Game initialized');
    if (isGameReset && lastLogCount > 0) {
      feedItems.forEach(item => clearTimeout(item.timeoutId));
      feedItems = [];
      pendingItems = [];
      if (processingInterval) {
        clearInterval(processingInterval);
        processingInterval = null;
      }
      lastLogCount = 0;
    }
    
    if (logs.length > lastLogCount) {
      // Queue new log entries (only if they should be shown)
      for (let i = lastLogCount; i < logs.length; i++) {
        if (shouldShowInFeed(logs[i].message)) {
          pendingItems = [...pendingItems, { log: logs[i], addedAt: Date.now() }];
        }
      }
      
      // Start processing if not already running
      if (!processingInterval && pendingItems.length > 0) {
        // Add the first item immediately
        processPendingItems();
        
        // Process remaining items with stagger delay
        if (pendingItems.length > 0) {
          processingInterval = setInterval(processPendingItems, STAGGER_DELAY_MS);
        }
      }
      
      lastLogCount = logs.length;
    }
  }
  
  // Calculate position from top (0 = oldest at top, higher = newer at bottom)
  // For fading, we want older items at the top to fade when there are many items
  $: itemsWithPosition = feedItems.map((item, index) => ({
    ...item,
    position: index,  // index 0 = oldest (top), higher index = newer (bottom)
    shouldFade: index < feedItems.length - 5 && feedItems.length > 5  // Fade items beyond the 5 most recent
  }));
</script>

<div class="game-feed">
  {#each itemsWithPosition as item (item.id)}
    <div 
      class="feed-item" 
      class:fading={item.shouldFade}
      class:fade-out={item.isFadingOut}
      class:self-action={item.actorId === localPlayerId}
    >
      {#if item.actorId === localPlayerId}
        You {item.message.replace(getActorName(item.actorId) + ' ', '').replace(getActorName(item.actorId) + "'s ", "your ").replace(/^was /, 'were ').replace(/^is /, 'are ')}
      {:else if getActorName(item.actorId)}
        <span class="actor-name" style="color: {getActorColor(item.actorId)}">{getActorName(item.actorId)}</span>: {item.message.replace(getActorName(item.actorId) + ' ', '').replace(getActorName(item.actorId) + "'s ", "'s ")}
      {:else}
        {item.message}
      {/if}
    </div>
  {/each}
</div>

<style>
  .game-feed {
    position: absolute;
    bottom: 35%;
    left: 1rem;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.2rem;
    pointer-events: none;
    z-index: 20;
    max-width: 300px;
  }

  .feed-item {
    color: #ffd93d;
    padding: 0.1rem 0;
    font-size: 0.85rem;
    font-weight: 500;
    text-align: left;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
    word-wrap: break-word;
    animation: slide-in 0.3s ease-out;
    transition: opacity 1s ease-out;
    opacity: 1;
  }

  .feed-item.fading {
    opacity: 0.3;
  }

  .feed-item.fade-out {
    opacity: 0 !important;
    transition: opacity 1s ease-out !important;
  }

  .actor-name {
    font-weight: 700;
  }

  .feed-item.self-action {
    color: #FF4444;
    font-weight: 700;
  }

  @keyframes slide-in {
    0% {
      opacity: 0;
      transform: translateY(20px);
    }
    100% {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* Mobile responsive styles */
  @media (max-width: 480px) {
    .game-feed {
      max-width: 200px;
      left: 0.5rem;
      bottom: 40%;
    }

    .feed-item {
      font-size: 0.75rem;
    }
  }
</style>
