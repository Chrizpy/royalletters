/**
 * Tests for player utilities module
 */

import { describe, it, expect } from 'vitest';
import {
  createPlayers,
  resetPlayersForRound,
  getActivePlayers,
  getPlayersWithCardInDiscard,
  formatPlayerNames,
} from './player';
import type { PlayerState } from '../types';

describe('Player Utilities', () => {
  describe('createPlayers', () => {
    it('should create players with correct initial state', () => {
      const configs = [
        { id: 'p1', name: 'Alice', isHost: true },
        { id: 'p2', name: 'Bob' },
      ];
      
      const players = createPlayers(configs, 'test-seed');
      
      expect(players).toHaveLength(2);
      expect(players[0].id).toBe('p1');
      expect(players[0].name).toBe('Alice');
      expect(players[0].isHost).toBe(true);
      expect(players[0].hand).toEqual([]);
      expect(players[0].discardPile).toEqual([]);
      expect(players[0].tokens).toBe(0);
      expect(players[0].status).toBe('PLAYING');
    });

    it('should assign colors to players', () => {
      const configs = [
        { id: 'p1', name: 'Alice' },
        { id: 'p2', name: 'Bob' },
      ];
      
      const players = createPlayers(configs, 'test-seed');
      
      expect(players[0].color).toBeDefined();
      expect(players[1].color).toBeDefined();
      // Colors should be hex format
      expect(players[0].color).toMatch(/^#[0-9A-F]{6}$/i);
    });

    it('should handle AI players', () => {
      const configs = [
        { id: 'p1', name: 'Alice', isHost: true },
        { id: 'ai1', name: 'Bot', isAI: true },
      ];
      
      const players = createPlayers(configs, 'test-seed');
      
      expect(players[0].isAI).toBe(false);
      expect(players[1].isAI).toBe(true);
    });

    it('should use default avatar when not specified', () => {
      const configs = [{ id: 'p1', name: 'Alice' }];
      const players = createPlayers(configs, 'test-seed');
      expect(players[0].avatarId).toBe('default');
    });

    it('should use provided avatar', () => {
      const configs = [{ id: 'p1', name: 'Alice', avatarId: 'avatar1' }];
      const players = createPlayers(configs, 'test-seed');
      expect(players[0].avatarId).toBe('avatar1');
    });
  });

  describe('resetPlayersForRound', () => {
    it('should reset hand and discard pile', () => {
      const players: PlayerState[] = [{
        id: 'p1',
        name: 'Alice',
        avatarId: 'default',
        color: '#00D4FF',
        hand: ['guard', 'priest'],
        discardPile: ['baron', 'handmaid'],
        tokens: 2,
        status: 'WON_ROUND',
        isHost: true,
      }];
      
      const reset = resetPlayersForRound(players);
      
      expect(reset[0].hand).toEqual([]);
      expect(reset[0].discardPile).toEqual([]);
    });

    it('should reset status to PLAYING', () => {
      const players: PlayerState[] = [
        {
          id: 'p1', name: 'Alice', avatarId: 'default', color: '#00D4FF',
          hand: [], discardPile: [], tokens: 1, status: 'ELIMINATED', isHost: true,
          eliminationReason: 'Lost to Baron',
        },
        {
          id: 'p2', name: 'Bob', avatarId: 'default', color: '#FFD93D',
          hand: [], discardPile: [], tokens: 1, status: 'WON_ROUND', isHost: false,
        },
      ];
      
      const reset = resetPlayersForRound(players);
      
      expect(reset[0].status).toBe('PLAYING');
      expect(reset[1].status).toBe('PLAYING');
    });

    it('should clear elimination reason', () => {
      const players: PlayerState[] = [{
        id: 'p1', name: 'Alice', avatarId: 'default', color: '#00D4FF',
        hand: [], discardPile: [], tokens: 0, status: 'ELIMINATED', isHost: true,
        eliminationReason: 'Guessed correctly',
      }];
      
      const reset = resetPlayersForRound(players);
      
      expect(reset[0].eliminationReason).toBeUndefined();
    });

    it('should preserve tokens', () => {
      const players: PlayerState[] = [{
        id: 'p1', name: 'Alice', avatarId: 'default', color: '#00D4FF',
        hand: [], discardPile: [], tokens: 3, status: 'PLAYING', isHost: true,
      }];
      
      const reset = resetPlayersForRound(players);
      
      expect(reset[0].tokens).toBe(3);
    });
  });

  describe('getActivePlayers', () => {
    const players: PlayerState[] = [
      { id: 'p1', name: 'Alice', avatarId: 'default', color: '#00D4FF', hand: [], discardPile: [], tokens: 0, status: 'PLAYING', isHost: true },
      { id: 'p2', name: 'Bob', avatarId: 'default', color: '#FFD93D', hand: [], discardPile: [], tokens: 0, status: 'ELIMINATED', isHost: false },
      { id: 'p3', name: 'Carol', avatarId: 'default', color: '#32CD32', hand: [], discardPile: [], tokens: 0, status: 'PROTECTED', isHost: false },
    ];

    it('should exclude eliminated players', () => {
      const active = getActivePlayers(players);
      expect(active).toHaveLength(2);
      expect(active.map(p => p.id)).not.toContain('p2');
    });

    it('should include protected players', () => {
      const active = getActivePlayers(players);
      expect(active.map(p => p.id)).toContain('p3');
    });

    it('should include playing players', () => {
      const active = getActivePlayers(players);
      expect(active.map(p => p.id)).toContain('p1');
    });
  });

  describe('getPlayersWithCardInDiscard', () => {
    const players: PlayerState[] = [
      { id: 'p1', name: 'Alice', avatarId: 'default', color: '#00D4FF', hand: [], discardPile: ['spy', 'guard'], tokens: 0, status: 'PLAYING', isHost: true },
      { id: 'p2', name: 'Bob', avatarId: 'default', color: '#FFD93D', hand: [], discardPile: ['spy'], tokens: 0, status: 'ELIMINATED', isHost: false },
      { id: 'p3', name: 'Carol', avatarId: 'default', color: '#32CD32', hand: [], discardPile: ['guard'], tokens: 0, status: 'PLAYING', isHost: false },
    ];

    it('should find players with specific card in discard', () => {
      const withSpy = getPlayersWithCardInDiscard(players, 'spy', false);
      expect(withSpy).toHaveLength(2);
    });

    it('should exclude eliminated players when requested', () => {
      const withSpy = getPlayersWithCardInDiscard(players, 'spy', true);
      expect(withSpy).toHaveLength(1);
      expect(withSpy[0].id).toBe('p1');
    });

    it('should return empty array when no matches', () => {
      const withPrincess = getPlayersWithCardInDiscard(players, 'princess', false);
      expect(withPrincess).toHaveLength(0);
    });
  });

  describe('formatPlayerNames', () => {
    it('should return empty string for empty array', () => {
      expect(formatPlayerNames([])).toBe('');
    });

    it('should return single name for one player', () => {
      expect(formatPlayerNames(['Alice'])).toBe('Alice');
    });

    it('should join two names with "and"', () => {
      expect(formatPlayerNames(['Alice', 'Bob'])).toBe('Alice and Bob');
    });

    it('should use Oxford comma for three+ names', () => {
      expect(formatPlayerNames(['Alice', 'Bob', 'Carol'])).toBe('Alice, Bob, and Carol');
    });

    it('should handle four names', () => {
      expect(formatPlayerNames(['Alice', 'Bob', 'Carol', 'Dave'])).toBe('Alice, Bob, Carol, and Dave');
    });
  });
});
