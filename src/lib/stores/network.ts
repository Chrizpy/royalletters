import { writable } from 'svelte/store';
import type { ConnectionState } from '../network/peer';

export interface ConnectedPlayer {
  id: string;
  name: string;
  avatarId: string;
  isHost: boolean;
}

export const connectionState = writable<ConnectionState>('disconnected');
export const peerId = writable<string>('');
export const remotePeerId = writable<string>('');
export const isHost = writable<boolean | null>(null); // null = not chosen yet
export const connectedPlayers = writable<ConnectedPlayer[]>([]);
