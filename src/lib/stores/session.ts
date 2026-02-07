import { writable } from 'svelte/store';

const SESSION_KEY = 'royalletters_session';
const SESSION_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

export interface GameSession {
  guestPeerId: string;
  hostPeerId: string;
  nickname: string;
  timestamp: number;
}

// Svelte store for reactive UI updates
export const savedSession = writable<GameSession | null>(null);

/**
 * Save session info to localStorage
 */
export function saveSession(session: Omit<GameSession, 'timestamp'>): void {
  const fullSession: GameSession = {
    ...session,
    timestamp: Date.now()
  };
  
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(fullSession));
    savedSession.set(fullSession);
  } catch (err) {
    console.error('Failed to save session:', err);
  }
}

/**
 * Load session from localStorage (if exists and not expired)
 */
export function loadSession(): GameSession | null {
  try {
    const stored = localStorage.getItem(SESSION_KEY);
    if (!stored) return null;
    
    const session: GameSession = JSON.parse(stored);
    const age = Date.now() - session.timestamp;
    
    if (age > SESSION_EXPIRY_MS) {
      // Session expired
      clearSession();
      return null;
    }
    
    savedSession.set(session);
    return session;
  } catch (err) {
    console.error('Failed to load session:', err);
    return null;
  }
}

/**
 * Clear session from localStorage
 */
export function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
    savedSession.set(null);
  } catch (err) {
    console.error('Failed to clear session:', err);
  }
}

/**
 * Check if there's a valid (non-expired) session
 */
export function hasValidSession(): boolean {
  return loadSession() !== null;
}

/**
 * Get session age in a human-readable format
 */
export function getSessionAge(session: GameSession): string {
  const ageMs = Date.now() - session.timestamp;
  const minutes = Math.floor(ageMs / 60000);
  
  if (minutes < 1) return 'just now';
  if (minutes === 1) return '1 minute ago';
  if (minutes < 60) return `${minutes} minutes ago`;
  
  const hours = Math.floor(minutes / 60);
  if (hours === 1) return '1 hour ago';
  return `${hours} hours ago`;
}
