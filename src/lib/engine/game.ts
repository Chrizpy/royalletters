import { v4 as uuidv4 } from 'uuid';
import type {
  GameState,
  GameConfig,
  PlayerState,
  GameAction,
  ActionResult,
  LogEntry,
  TOKENS_TO_WIN,
} from '../types';
import { createDeck, shuffle, getCardDefinition } from './deck';

const TOKENS_TO_WIN_MAP: Record<number, number> = {
  2: 7,
  3: 5,
  4: 4,
};

export class GameEngine {
  private state: GameState;

  constructor() {
    this.state = this.createEmptyState();
  }

  private createEmptyState(): GameState {
    return {
      players: [],
      deck: [],
      burnedCard: null,
      activePlayerIndex: 0,
      phase: 'LOBBY',
      pendingAction: null,
      winnerId: null,
      logs: [],
      rngSeed: '',
      roundCount: 0,
    };
  }

  /**
   * Initialize the game with players
   */
  init(config: GameConfig): void {
    const players: PlayerState[] = config.players.map((p) => ({
      id: p.id,
      name: p.name,
      avatarId: p.avatarId || 'default',
      hand: [],
      discardPile: [],
      tokens: 0,
      status: 'PLAYING',
      isHost: p.isHost || false,
    }));

    this.state = {
      ...this.createEmptyState(),
      players,
      phase: 'LOBBY',
    };

    this.addLog('Game initialized');
  }

  /**
   * Start a new round
   */
  startRound(): void {
    // Generate new RNG seed for this round
    const rngSeed = uuidv4();
    this.state.rngSeed = rngSeed;
    this.state.roundCount++;

    // Reset player states for new round
    this.state.players = this.state.players.map((p) => ({
      ...p,
      hand: [],
      discardPile: [],
      status: p.status === 'WON_ROUND' ? 'PLAYING' : p.status,
    }));

    // Create and shuffle deck
    const deck = shuffle(createDeck(), rngSeed);
    this.state.deck = deck;

    // Burn one card
    this.state.burnedCard = this.state.deck.shift() || null;

    // Deal one card to each player
    for (const player of this.state.players) {
      if (player.status === 'PLAYING') {
        const card = this.state.deck.shift();
        if (card) {
          player.hand.push(card);
        }
      }
    }

    // Set first active player
    this.state.activePlayerIndex = 0;
    this.state.phase = 'TURN_START';

    this.addLog(`Round ${this.state.roundCount} started`);
  }

  /**
   * Draw phase - active player draws a card
   */
  drawPhase(): void {
    if (this.state.phase !== 'TURN_START') {
      throw new Error('Cannot draw - not in TURN_START phase');
    }

    const activePlayer = this.getActivePlayer();
    if (!activePlayer) {
      throw new Error('No active player');
    }

    const card = this.state.deck.shift();
    if (card) {
      activePlayer.hand.push(card);
      this.state.phase = 'WAITING_FOR_ACTION';
      this.addLog(`${activePlayer.name} drew a card`, activePlayer.id);
    } else {
      // Deck is empty - round ends
      this.checkRoundEnd();
    }
  }

  /**
   * Validate if a move is legal
   */
  validateMove(playerId: string, action: GameAction): { valid: boolean; error?: string } {
    // Check if it's the player's turn
    const activePlayer = this.getActivePlayer();
    if (!activePlayer || activePlayer.id !== playerId) {
      return { valid: false, error: 'Not your turn' };
    }

    // Check if phase is correct
    if (this.state.phase !== 'WAITING_FOR_ACTION') {
      return { valid: false, error: 'Not in action phase' };
    }

    // Check if player has the card
    if (!activePlayer.hand.includes(action.cardId)) {
      return { valid: false, error: 'Card not in hand' };
    }

    // Countess rule: If player has Countess + (King or Prince), must play Countess
    const hasCountess = activePlayer.hand.includes('countess');
    const hasKing = activePlayer.hand.includes('king');
    const hasPrince = activePlayer.hand.includes('prince');
    
    if (hasCountess && (hasKing || hasPrince) && action.cardId !== 'countess') {
      return { valid: false, error: 'Must play Countess when holding King or Prince' };
    }

    // Get card definition
    const cardDef = getCardDefinition(action.cardId);
    if (!cardDef) {
      return { valid: false, error: 'Unknown card' };
    }

    // Check if target is required
    if (cardDef.effect.requiresTargetPlayer) {
      if (!action.targetPlayerId) {
        return { valid: false, error: 'Target player required' };
      }

      const targetPlayer = this.state.players.find(p => p.id === action.targetPlayerId);
      if (!targetPlayer) {
        return { valid: false, error: 'Invalid target player' };
      }

      // Check if target is eliminated
      if (targetPlayer.status === 'ELIMINATED') {
        return { valid: false, error: 'Cannot target eliminated player' };
      }

      // Check if target is protected (unless can target self and targeting self)
      if (targetPlayer.status === 'PROTECTED') {
        const isSelfTarget = targetPlayer.id === playerId;
        if (!isSelfTarget || !cardDef.effect.canTargetSelf) {
          return { valid: false, error: 'Cannot target protected player' };
        }
      }

      // Check if can target self
      if (action.targetPlayerId === playerId && !cardDef.effect.canTargetSelf) {
        return { valid: false, error: 'Cannot target yourself with this card' };
      }
    }

    // Guard-specific validation: cannot guess Guard
    if (action.cardId === 'guard' && action.targetCardGuess === 'guard') {
      return { valid: false, error: 'Cannot guess Guard' };
    }

    // Check if targetCardGuess is required
    if (cardDef.effect.requiresTargetCardType && !action.targetCardGuess) {
      return { valid: false, error: 'Target card guess required' };
    }

    return { valid: true };
  }

  /**
   * Apply a card play action
   */
  applyMove(action: GameAction): ActionResult {
    const validation = this.validateMove(action.playerId, action);
    if (!validation.valid) {
      return {
        success: false,
        message: validation.error || 'Invalid move',
        newState: this.state,
      };
    }

    const activePlayer = this.getActivePlayer()!;
    const cardDef = getCardDefinition(action.cardId)!;

    // Remove card from hand and add to discard pile
    activePlayer.hand = activePlayer.hand.filter(c => c !== action.cardId);
    activePlayer.discardPile.push(action.cardId);

    let result: ActionResult = {
      success: true,
      message: `${activePlayer.name} played ${cardDef.name}`,
      newState: this.state,
    };

    this.addLog(`${activePlayer.name} played ${cardDef.name}`, activePlayer.id, action.cardId);

    // Apply card effect
    switch (cardDef.effect.type) {
      case 'GUESS_CARD':
        result = this.applyGuessCard(action, activePlayer);
        break;
      case 'SEE_HAND':
        result = this.applySeeHand(action, activePlayer);
        break;
      case 'COMPARE_HANDS':
        result = this.applyCompareHands(action, activePlayer);
        break;
      case 'PROTECTION':
        result = this.applyProtection(activePlayer);
        break;
      case 'FORCE_DISCARD':
        result = this.applyForceDiscard(action, activePlayer);
        break;
      case 'TRADE_HANDS':
        result = this.applyTradeHands(action, activePlayer);
        break;
      case 'CONDITIONAL_DISCARD':
        result = this.applyConditionalDiscard(activePlayer);
        break;
      case 'LOSE_IF_DISCARDED':
        result = this.applyLoseIfDiscarded(activePlayer);
        break;
    }

    // Advance turn
    this.advanceTurn();

    return result;
  }

  private applyGuessCard(action: GameAction, activePlayer: PlayerState): ActionResult {
    const targetPlayer = this.state.players.find(p => p.id === action.targetPlayerId)!;
    const guess = action.targetCardGuess!;

    if (targetPlayer.hand.includes(guess)) {
      targetPlayer.status = 'ELIMINATED';
      this.addLog(`${targetPlayer.name} was eliminated (had ${guess})`, targetPlayer.id);
      return {
        success: true,
        message: `Correct guess! ${targetPlayer.name} is eliminated`,
        eliminatedPlayerId: targetPlayer.id,
        newState: this.state,
      };
    } else {
      this.addLog(`${activePlayer.name} guessed incorrectly`, activePlayer.id);
      return {
        success: true,
        message: 'Incorrect guess',
        newState: this.state,
      };
    }
  }

  private applySeeHand(action: GameAction, activePlayer: PlayerState): ActionResult {
    const targetPlayer = this.state.players.find(p => p.id === action.targetPlayerId)!;
    const revealedCard = targetPlayer.hand[0] || '';

    this.addLog(`${activePlayer.name} saw ${targetPlayer.name}'s hand`, activePlayer.id);

    return {
      success: true,
      message: `You saw ${targetPlayer.name}'s hand`,
      revealedCard,
      newState: this.state,
    };
  }

  private applyCompareHands(action: GameAction, activePlayer: PlayerState): ActionResult {
    const targetPlayer = this.state.players.find(p => p.id === action.targetPlayerId)!;
    
    const activeCard = activePlayer.hand[0];
    const targetCard = targetPlayer.hand[0];

    if (!activeCard || !targetCard) {
      return {
        success: true,
        message: 'Comparison failed - missing cards',
        newState: this.state,
      };
    }

    const activeValue = getCardDefinition(activeCard)?.value || 0;
    const targetValue = getCardDefinition(targetCard)?.value || 0;

    if (activeValue < targetValue) {
      activePlayer.status = 'ELIMINATED';
      this.addLog(`${activePlayer.name} was eliminated (lower card)`, activePlayer.id);
      return {
        success: true,
        message: `You lost the comparison and are eliminated`,
        eliminatedPlayerId: activePlayer.id,
        newState: this.state,
      };
    } else if (targetValue < activeValue) {
      targetPlayer.status = 'ELIMINATED';
      this.addLog(`${targetPlayer.name} was eliminated (lower card)`, targetPlayer.id);
      return {
        success: true,
        message: `${targetPlayer.name} had lower card and is eliminated`,
        eliminatedPlayerId: targetPlayer.id,
        newState: this.state,
      };
    } else {
      this.addLog('Comparison was a tie', activePlayer.id);
      return {
        success: true,
        message: 'Tie - no one eliminated',
        newState: this.state,
      };
    }
  }

  private applyProtection(activePlayer: PlayerState): ActionResult {
    activePlayer.status = 'PROTECTED';
    this.addLog(`${activePlayer.name} is protected`, activePlayer.id);
    return {
      success: true,
      message: 'You are protected until your next turn',
      newState: this.state,
    };
  }

  private applyForceDiscard(action: GameAction, activePlayer: PlayerState): ActionResult {
    const targetPlayer = this.state.players.find(p => p.id === action.targetPlayerId)!;
    
    const discardedCard = targetPlayer.hand.shift();
    if (discardedCard) {
      targetPlayer.discardPile.push(discardedCard);
      this.addLog(`${targetPlayer.name} discarded ${discardedCard}`, targetPlayer.id, discardedCard);

      // If Princess was discarded, target is eliminated
      if (discardedCard === 'princess') {
        targetPlayer.status = 'ELIMINATED';
        this.addLog(`${targetPlayer.name} was eliminated (discarded Princess)`, targetPlayer.id);
        return {
          success: true,
          message: `${targetPlayer.name} discarded Princess and is eliminated`,
          eliminatedPlayerId: targetPlayer.id,
          newState: this.state,
        };
      }

      // Draw new card
      const newCard = this.state.deck.shift();
      if (newCard) {
        targetPlayer.hand.push(newCard);
        this.addLog(`${targetPlayer.name} drew a new card`, targetPlayer.id);
      }
    }

    return {
      success: true,
      message: `${targetPlayer.name} discarded and drew a new card`,
      newState: this.state,
    };
  }

  private applyTradeHands(action: GameAction, activePlayer: PlayerState): ActionResult {
    const targetPlayer = this.state.players.find(p => p.id === action.targetPlayerId)!;
    
    const temp = activePlayer.hand;
    activePlayer.hand = targetPlayer.hand;
    targetPlayer.hand = temp;

    this.addLog(`${activePlayer.name} and ${targetPlayer.name} traded hands`, activePlayer.id);

    return {
      success: true,
      message: `You traded hands with ${targetPlayer.name}`,
      newState: this.state,
    };
  }

  private applyConditionalDiscard(activePlayer: PlayerState): ActionResult {
    // Countess has no effect when played
    return {
      success: true,
      message: 'Countess played',
      newState: this.state,
    };
  }

  private applyLoseIfDiscarded(activePlayer: PlayerState): ActionResult {
    // If Princess is discarded (played), player is eliminated
    activePlayer.status = 'ELIMINATED';
    this.addLog(`${activePlayer.name} was eliminated (played Princess)`, activePlayer.id);
    return {
      success: true,
      message: 'You played Princess and are eliminated',
      eliminatedPlayerId: activePlayer.id,
      newState: this.state,
    };
  }

  /**
   * Advance to next player's turn
   */
  advanceTurn(): void {
    // Reset protection status for the current player (it only lasts until their next turn)
    const currentPlayer = this.getActivePlayer();
    if (currentPlayer && currentPlayer.status === 'PROTECTED') {
      currentPlayer.status = 'PLAYING';
    }

    // Check if round should end
    if (this.checkRoundEnd()) {
      return;
    }

    // Find next non-eliminated player
    const startIndex = this.state.activePlayerIndex;
    let nextIndex = (startIndex + 1) % this.state.players.length;

    while (nextIndex !== startIndex) {
      const player = this.state.players[nextIndex];
      if (player.status !== 'ELIMINATED') {
        this.state.activePlayerIndex = nextIndex;
        this.state.phase = 'TURN_START';
        return;
      }
      nextIndex = (nextIndex + 1) % this.state.players.length;
    }

    // If we get here, only one player remains (the current one)
    this.checkRoundEnd();
  }

  /**
   * Check if round should end
   */
  checkRoundEnd(): boolean {
    // Count active players
    const activePlayers = this.state.players.filter(p => p.status !== 'ELIMINATED');

    // Round ends if only 1 player remains
    if (activePlayers.length <= 1) {
      this.state.phase = 'ROUND_END';
      this.determineRoundWinner();
      return true;
    }

    // Round ends if deck is empty
    if (this.state.deck.length === 0) {
      this.state.phase = 'ROUND_END';
      this.determineRoundWinner();
      return true;
    }

    return false;
  }

  /**
   * Determine the winner of the round
   */
  determineRoundWinner(): void {
    const activePlayers = this.state.players.filter(p => p.status !== 'ELIMINATED');

    if (activePlayers.length === 0) {
      this.addLog('No winner this round');
      return;
    }

    // Find player(s) with highest card value
    let highestValue = 0;
    let winners: PlayerState[] = [];

    for (const player of activePlayers) {
      const card = player.hand[0];
      if (card) {
        const value = getCardDefinition(card)?.value || 0;
        if (value > highestValue) {
          highestValue = value;
          winners = [player];
        } else if (value === highestValue) {
          winners.push(player);
        }
      }
    }

    // Award token to winner (if there's a single winner)
    if (winners.length === 1) {
      const winner = winners[0];
      winner.tokens++;
      winner.status = 'WON_ROUND';
      this.addLog(`${winner.name} won the round!`, winner.id);

      // Check if game is over
      this.checkGameEnd();
    } else {
      this.addLog('Round ended in a tie');
    }
  }

  /**
   * Check if game should end
   */
  checkGameEnd(): void {
    const playerCount = this.state.players.length;
    const tokensNeeded = TOKENS_TO_WIN_MAP[playerCount] || 4;

    for (const player of this.state.players) {
      if (player.tokens >= tokensNeeded) {
        this.state.phase = 'GAME_END';
        this.state.winnerId = player.id;
        this.addLog(`${player.name} won the game!`, player.id);
        return;
      }
    }
  }

  /**
   * Get current game state
   */
  getState(): GameState {
    return JSON.parse(JSON.stringify(this.state));
  }

  /**
   * Set game state (for P2P sync)
   */
  setState(state: GameState): void {
    this.state = JSON.parse(JSON.stringify(state));
  }

  /**
   * Add log entry
   */
  addLog(message: string, actorId?: string, cardId?: string): void {
    const entry: LogEntry = {
      timestamp: Date.now(),
      message,
      actorId,
      cardId,
    };
    this.state.logs.push(entry);
  }

  /**
   * Get active player
   */
  private getActivePlayer(): PlayerState | null {
    return this.state.players[this.state.activePlayerIndex] || null;
  }
}
