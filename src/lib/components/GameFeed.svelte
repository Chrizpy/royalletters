<script lang="ts">
  import type { LogEntry } from '../types';

  interface FeedItem {
    id: number;
    message: string;
    timestamp: number;
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
        const item: FeedItem = {
          id: nextId++,
          message: log.message,
          timestamp: Date.now()
        };
        feedItems = [...feedItems, item];
        
        // Schedule removal after display time
        const itemId = item.id;
        setTimeout(() => {
          feedItems = feedItems.filter(f => f.id !== itemId);
        }, FEED_DISPLAY_TIME_MS);
      }
      
      // Keep only the most recent items visible
      if (feedItems.length > MAX_VISIBLE_ITEMS) {
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
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    pointer-events: none;
    z-index: 20;
  }

  .feed-item {
    background: rgba(0, 0, 0, 0.7);
    color: white;
    padding: 0.5rem 1rem;
    border-radius: 20px;
    font-size: 0.9rem;
    font-weight: 500;
    text-align: center;
    backdrop-filter: blur(4px);
    animation: feed-fade 4s ease-out forwards;
    max-width: 90vw;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  @keyframes feed-fade {
    0% {
      opacity: 0;
      transform: translateY(10px);
    }
    10% {
      opacity: 1;
      transform: translateY(0);
    }
    80% {
      opacity: 1;
    }
    100% {
      opacity: 0;
    }
  }

  /* Mobile responsive styles */
  @media (max-width: 480px) {
    .feed-item {
      font-size: 0.8rem;
      padding: 0.4rem 0.8rem;
    }
  }
</style>
