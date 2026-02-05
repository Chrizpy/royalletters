import { writable } from 'svelte/store';

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
}

export const chatMessages = writable<ChatMessage[]>([]);
export const unreadChatCount = writable<number>(0);

export function addChatMessage(msg: ChatMessage) {
  chatMessages.update(msgs => [...msgs, msg]);
  unreadChatCount.update(n => n + 1);
}

export function clearUnreadChatCount() {
  unreadChatCount.set(0);
}

export function clearChatMessages() {
  chatMessages.set([]);
  unreadChatCount.set(0);
}
