<script lang="ts">
  import type { LogEntry } from '../types';

  export let logs: LogEntry[] = [];
  
  let isOpen = false;
  let logsContainer: HTMLDivElement;
  let previousLogCount = 0;
  let userHasScrolledUp = false;

  // Only auto-scroll when new logs are added and user hasn't scrolled up
  $: if (logsContainer && logs.length > previousLogCount && isOpen && !userHasScrolledUp) {
    setTimeout(() => {
      if (logsContainer) {
        logsContainer.scrollTop = logsContainer.scrollHeight;
      }
    }, 100);
  }

  // Track log count changes
  $: if (logs.length !== previousLogCount) {
    previousLogCount = logs.length;
  }

  function handleScroll() {
    if (!logsContainer) return;
    
    // Check if user is at or near the bottom (within 50px)
    const isNearBottom = logsContainer.scrollHeight - logsContainer.scrollTop - logsContainer.clientHeight < 50;
    userHasScrolledUp = !isNearBottom;
  }

  function toggleOpen() {
    isOpen = !isOpen;
    if (isOpen) {
      // Reset scroll state when opening, and scroll to bottom
      userHasScrolledUp = false;
      setTimeout(() => {
        if (logsContainer) {
          logsContainer.scrollTop = logsContainer.scrollHeight;
        }
      }, 100);
    }
  }

  function close() {
    isOpen = false;
    userHasScrolledUp = false;
  }

  function formatTime(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
</script>

<!-- Floating log button -->
<button class="log-fab" on:click={toggleOpen} aria-label="View game log">
  <span class="fab-icon">📜</span>
  {#if logs.length > 0}
    <span class="log-badge">{logs.length}</span>
  {/if}
</button>

<!-- Log modal overlay -->
{#if isOpen}
  <div class="log-overlay" on:click={close} on:keydown={(e) => e.key === 'Escape' && close()} role="dialog" aria-modal="true" tabindex="0">
    <div class="log-modal" on:click|stopPropagation>
      <div class="log-header">
        <span class="log-title">📜 Game Log</span>
        <button class="close-btn" on:click={close} aria-label="Close log">✕</button>
      </div>
      
      <div class="log-content" bind:this={logsContainer} on:scroll={handleScroll}>
        {#each logs as log}
          <div class="log-entry">
            <span class="log-time">{formatTime(log.timestamp)}</span>
            <span class="log-message">{log.message}</span>
          </div>
        {/each}
        
        {#if logs.length === 0}
          <div class="log-empty">No game events yet...</div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  /* Floating action button */
  .log-fab {
    position: fixed;
    bottom: 1rem;
    right: 1rem;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border: none;
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
    z-index: 40;
    transition: all 0.3s ease;
  }

  .log-fab:hover {
    transform: scale(1.1);
    box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
  }

  .fab-icon {
    font-size: 1.5rem;
  }

  .log-badge {
    position: absolute;
    top: -4px;
    right: -4px;
    background: #e74c3c;
    color: white;
    font-size: 0.7rem;
    font-weight: 600;
    min-width: 20px;
    height: 20px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 4px;
  }

  /* Modal overlay */
  .log-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    z-index: 100;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    animation: overlay-fade 0.2s ease-out;
  }

  @keyframes overlay-fade {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  /* Modal content */
  .log-modal {
    width: 100%;
    max-width: 500px;
    max-height: 70vh;
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    border-radius: 20px 20px 0 0;
    display: flex;
    flex-direction: column;
    animation: modal-slide-up 0.3s ease-out;
    overflow: hidden;
  }

  @keyframes modal-slide-up {
    from { transform: translateY(100%); }
    to { transform: translateY(0); }
  }

  .log-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.25rem;
    background: rgba(255, 255, 255, 0.05);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .log-title {
    font-weight: 600;
    font-size: 1.1rem;
    color: white;
  }

  .close-btn {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.1);
    border: none;
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1rem;
    transition: all 0.2s ease;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  .log-content {
    flex: 1;
    padding: 1rem 1.25rem;
    overflow-y: auto;
    scroll-behavior: smooth;
  }

  .log-entry {
    display: flex;
    gap: 0.75rem;
    padding: 0.5rem 0;
    font-size: 0.9rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }

  .log-entry:last-child {
    border-bottom: none;
  }

  .log-time {
    color: rgba(255, 255, 255, 0.4);
    font-family: monospace;
    font-size: 0.8rem;
    white-space: nowrap;
  }

  .log-message {
    color: rgba(255, 255, 255, 0.9);
    flex: 1;
  }

  .log-empty {
    color: rgba(255, 255, 255, 0.4);
    font-style: italic;
    text-align: center;
    padding: 2rem;
  }

  /* Scrollbar styling */
  .log-content::-webkit-scrollbar {
    width: 6px;
  }

  .log-content::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
  }

  .log-content::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.3);
    border-radius: 3px;
  }

  /* Mobile optimizations */
  @media (max-width: 480px) {
    .log-fab {
      bottom: 0.75rem;
      right: 0.75rem;
      width: 48px;
      height: 48px;
    }

    .fab-icon {
      font-size: 1.25rem;
    }

    .log-modal {
      max-height: 80vh;
    }
  }
</style>
