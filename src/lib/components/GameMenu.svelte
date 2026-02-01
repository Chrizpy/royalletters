<script lang="ts">
  import type { LogEntry } from '../types';
  import type { ChatMessage } from '../stores/chat';
  import { chatMessages } from '../stores/chat';

  const SCROLL_DELAY_MS = 100;

  export let logs: LogEntry[] = [];
  export let onSendChat: ((text: string) => void) | undefined = undefined;
  
  let isMenuOpen = false;
  let activeModal: 'log' | 'chat' | null = null;
  let logsContainer: HTMLDivElement;
  let chatContainer: HTMLDivElement;
  let chatInput = '';
  let hasScrolledLogOnOpen = false;
  let hasScrolledChatOnOpen = false;

  $: messages = $chatMessages;
  $: isChatInputEmpty = !chatInput.trim();

  // Only scroll to bottom when the log modal is first opened
  $: if (logsContainer && logs.length && activeModal === 'log' && !hasScrolledLogOnOpen) {
    setTimeout(() => {
      logsContainer.scrollTop = logsContainer.scrollHeight;
      hasScrolledLogOnOpen = true;
    }, SCROLL_DELAY_MS);
  }

  // Only scroll to bottom when the chat modal is first opened
  $: if (chatContainer && messages.length && activeModal === 'chat' && !hasScrolledChatOnOpen) {
    setTimeout(() => {
      chatContainer.scrollTop = chatContainer.scrollHeight;
      hasScrolledChatOnOpen = true;
    }, SCROLL_DELAY_MS);
  }

  function toggleMenu() {
    isMenuOpen = !isMenuOpen;
  }

  function openModal(type: 'log' | 'chat') {
    activeModal = type;
    isMenuOpen = false;
    // Reset scroll flags when opening modals
    if (type === 'log') {
      hasScrolledLogOnOpen = false;
    } else if (type === 'chat') {
      hasScrolledChatOnOpen = false;
    }
  }

  function closeModal() {
    activeModal = null;
  }

  function formatTime(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function handleSendChat() {
    if (isChatInputEmpty || !onSendChat) return;
    onSendChat(chatInput.trim());
    chatInput = '';
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendChat();
    }
  }
  function handleExitGame() {
    if (confirm('Are you sure you want to exit the game?')) {
      window.location.href = '/';
    }
  }
</script>

<!-- Main Floating Action Button Container -->
<div class="menu-container">
  <!-- Expanded Menu Items (The "Two Bubbles") -->
  {#if isMenuOpen}
    <div class="menu-items">
      <button class="mini-fab exit-fab" on:click={handleExitGame} aria-label="Exit game">
        <span class="mini-fab-icon">🚪</span>
        <span class="tooltip">Exit</span>
      </button>
      <button class="mini-fab chat-fab" on:click={() => openModal('chat')} aria-label="Open chat">
        <span class="mini-fab-icon">💬</span>
        <span class="tooltip">Chat</span>
        {#if messages.length > 0}
          <span class="mini-badge">{messages.length}</span>
        {/if}
      </button>
      <button class="mini-fab log-fab-mini" on:click={() => openModal('log')} aria-label="Open game log">
        <span class="mini-fab-icon">📜</span>
        <span class="tooltip">Log</span>
        {#if logs.length > 0}
          <span class="mini-badge">{logs.length}</span>
        {/if}
      </button>
    </div>
  {/if}

  <!-- Main Toggle Button -->
  <button class="main-fab" class:open={isMenuOpen} on:click={toggleMenu} aria-label="Toggle menu">
    <span class="fab-icon">{isMenuOpen ? '✕' : '☰'}</span>
  </button>
</div>

<!-- Log Modal -->
{#if activeModal === 'log'}
  <div class="modal-overlay" on:click={closeModal} on:keydown={(e) => e.key === 'Escape' && closeModal()} role="dialog" aria-modal="true" tabindex="0">
    <div class="modal-content" on:click|stopPropagation role="document">
      <div class="modal-header">
        <span class="modal-title">📜 Game Log</span>
        <button class="close-btn" on:click={closeModal} aria-label="Close log">✕</button>
      </div>
      
      <div class="modal-body" bind:this={logsContainer}>
        {#each logs as log}
          <div class="log-entry">
            <span class="entry-time">{formatTime(log.timestamp)}</span>
            <span class="entry-message">{log.message}</span>
          </div>
        {/each}
        
        {#if logs.length === 0}
          <div class="empty-state">No game events yet...</div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<!-- Chat Modal -->
{#if activeModal === 'chat'}
  <div class="modal-overlay" on:click={closeModal} on:keydown={(e) => e.key === 'Escape' && closeModal()} role="dialog" aria-modal="true" tabindex="0">
    <div class="modal-content chat-modal" on:click|stopPropagation role="document">
      <div class="modal-header">
        <span class="modal-title">💬 Chat</span>
        <button class="close-btn" on:click={closeModal} aria-label="Close chat">✕</button>
      </div>
      
      <div class="modal-body chat-body" bind:this={chatContainer}>
        {#each messages as msg}
          <div class="chat-entry">
            <span class="chat-sender">{msg.senderName}</span>
            <span class="chat-text">{msg.text}</span>
            <span class="chat-time">{formatTime(msg.timestamp)}</span>
          </div>
        {/each}
        
        {#if messages.length === 0}
          <div class="empty-state">No messages yet. Start the conversation!</div>
        {/if}
      </div>
      
      <div class="chat-input-area">
        <input 
          type="text" 
          class="chat-input" 
          placeholder="Type a message..." 
          bind:value={chatInput}
          on:keydown={handleKeydown}
        />
        <button class="send-btn" on:click={handleSendChat} aria-label="Send message" disabled={isChatInputEmpty}>
          ➤
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  /* Menu Container */
  .menu-container {
    position: fixed;
    bottom: 1rem;
    right: 1rem;
    z-index: 40;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
  }

  /* Menu Items (Expanding Bubbles) */
  .menu-items {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
    animation: menu-expand 0.3s ease-out;
  }

  @keyframes menu-expand {
    from {
      opacity: 0;
      transform: translateY(20px) scale(0.8);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  /* Mini FABs */
  .mini-fab {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    border: none;
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
    transition: all 0.2s ease;
    position: relative;
  }

  .chat-fab {
    background: linear-gradient(135deg, #00b894 0%, #00cec9 100%);
  }

  .log-fab-mini {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  }

  .exit-fab {
    background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
  }

  .mini-fab:hover {
    transform: scale(1.1);
  }

  .mini-fab:hover .tooltip {
    opacity: 1;
    transform: translateX(-10px);
  }

  .mini-fab-icon {
    font-size: 1.25rem;
  }

  .mini-badge {
    position: absolute;
    top: -4px;
    right: -4px;
    background: #e74c3c;
    color: white;
    font-size: 0.65rem;
    font-weight: 600;
    min-width: 18px;
    height: 18px;
    border-radius: 9px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 3px;
  }

  .tooltip {
    position: absolute;
    right: 100%;
    margin-right: 0.5rem;
    padding: 0.25rem 0.5rem;
    background: rgba(0, 0, 0, 0.8);
    color: white;
    font-size: 0.75rem;
    border-radius: 4px;
    white-space: nowrap;
    opacity: 0;
    pointer-events: none;
    transition: all 0.2s ease;
  }

  /* Main FAB */
  .main-fab {
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
    transition: all 0.3s ease;
  }

  .main-fab:hover {
    transform: scale(1.1);
    box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
  }

  .main-fab.open {
    background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
    box-shadow: 0 4px 15px rgba(231, 76, 60, 0.4);
  }

  .main-fab.open:hover {
    box-shadow: 0 6px 20px rgba(231, 76, 60, 0.6);
  }

  .fab-icon {
    font-size: 1.5rem;
    transition: transform 0.3s ease;
  }

  .main-fab.open .fab-icon {
    transform: rotate(90deg);
  }

  /* Modal Overlay */
  .modal-overlay {
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

  /* Modal Content */
  .modal-content {
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

  .chat-modal {
    max-height: 80vh;
  }

  @keyframes modal-slide-up {
    from { transform: translateY(100%); }
    to { transform: translateY(0); }
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.25rem;
    background: rgba(255, 255, 255, 0.05);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .modal-title {
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

  .modal-body {
    flex: 1;
    padding: 1rem 1.25rem;
    overflow-y: auto;
    scroll-behavior: smooth;
  }

  .chat-body {
    padding-bottom: 0;
  }

  /* Log Entries */
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

  .entry-time {
    color: rgba(255, 255, 255, 0.4);
    font-family: monospace;
    font-size: 0.8rem;
    white-space: nowrap;
  }

  .entry-message {
    color: rgba(255, 255, 255, 0.9);
    flex: 1;
  }

  /* Chat Entries */
  .chat-entry {
    display: flex;
    flex-direction: column;
    padding: 0.5rem 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }

  .chat-entry:last-child {
    border-bottom: none;
  }

  .chat-sender {
    font-weight: 600;
    color: #00b894;
    font-size: 0.85rem;
  }

  .chat-text {
    color: rgba(255, 255, 255, 0.9);
    margin: 0.25rem 0;
    word-break: break-word;
  }

  .chat-time {
    color: rgba(255, 255, 255, 0.4);
    font-family: monospace;
    font-size: 0.7rem;
  }

  .empty-state {
    color: rgba(255, 255, 255, 0.4);
    font-style: italic;
    text-align: center;
    padding: 2rem;
  }

  /* Chat Input Area */
  .chat-input-area {
    display: flex;
    gap: 0.5rem;
    padding: 1rem 1.25rem;
    background: rgba(255, 255, 255, 0.05);
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  .chat-input {
    flex: 1;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 20px;
    padding: 0.75rem 1rem;
    color: white;
    font-size: 0.9rem;
    outline: none;
    transition: all 0.2s ease;
  }

  .chat-input::placeholder {
    color: rgba(255, 255, 255, 0.4);
  }

  .chat-input:focus {
    border-color: #00b894;
    background: rgba(255, 255, 255, 0.15);
  }

  .send-btn {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: linear-gradient(135deg, #00b894 0%, #00cec9 100%);
    border: none;
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.2rem;
    transition: all 0.2s ease;
  }

  .send-btn:hover:not(:disabled) {
    transform: scale(1.1);
    box-shadow: 0 4px 15px rgba(0, 184, 148, 0.4);
  }

  .send-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Scrollbar styling */
  .modal-body::-webkit-scrollbar {
    width: 6px;
  }

  .modal-body::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
  }

  .modal-body::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.3);
    border-radius: 3px;
  }

  /* Mobile optimizations */
  @media (max-width: 480px) {
    .menu-container {
      bottom: 0.75rem;
      right: 0.75rem;
    }

    .main-fab {
      width: 48px;
      height: 48px;
    }

    .fab-icon {
      font-size: 1.25rem;
    }

    .mini-fab {
      width: 42px;
      height: 42px;
    }

    .mini-fab-icon {
      font-size: 1.1rem;
    }

    .modal-content {
      max-height: 80vh;
    }

    .chat-modal {
      max-height: 85vh;
    }
  }
</style>
