import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import {
  chatMessages,
  unreadChatCount,
  addChatMessage,
  clearUnreadChatCount,
  clearChatMessages
} from './chat';
import type { ChatMessage } from './chat';

describe('Chat Store', () => {
  beforeEach(() => {
    clearChatMessages();
  });

  describe('initial state', () => {
    it('should start with empty messages', () => {
      expect(get(chatMessages)).toEqual([]);
    });

    it('should start with zero unread count', () => {
      expect(get(unreadChatCount)).toBe(0);
    });
  });

  describe('addChatMessage', () => {
    it('should add a message to the list', () => {
      const msg: ChatMessage = {
        id: 'msg1',
        senderId: 'p1',
        senderName: 'Alice',
        text: 'Hello!',
        timestamp: Date.now()
      };

      addChatMessage(msg);

      const messages = get(chatMessages);
      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual(msg);
    });

    it('should increment unread count', () => {
      const msg: ChatMessage = {
        id: 'msg1',
        senderId: 'p1',
        senderName: 'Alice',
        text: 'Hello!',
        timestamp: Date.now()
      };

      addChatMessage(msg);
      expect(get(unreadChatCount)).toBe(1);

      addChatMessage({ ...msg, id: 'msg2' });
      expect(get(unreadChatCount)).toBe(2);
    });

    it('should preserve message order', () => {
      const msg1: ChatMessage = {
        id: 'msg1',
        senderId: 'p1',
        senderName: 'Alice',
        text: 'First',
        timestamp: 1000
      };
      const msg2: ChatMessage = {
        id: 'msg2',
        senderId: 'p2',
        senderName: 'Bob',
        text: 'Second',
        timestamp: 2000
      };

      addChatMessage(msg1);
      addChatMessage(msg2);

      const messages = get(chatMessages);
      expect(messages[0].text).toBe('First');
      expect(messages[1].text).toBe('Second');
    });
  });

  describe('clearUnreadChatCount', () => {
    it('should reset unread count to zero', () => {
      addChatMessage({
        id: 'msg1',
        senderId: 'p1',
        senderName: 'Alice',
        text: 'Hello!',
        timestamp: Date.now()
      });
      addChatMessage({
        id: 'msg2',
        senderId: 'p1',
        senderName: 'Alice',
        text: 'World!',
        timestamp: Date.now()
      });

      expect(get(unreadChatCount)).toBe(2);

      clearUnreadChatCount();

      expect(get(unreadChatCount)).toBe(0);
    });

    it('should not affect messages', () => {
      addChatMessage({
        id: 'msg1',
        senderId: 'p1',
        senderName: 'Alice',
        text: 'Hello!',
        timestamp: Date.now()
      });

      clearUnreadChatCount();

      expect(get(chatMessages)).toHaveLength(1);
    });
  });

  describe('clearChatMessages', () => {
    it('should clear all messages', () => {
      addChatMessage({
        id: 'msg1',
        senderId: 'p1',
        senderName: 'Alice',
        text: 'Hello!',
        timestamp: Date.now()
      });

      clearChatMessages();

      expect(get(chatMessages)).toEqual([]);
    });

    it('should also reset unread count', () => {
      addChatMessage({
        id: 'msg1',
        senderId: 'p1',
        senderName: 'Alice',
        text: 'Hello!',
        timestamp: Date.now()
      });

      clearChatMessages();

      expect(get(unreadChatCount)).toBe(0);
    });
  });
});
