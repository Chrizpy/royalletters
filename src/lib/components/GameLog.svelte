<script lang="ts">
  import type { LogEntry } from '../types';

  export let logs: LogEntry[] = [];
  
  let isExpanded = false;
  let logsContainer: HTMLDivElement;

  $: displayLogs = isExpanded ? logs : logs.slice(-3);
  
  $: if (logsContainer && logs.length) {
    // Auto-scroll to bottom when new logs appear
    setTimeout(() => {
      logsContainer.scrollTop = logsContainer.scrollHeight;
    }, 100);
  }

  function toggleExpand() {
    isExpanded = !isExpanded;
  }

  function formatTime(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
</script>

<div class="game-log" class:expanded={isExpanded}>
  <button class="log-header" on:click={toggleExpand}>
    <span class="log-title">📜 Game Log</span>
    <span class="log-toggle">{isExpanded ? '▼' : '▲'}</span>
  </button>
  
  <div class="log-content" bind:this={logsContainer}>
    {#each displayLogs as log}
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

<style>
  .game-log {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(10px);
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    z-index: 50;
    transition: all 0.3s ease;
    max-height: 150px;
  }

  .game-log.expanded {
    max-height: 50vh;
  }

  .log-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding: 0.75rem 1rem;
    background: none;
    border: none;
    color: white;
    cursor: pointer;
    font-family: inherit;
    font-size: 0.9rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .log-header:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .log-title {
    font-weight: 600;
  }

  .log-toggle {
    font-size: 0.8rem;
    opacity: 0.7;
  }

  .log-content {
    padding: 0.5rem 1rem;
    max-height: calc(150px - 45px);
    overflow-y: auto;
    scroll-behavior: smooth;
  }

  .game-log.expanded .log-content {
    max-height: calc(50vh - 45px);
  }

  .log-entry {
    display: flex;
    gap: 0.75rem;
    padding: 0.25rem 0;
    font-size: 0.85rem;
    animation: log-fade-in 0.3s ease-out;
  }

  @keyframes log-fade-in {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .log-time {
    color: rgba(255, 255, 255, 0.4);
    font-family: monospace;
    font-size: 0.75rem;
    white-space: nowrap;
  }

  .log-message {
    color: rgba(255, 255, 255, 0.9);
  }

  .log-empty {
    color: rgba(255, 255, 255, 0.4);
    font-style: italic;
    text-align: center;
    padding: 0.5rem;
  }

  /* Scrollbar styling */
  .log-content::-webkit-scrollbar {
    width: 6px;
  }

  .log-content::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.1);
  }

  .log-content::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.3);
    border-radius: 3px;
  }
</style>
