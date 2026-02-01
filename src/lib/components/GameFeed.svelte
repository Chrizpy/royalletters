<script lang="ts">
  import type { LogEntry } from '../types';

  interface FeedItem {
    id: number;
    message: string;
    timestamp: number;
    timeoutId: ReturnType<typeof setTimeout>;
  }

  export let logs: LogEntry[] = [];

  const FEED_DISPLAY_TIME_MS = 6000;
  const MAX_VISIBLE_ITEMS = 8;

  let feedItems: FeedItem[] = [];
  let nextId = 0;
  let lastLogCount = 0;

  // Watch for new logs and add them to the feed
  $: {
    if (logs.length > lastLogCount) {
      // Add new log entries to the feed
      for (let i = lastLogCount; i < logs.length; i++) {
        const log = logs[i];
        const itemId = nextId++;
        
        // Schedule removal after display time
        const timeoutId = setTimeout(() => {
          feedItems = feedItems.filter(f => f.id !== itemId);
        }, FEED_DISPLAY_TIME_MS);
        
        const item: FeedItem = {
          id: itemId,
          message: log.message,
          timestamp: Date.now(),
          timeoutId
        };
        feedItems = [...feedItems, item];
      }
      
      // Keep only the most recent items visible, clearing timeouts for removed items
      if (feedItems.length > MAX_VISIBLE_ITEMS) {
        const itemsToRemove = feedItems.slice(0, feedItems.length - MAX_VISIBLE_ITEMS);
        itemsToRemove.forEach(item => clearTimeout(item.timeoutId));
        feedItems = feedItems.slice(-MAX_VISIBLE_ITEMS);
      }
      
      lastLogCount = logs.length;
    }
  }
  
  // Calculate position from bottom (0 = newest at bottom)
  $: itemsWithPosition = feedItems.map((item, index) => ({
    ...item,
    position: feedItems.length - 1 - index
  }));
</script>

<div class="game-feed">
  {#each itemsWithPosition as item (item.id)}
    <div 
      class="feed-item" 
      class:fading={item.position >= 5}
      style="--position: {item.position}"
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
    flex-direction: column-reverse;
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
    animation: slide-in 0.3s ease-out forwards;
    transition: opacity 0.5s ease-out, transform 0.3s ease-out;
  }

  .feed-item.fading {
    opacity: 0.3;
  }

  @keyframes slide-in {
    0% {
      opacity: 0;
      transform: translateY(10px);
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
