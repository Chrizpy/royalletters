<script lang="ts">
  import type { LogEntry } from '../types';

  interface FeedItem {
    id: number;
    message: string;
    timestamp: number;
    timeoutId: ReturnType<typeof setTimeout>;
  }

  export let logs: LogEntry[] = [];

  const FEED_DISPLAY_TIME_MS = 4000;
  const MAX_VISIBLE_ITEMS = 3;

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
</script>

<div class="game-feed">
  {#each feedItems as item (item.id)}
    <div class="feed-item">
      {item.message}
    </div>
  {/each}
</div>

<style>
  .game-feed {
    position: absolute;
    bottom: 45%;
    left: 1rem;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.25rem;
    pointer-events: none;
    z-index: 20;
    max-width: 280px;
  }

  .feed-item {
    color: #ffd93d;
    padding: 0.15rem 0;
    font-size: 0.85rem;
    font-weight: 500;
    text-align: left;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
    animation: feed-fade 4s ease-out forwards;
    word-wrap: break-word;
  }

  @keyframes feed-fade {
    0% {
      opacity: 0;
      transform: translateX(-10px);
    }
    10% {
      opacity: 1;
      transform: translateX(0);
    }
    75% {
      opacity: 1;
    }
    100% {
      opacity: 0;
    }
  }

  /* Mobile responsive styles */
  @media (max-width: 480px) {
    .game-feed {
      max-width: 200px;
      left: 0.5rem;
    }

    .feed-item {
      font-size: 0.75rem;
    }
  }
</style>
