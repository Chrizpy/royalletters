import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PeerManager } from './peer';

/**
 * We can't test actual PeerJS connections in unit tests (they need a real
 * signaling server), but we CAN test the visibility-change and signaling-
 * reconnect logic that was added to fix mobile backgrounding disconnects.
 *
 * Strategy: access the private `peer` field via type-casting so we can
 * simulate PeerJS states without a real server.
 */

// Helper to reach into private fields for testing
function getPrivateField<T>(obj: unknown, field: string): T {
  return (obj as Record<string, unknown>)[field] as T;
}

function setPrivateField(obj: unknown, field: string, value: unknown): void {
  (obj as Record<string, unknown>)[field] = value;
}

describe('PeerManager', () => {
  it('should start in disconnected state', () => {
    const pm = new PeerManager();
    expect(pm.getState()).toBe('disconnected');
  });

  it('should return null peerId when no peer is created', () => {
    const pm = new PeerManager();
    expect(pm.getPeerId()).toBeNull();
  });

  it('should return empty connected peers list initially', () => {
    const pm = new PeerManager();
    expect(pm.getConnectedPeers()).toEqual([]);
  });
});

describe('PeerManager - Visibility Handler', () => {
  let pm: PeerManager;
  let addSpy: ReturnType<typeof vi.spyOn>;
  let removeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    pm = new PeerManager();

    // Stub document visibility API (test env is node, no real document)
    if (typeof globalThis.document === 'undefined') {
      (globalThis as Record<string, unknown>).document = {
        visibilityState: 'visible',
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };
    }

    addSpy = vi.spyOn(document, 'addEventListener');
    removeSpy = vi.spyOn(document, 'removeEventListener');
  });

  afterEach(() => {
    pm.disconnect();
    vi.restoreAllMocks();
  });

  it('should register a visibilitychange listener via setupVisibilityHandler', () => {
    pm.setupVisibilityHandler();

    expect(addSpy).toHaveBeenCalledWith(
      'visibilitychange',
      expect.any(Function),
    );
  });

  it('should only register the listener once even if called twice', () => {
    pm.setupVisibilityHandler();

    // Reset spy to only count calls from the second invocation
    addSpy.mockClear();
    pm.setupVisibilityHandler();

    const visibilityCalls = addSpy.mock.calls.filter(
      (call) => call[0] === 'visibilitychange',
    );
    expect(visibilityCalls).toHaveLength(0);
  });

  it('should remove the visibilitychange listener on disconnect', () => {
    pm.setupVisibilityHandler();
    pm.disconnect();

    expect(removeSpy).toHaveBeenCalledWith(
      'visibilitychange',
      expect.any(Function),
    );
  });

  it('should not leave a dangling handler after disconnect', () => {
    pm.setupVisibilityHandler();
    pm.disconnect();

    // After disconnect, the internal handler reference should be cleared,
    // so calling setupVisibilityHandler again should register a new one
    addSpy.mockClear();
    pm.setupVisibilityHandler();

    const visibilityCalls = addSpy.mock.calls.filter(
      (call) => call[0] === 'visibilitychange',
    );
    expect(visibilityCalls).toHaveLength(1);
  });
});

describe('PeerManager - Signaling Reconnect', () => {
  let pm: PeerManager;

  beforeEach(() => {
    pm = new PeerManager();

    // Stub document for visibility handler cleanup in disconnect()
    if (typeof globalThis.document === 'undefined') {
      (globalThis as Record<string, unknown>).document = {
        visibilityState: 'visible',
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };
    }
  });

  afterEach(() => {
    pm.disconnect();
    vi.restoreAllMocks();
  });

  it('should set state to disconnected when peer is destroyed during reconnect', () => {
    const stateListener = vi.fn();
    pm.onStateChange(stateListener);

    // Simulate a destroyed peer
    const fakePeer = {
      destroyed: true,
      disconnected: true,
      reconnect: vi.fn(),
      destroy: vi.fn(),
    };
    setPrivateField(pm, 'peer', fakePeer);

    // Trigger the private reconnect method
    (
      pm as unknown as { reconnectSignalingServer: () => void }
    ).reconnectSignalingServer();

    expect(stateListener).toHaveBeenCalledWith('disconnected');
    expect(fakePeer.reconnect).not.toHaveBeenCalled();
  });

  it('should call peer.reconnect() when peer is disconnected but not destroyed', () => {
    const fakePeer = {
      destroyed: false,
      disconnected: true,
      reconnect: vi.fn(),
      destroy: vi.fn(),
    };
    setPrivateField(pm, 'peer', fakePeer);

    (
      pm as unknown as { reconnectSignalingServer: () => void }
    ).reconnectSignalingServer();

    expect(fakePeer.reconnect).toHaveBeenCalledOnce();
  });

  it('should set state to error after max signaling reconnect attempts', () => {
    const stateListener = vi.fn();
    pm.onStateChange(stateListener);

    const fakePeer = {
      destroyed: false,
      disconnected: true,
      reconnect: vi.fn(),
      destroy: vi.fn(),
    };
    setPrivateField(pm, 'peer', fakePeer);
    setPrivateField(pm, 'signalingReconnectAttempts', 5); // already at max

    (
      pm as unknown as { reconnectSignalingServer: () => void }
    ).reconnectSignalingServer();

    expect(stateListener).toHaveBeenCalledWith('error');
    expect(fakePeer.reconnect).not.toHaveBeenCalled();
  });

  it('should reset signaling reconnect attempts on successful reconnect', () => {
    const fakePeer = {
      destroyed: false,
      disconnected: true,
      reconnect: vi.fn(),
      destroy: vi.fn(),
    };
    setPrivateField(pm, 'peer', fakePeer);
    setPrivateField(pm, 'signalingReconnectAttempts', 2);

    (
      pm as unknown as { reconnectSignalingServer: () => void }
    ).reconnectSignalingServer();

    const attempts = getPrivateField<number>(pm, 'signalingReconnectAttempts');
    expect(attempts).toBe(0);
  });

  it('should retry with backoff when peer.reconnect() throws', () => {
    vi.useFakeTimers();

    const fakePeer = {
      destroyed: false,
      disconnected: true,
      destroy: vi.fn(),
      reconnect: vi
        .fn()
        .mockImplementationOnce(() => {
          throw new Error('signaling server unreachable');
        })
        .mockImplementation(() => {
          // second call succeeds
        }),
    };
    setPrivateField(pm, 'peer', fakePeer);

    (
      pm as unknown as { reconnectSignalingServer: () => void }
    ).reconnectSignalingServer();

    // First call threw, so reconnect was called once
    expect(fakePeer.reconnect).toHaveBeenCalledOnce();

    // Advance past the backoff delay (2000ms for attempt 1)
    vi.advanceTimersByTime(2000);

    // Should have retried
    expect(fakePeer.reconnect).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });
});

describe('PeerManager - Visibility Handler triggers reconnect', () => {
  let pm: PeerManager;
  let capturedHandler: (() => void) | null = null;

  beforeEach(() => {
    pm = new PeerManager();

    // Capture the actual handler that gets registered
    if (typeof globalThis.document === 'undefined') {
      (globalThis as Record<string, unknown>).document = {
        visibilityState: 'visible',
        addEventListener: vi.fn((event: string, handler: () => void) => {
          if (event === 'visibilitychange') capturedHandler = handler;
        }),
        removeEventListener: vi.fn(),
      };
    } else {
      vi.spyOn(document, 'addEventListener').mockImplementation(
        (event: string, handler: unknown) => {
          if (event === 'visibilitychange')
            capturedHandler = handler as () => void;
        },
      );
      vi.spyOn(document, 'removeEventListener');
    }
  });

  afterEach(() => {
    pm.disconnect();
    capturedHandler = null;
    vi.restoreAllMocks();
  });

  it('should call reconnectSignalingServer when page becomes visible and peer is disconnected', () => {
    const fakePeer = {
      destroyed: false,
      disconnected: true,
      reconnect: vi.fn(),
      destroy: vi.fn(),
    };
    setPrivateField(pm, 'peer', fakePeer);

    pm.setupVisibilityHandler();
    expect(capturedHandler).not.toBeNull();

    // Simulate page becoming visible
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
    });
    capturedHandler!();

    expect(fakePeer.reconnect).toHaveBeenCalled();
  });

  it('should NOT reconnect when page becomes visible but peer is still connected', () => {
    const fakePeer = {
      destroyed: false,
      disconnected: false,
      reconnect: vi.fn(),
      destroy: vi.fn(),
    };
    setPrivateField(pm, 'peer', fakePeer);

    pm.setupVisibilityHandler();
    expect(capturedHandler).not.toBeNull();

    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
    });
    capturedHandler!();

    expect(fakePeer.reconnect).not.toHaveBeenCalled();
  });

  it('should set state to disconnected when page becomes visible and peer is destroyed', () => {
    const stateListener = vi.fn();
    pm.onStateChange(stateListener);

    const fakePeer = {
      destroyed: true,
      disconnected: true,
      reconnect: vi.fn(),
      destroy: vi.fn(),
    };
    setPrivateField(pm, 'peer', fakePeer);

    pm.setupVisibilityHandler();
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
    });
    capturedHandler!();

    expect(stateListener).toHaveBeenCalledWith('disconnected');
    expect(fakePeer.reconnect).not.toHaveBeenCalled();
  });

  it('should NOT do anything when page becomes hidden', () => {
    const fakePeer = {
      destroyed: false,
      disconnected: true,
      reconnect: vi.fn(),
      destroy: vi.fn(),
    };
    setPrivateField(pm, 'peer', fakePeer);

    pm.setupVisibilityHandler();

    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      configurable: true,
    });
    capturedHandler!();

    expect(fakePeer.reconnect).not.toHaveBeenCalled();
  });
});
