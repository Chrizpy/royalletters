import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import {
  savedSession,
  saveSession,
  loadSession,
  clearSession,
  hasValidSession,
  getSessionAge,
  type GameSession
} from './session';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: () => { store = {}; }
  };
})();

Object.defineProperty(global, 'localStorage', { value: localStorageMock });

describe('Session Store', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    savedSession.set(null);
  });

  describe('saveSession', () => {
    it('should save session to localStorage with timestamp', () => {
      const session = {
        guestPeerId: 'guest-abc',
        hostPeerId: 'host-xyz',
        nickname: 'Player1'
      };

      saveSession(session);

      expect(localStorageMock.setItem).toHaveBeenCalled();
      const saved = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
      expect(saved.guestPeerId).toBe('guest-abc');
      expect(saved.hostPeerId).toBe('host-xyz');
      expect(saved.nickname).toBe('Player1');
      expect(saved.timestamp).toBeDefined();
    });

    it('should update the savedSession store', () => {
      const session = {
        guestPeerId: 'guest-abc',
        hostPeerId: 'host-xyz',
        nickname: 'Player1'
      };

      saveSession(session);

      const stored = get(savedSession);
      expect(stored).not.toBeNull();
      expect(stored?.guestPeerId).toBe('guest-abc');
    });
  });

  describe('loadSession', () => {
    it('should return null when no session exists', () => {
      const result = loadSession();
      expect(result).toBeNull();
    });

    it('should load valid session from localStorage', () => {
      const session: GameSession = {
        guestPeerId: 'guest-abc',
        hostPeerId: 'host-xyz',
        nickname: 'Player1',
        timestamp: Date.now()
      };
      localStorageMock.setItem('royalletters_session', JSON.stringify(session));

      const result = loadSession();

      expect(result).not.toBeNull();
      expect(result?.guestPeerId).toBe('guest-abc');
    });

    it('should return null and clear expired session', () => {
      const expiredSession: GameSession = {
        guestPeerId: 'guest-abc',
        hostPeerId: 'host-xyz',
        nickname: 'Player1',
        timestamp: Date.now() - (31 * 60 * 1000) // 31 minutes ago
      };
      localStorageMock.setItem('royalletters_session', JSON.stringify(expiredSession));

      const result = loadSession();

      expect(result).toBeNull();
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('royalletters_session');
    });
  });

  describe('clearSession', () => {
    it('should remove session from localStorage', () => {
      clearSession();
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('royalletters_session');
    });

    it('should set savedSession store to null', () => {
      savedSession.set({ guestPeerId: 'test', hostPeerId: 'host', nickname: 'Test', timestamp: Date.now() });
      clearSession();
      expect(get(savedSession)).toBeNull();
    });
  });

  describe('hasValidSession', () => {
    it('should return false when no session exists', () => {
      expect(hasValidSession()).toBe(false);
    });

    it('should return true when valid session exists', () => {
      const session: GameSession = {
        guestPeerId: 'guest-abc',
        hostPeerId: 'host-xyz',
        nickname: 'Player1',
        timestamp: Date.now()
      };
      localStorageMock.setItem('royalletters_session', JSON.stringify(session));

      expect(hasValidSession()).toBe(true);
    });
  });

  describe('getSessionAge', () => {
    it('should return "just now" for recent sessions', () => {
      const session: GameSession = {
        guestPeerId: 'test',
        hostPeerId: 'host',
        nickname: 'Test',
        timestamp: Date.now() - 30000 // 30 seconds ago
      };
      expect(getSessionAge(session)).toBe('just now');
    });

    it('should return "1 minute ago" for 1 minute old session', () => {
      const session: GameSession = {
        guestPeerId: 'test',
        hostPeerId: 'host',
        nickname: 'Test',
        timestamp: Date.now() - 60000 // 1 minute ago
      };
      expect(getSessionAge(session)).toBe('1 minute ago');
    });

    it('should return "X minutes ago" for older sessions', () => {
      const session: GameSession = {
        guestPeerId: 'test',
        hostPeerId: 'host',
        nickname: 'Test',
        timestamp: Date.now() - (15 * 60000) // 15 minutes ago
      };
      expect(getSessionAge(session)).toBe('15 minutes ago');
    });

    it('should return "1 hour ago" for 1 hour old session', () => {
      const session: GameSession = {
        guestPeerId: 'test',
        hostPeerId: 'host',
        nickname: 'Test',
        timestamp: Date.now() - (60 * 60000) // 1 hour ago
      };
      expect(getSessionAge(session)).toBe('1 hour ago');
    });
  });
});

