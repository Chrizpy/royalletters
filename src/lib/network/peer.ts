import Peer, { type DataConnection } from 'peerjs';
import type { NetworkMessage } from './messages';

export type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error';

export type MessageHandler = (
  message: NetworkMessage,
  conn: DataConnection,
) => void;

export class PeerManager {
  private peer: Peer | null = null;
  private connections: Map<string, DataConnection> = new Map();
  private state: ConnectionState = 'disconnected';
  private messageHandler: MessageHandler | null = null;
  private stateChangeListeners: Array<(state: ConnectionState) => void> = [];
  private connectionListeners: Array<(peerId: string) => void> = [];
  private disconnectionListeners: Array<(peerId: string) => void> = [];
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 2000;
  private signalingReconnectAttempts = 0;
  private maxSignalingReconnectAttempts = 5;
  private visibilityHandler: (() => void) | null = null;

  /**
   * Initialize as host with a unique peer ID
   */
  async createHost(peerId: string): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        this.peer = new Peer(peerId);

        this.peer.on('open', (id) => {
          console.log('Peer created with ID:', id);
          this.setState('connected');
          this.setupHostListeners();
          this.setupVisibilityHandler();
          resolve(id);
        });

        this.peer.on('disconnected', () => {
          console.warn('Host lost connection to signaling server');
          this.reconnectSignalingServer();
        });

        this.peer.on('close', () => {
          console.log('Peer destroyed');
          this.setState('disconnected');
        });

        this.peer.on('error', (error) => {
          console.error('Peer error:', error);
          this.setState('error');
          reject(error);
        });
      } catch (error) {
        this.setState('error');
        reject(error);
      }
    });
  }

  /**
   * Connect to an existing peer as guest
   */
  async connectToHost(hostPeerId: string, guestPeerId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.setState('connecting');

        // Create peer for guest
        this.peer = new Peer(guestPeerId);

        this.peer.on('open', (id) => {
          console.log('Guest peer created with ID:', id);
          this.setupVisibilityHandler();

          // Connect to host
          const conn = this.peer!.connect(hostPeerId);
          this.setupConnection(conn);

          conn.on('open', () => {
            console.log('Connected to host:', hostPeerId);
            this.setState('connected');
            resolve();
          });
        });

        this.peer.on('disconnected', () => {
          console.warn('Guest lost connection to signaling server');
          this.reconnectSignalingServer();
        });

        this.peer.on('close', () => {
          console.log('Peer destroyed');
          this.setState('disconnected');
        });

        this.peer.on('error', (error) => {
          console.error('Peer error:', error);
          this.setState('error');
          reject(error);
        });
      } catch (error) {
        this.setState('error');
        reject(error);
      }
    });
  }

  /**
   * Set up host-specific listeners for incoming connections
   */
  private setupHostListeners(): void {
    if (!this.peer) return;

    this.peer.on('connection', (conn) => {
      console.log('Incoming connection from:', conn.peer);
      this.setupConnection(conn);
    });
  }

  /**
   * Set up event listeners for a data connection
   */
  private setupConnection(conn: DataConnection): void {
    conn.on('open', () => {
      console.log('Connection opened:', conn.peer);
      this.connections.set(conn.peer, conn);
      this.reconnectAttempts = 0; // Reset on successful connection
      this.notifyConnectionListeners(conn.peer);
    });

    conn.on('data', (data) => {
      if (this.messageHandler) {
        try {
          const message = data as NetworkMessage;
          this.messageHandler(message, conn);
        } catch (error) {
          console.error('Error handling message:', error);
        }
      }
    });

    conn.on('close', () => {
      console.log('Connection closed:', conn.peer);
      this.connections.delete(conn.peer);
      this.notifyDisconnectionListeners(conn.peer);
      this.attemptReconnect(conn.peer);
    });

    conn.on('error', (error) => {
      console.error('Connection error:', error);
    });
  }

  /**
   * Attempt to reconnect to a peer
   */
  private attemptReconnect(peerId: string): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnect attempts reached');
      this.setState('error');
      return;
    }

    this.reconnectAttempts++;
    console.log(
      `Reconnecting to ${peerId} (attempt ${this.reconnectAttempts})`,
    );

    // Exponential backoff with cap at 30 seconds
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      30000,
    );

    setTimeout(() => {
      if (this.peer && !this.connections.has(peerId)) {
        const conn = this.peer.connect(peerId);
        this.setupConnection(conn);
      }
    }, delay);
  }

  /**
   * Reconnect to the PeerJS signaling server (not to a specific peer).
   * This is needed when the browser tab is backgrounded on mobile and the
   * WebSocket to the signaling server times out.
   */
  private reconnectSignalingServer(): void {
    if (!this.peer || this.peer.destroyed) {
      console.log('Peer is destroyed, cannot reconnect to signaling server');
      this.setState('disconnected');
      return;
    }

    if (this.signalingReconnectAttempts >= this.maxSignalingReconnectAttempts) {
      console.log('Max signaling reconnect attempts reached');
      this.setState('error');
      return;
    }

    this.signalingReconnectAttempts++;
    console.log(
      `Reconnecting to signaling server (attempt ${this.signalingReconnectAttempts})`,
    );

    try {
      this.peer.reconnect();
      // Reset counter on success — the 'open' event won't re-fire,
      // but 'disconnected' won't fire again either unless it drops again.
      this.signalingReconnectAttempts = 0;
    } catch (err) {
      console.error('Failed to reconnect to signaling server:', err);

      const delay = Math.min(
        this.reconnectDelay * Math.pow(2, this.signalingReconnectAttempts - 1),
        30000,
      );
      setTimeout(() => this.reconnectSignalingServer(), delay);
    }
  }

  /**
   * Listen for the page becoming visible again (e.g. user switches back to
   * the browser on mobile). When that happens, proactively check whether the
   * signaling server connection is still alive and reconnect if needed.
   */
  setupVisibilityHandler(): void {
    if (this.visibilityHandler) return; // already set up

    this.visibilityHandler = () => {
      if (document.visibilityState === 'visible' && this.peer) {
        console.log('Page became visible, checking peer connection…');

        if (this.peer.destroyed) {
          console.warn('Peer was destroyed while in background');
          this.setState('disconnected');
          return;
        }

        if (this.peer.disconnected) {
          console.warn(
            'Peer disconnected from signaling server while in background, reconnecting…',
          );
          this.signalingReconnectAttempts = 0;
          this.reconnectSignalingServer();
        }
      }
    };

    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  /**
   * Remove the visibilitychange listener.
   */
  private cleanupVisibilityHandler(): void {
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
  }

  /**
   * Send a message to a specific peer
   */
  sendTo(peerId: string, message: NetworkMessage): void {
    const conn = this.connections.get(peerId);
    if (conn && conn.open) {
      conn.send(message);
    } else {
      console.error('No connection to peer:', peerId);
    }
  }

  /**
   * Broadcast a message to all connected peers
   */
  broadcast(message: NetworkMessage): void {
    this.connections.forEach((conn) => {
      if (conn.open) {
        conn.send(message);
      }
    });
  }

  /**
   * Broadcast a message to all connected peers except one
   */
  broadcastExcept(message: NetworkMessage, excludePeerId: string): void {
    this.connections.forEach((conn, peerId) => {
      if (conn.open && peerId !== excludePeerId) {
        conn.send(message);
      }
    });
  }

  /**
   * Set the message handler
   */
  onMessage(handler: MessageHandler): void {
    this.messageHandler = handler;
  }

  /**
   * Add state change listener
   */
  onStateChange(listener: (state: ConnectionState) => void): void {
    this.stateChangeListeners.push(listener);
  }

  /**
   * Add connection listener
   */
  onConnection(listener: (peerId: string) => void): void {
    this.connectionListeners.push(listener);
  }

  /**
   * Add disconnection listener
   */
  onDisconnection(listener: (peerId: string) => void): void {
    this.disconnectionListeners.push(listener);
  }

  /**
   * Get current connection state
   */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * Get peer ID
   */
  getPeerId(): string | null {
    return this.peer?.id || null;
  }

  /**
   * Get list of connected peer IDs
   */
  getConnectedPeers(): string[] {
    return Array.from(this.connections.keys());
  }

  /**
   * Disconnect from all peers and destroy the peer
   */
  disconnect(): void {
    this.cleanupVisibilityHandler();
    this.connections.forEach((conn) => conn.close());
    this.connections.clear();

    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }

    this.setState('disconnected');
  }

  /**
   * Update connection state and notify listeners
   */
  private setState(state: ConnectionState): void {
    this.state = state;
    this.stateChangeListeners.forEach((listener) => listener(state));
  }

  /**
   * Notify connection listeners
   */
  private notifyConnectionListeners(peerId: string): void {
    this.connectionListeners.forEach((listener) => listener(peerId));
  }

  /**
   * Notify disconnection listeners
   */
  private notifyDisconnectionListeners(peerId: string): void {
    this.disconnectionListeners.forEach((listener) => listener(peerId));
  }
}
