<script lang="ts">
  import type { LogEntry } from '../types';

  interface FeedItem {
    id: number;
    message: string;
    timestamp: number;
    timeoutId: ReturnType<typeof setTimeout>;
    isFadingOut: boolean;
  }

  interface PendingItem {
    log: LogEntry;
    addedAt: number;
  }

  export let logs: LogEntry[] = [];

  const FEED_DISPLAY_TIME_MS = 5000;
  const FADE_OUT_DURATION_MS = 1000;
  const MAX_VISIBLE_ITEMS = 8;
  const STAGGER_DELAY_MS = 300; // Delay between each message appearing

  let feedItems: FeedItem[] = [];
  let pendingItems: PendingItem[] = [];
  let nextId = 0;
  let lastLogCount = 0;
  let processingInterval: ReturnType<typeof setInterval> | null = null;

  // Filter function to exclude verbose messages
  function shouldShowInFeed(message: string): boolean {
    const excludePatterns = [
      'drew a card',
      'drew card',
      'drew 1 card',
      'drew 2 cards',
      'drew 3 cards',
      'returned 1 card',
      'returned 2 cards',
      'returned 3 cards',
      'Round',
      'started',
      'Game initialized',
      'Burned face-up',
      'gained a token from Spy bonus'
    ];
    
    return !excludePatterns.some(pattern => message.includes(pattern));
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

  // Add a single item to the feed
  function addItemToFeed(log: LogEntry) {
    const itemId = nextId++;
    
    // Schedule fade out after display time
    const timeoutId = setTimeout(() => {
      startFadeOut(itemId);
    }, FEED_DISPLAY_TIME_MS);
    
    const item: FeedItem = {
      id: itemId,
      message: log.message,
      timestamp: Date.now(),
      timeoutId,
      isFadingOut: false
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

  // Process pending items one at a time
  function processPendingItems() {
    if (pendingItems.length > 0) {
      const next = pendingItems.shift()!;
      addItemToFeed(next.log);
      pendingItems = pendingItems; // Trigger reactivity
    }
    
    if (pendingItems.length === 0 && processingInterval) {
      clearInterval(processingInterval);
      processingInterval = null;
    }
  }

  // Watch for new logs and queue them for staggered display
  $: {
    // Reset feed if logs were cleared (e.g., on play again)
    if (logs.length < lastLogCount) {
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
    >
      {item.message}
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
