import { writable } from 'svelte/store';

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
}

export const chatMessages = writable<ChatMessage[]>([]);

export function addChatMessage(msg: ChatMessage) {
  chatMessages.update(msgs => [...msgs, msg]);
}

export function clearChatMessages() {
  chatMessages.set([]);
}
