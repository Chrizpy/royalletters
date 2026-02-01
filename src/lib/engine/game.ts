import { v4 as uuidv4 } from 'uuid';
import type {
  GameState,
  GameConfig,
  PlayerState,
  GameAction,
  ActionResult,
  LogEntry,
  TOKENS_TO_WIN,
  Ruleset,
} from '../types';
import { createDeck, shuffle, getCardDefinition, getCardValue } from './deck';

const TOKENS_TO_WIN_MAP: Record<number, number> = {
  2: 6,
  3: 5,
  4: 4,
  5: 3,
  6: 3,
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
      burnedCardsFaceUp: [],
      activePlayerIndex: 0,
      phase: 'LOBBY',
      pendingAction: null,
      winnerId: null,
      logs: [],
      rngSeed: '',
      roundCount: 0,
      ruleset: 'classic',
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
      ruleset: config.ruleset || 'classic',
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
      status: 'PLAYING',  // Reset ALL players to PLAYING for new round
    }));

    // Create and shuffle deck using the configured ruleset
    const deck = shuffle(createDeck(this.state.ruleset), rngSeed);
    this.state.deck = deck;

    // Burn one card face-down
    this.state.burnedCard = this.state.deck.shift() || null;
    
    // For 2-player games, burn 3 additional cards face-up
    this.state.burnedCardsFaceUp = [];
    if (this.state.players.length === 2) {
      for (let i = 0; i < 3; i++) {
        const card = this.state.deck.shift();
        if (card) {
          this.state.burnedCardsFaceUp.push(card);
        }
      }
      if (this.state.burnedCardsFaceUp.length > 0) {
        this.addLog(`Burned face-up: ${this.state.burnedCardsFaceUp.map(c => getCardDefinition(c)?.name).join(', ')}`);
      }
    }

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
    
    // Clear any chancellor state from previous round
    this.state.chancellorCards = undefined;

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
    // Handle Chancellor return action
    if (action.type === 'CHANCELLOR_RETURN') {
      return this.validateChancellorReturn(playerId, action);
    }
    
    // Check if it's the player's turn
    const activePlayer = this.getActivePlayer();
    if (!activePlayer || activePlayer.id !== playerId) {
      return { valid: false, error: 'Not your turn' };
    }

    // Check if phase is correct
    if (this.state.phase !== 'WAITING_FOR_ACTION') {
      return { valid: false, error: 'Not in action phase' };
    }
    
    // Check if cardId is provided for PLAY_CARD action
    if (!action.cardId) {
      return { valid: false, error: 'Card ID required' };
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
      // Check if there are any valid targets available (non-eliminated, non-protected players)
      const validTargets = this.state.players.filter(p => {
        if (p.id === playerId && !cardDef.effect.canTargetSelf) return false;
        if (p.status === 'ELIMINATED') return false;
        if (p.status === 'PROTECTED' && p.id !== playerId) return false;
        return true;
      });

      // If no valid targets exist, the card can be played with no effect (no target required)
      if (validTargets.length === 0) {
        // Card will be played with no effect - this is allowed per Love Letter rules
        return { valid: true };
      }

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

    // Guard-specific validation: cannot guess Guard (but CAN guess Spy in 2019 rules)
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
   * Validate Chancellor return action
   */
  private validateChancellorReturn(playerId: string, action: GameAction): { valid: boolean; error?: string } {
    const activePlayer = this.getActivePlayer();
    if (!activePlayer || activePlayer.id !== playerId) {
      return { valid: false, error: 'Not your turn' };
    }
    
    if (this.state.phase !== 'CHANCELLOR_RESOLVING') {
      return { valid: false, error: 'Not in Chancellor resolving phase' };
    }
    
    if (!action.cardsToReturn || action.cardsToReturn.length !== 2) {
      return { valid: false, error: 'Must return exactly 2 cards' };
    }
    
    // Verify all cards to return are in player's hand
    const handCopy = [...activePlayer.hand];
    for (const cardId of action.cardsToReturn) {
      const index = handCopy.indexOf(cardId);
      if (index === -1) {
        return { valid: false, error: 'Card not in hand' };
      }
      handCopy.splice(index, 1);
    }
    
    return { valid: true };
  }

  /**
   * Apply a card play action
   */
  applyMove(action: GameAction): ActionResult {
    // Handle Chancellor return action
    if (action.type === 'CHANCELLOR_RETURN') {
      return this.applyChancellorReturn(action);
    }
    
    const validation = this.validateMove(action.playerId, action);
    if (!validation.valid) {
      return {
        success: false,
        message: validation.error || 'Invalid move',
        newState: this.state,
      };
    }

    const activePlayer = this.getActivePlayer()!;
    const cardDef = getCardDefinition(action.cardId!)!;

    // Remove only ONE instance of the card from hand and add to discard pile
    const cardIndex = activePlayer.hand.indexOf(action.cardId!);
    if (cardIndex !== -1) {
      activePlayer.hand.splice(cardIndex, 1);
    }
    activePlayer.discardPile.push(action.cardId!);

    let result: ActionResult = {
      success: true,
      message: `${activePlayer.name} played ${cardDef.name}`,
      newState: this.state,
    };

    this.addLog(`${activePlayer.name} played ${cardDef.name}`, activePlayer.id, action.cardId);

    // Check if card requires target but no target was provided (all players protected/eliminated)
    if (cardDef.effect.requiresTargetPlayer && !action.targetPlayerId) {
      // Special case: King (TRADE_HANDS) swaps with the burned card when no valid targets
      if (cardDef.effect.type === 'TRADE_HANDS' && this.state.burnedCard) {
        result = this.applyTradeWithBurnedCard(activePlayer);
      } else {
        // Other cards with no valid targets have no effect
        this.addLog(`${cardDef.name} had no effect (no valid targets)`, activePlayer.id);
        result = {
          success: true,
          message: `${cardDef.name} had no effect - all other players are protected or eliminated`,
          newState: this.state,
        };
      }
    } else {
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
        case 'SPY_BONUS':
          result = this.applySpyBonus(activePlayer);
          break;
        case 'CHANCELLOR_DRAW':
          result = this.applyChancellorDraw(activePlayer);
          // Don't advance turn yet - waiting for player to return cards
          return result;
      }
    }

    // Advance turn
    this.advanceTurn();

    return result;
  }

  private applyGuessCard(action: GameAction, activePlayer: PlayerState): ActionResult {
    const targetPlayer = this.state.players.find(p => p.id === action.targetPlayerId)!;
    const guess = action.targetCardGuess!;

    if (targetPlayer.hand.includes(guess)) {
      // Move the eliminated player's card(s) to their discard pile
      while (targetPlayer.hand.length > 0) {
        const card = targetPlayer.hand.shift()!;
        targetPlayer.discardPile.push(card);
      }
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

    const activeValue = getCardValue(activeCard, this.state.ruleset);
    const targetValue = getCardValue(targetCard, this.state.ruleset);

    if (activeValue < targetValue) {
      // Move the eliminated player's card(s) to their discard pile
      while (activePlayer.hand.length > 0) {
        const card = activePlayer.hand.shift()!;
        activePlayer.discardPile.push(card);
      }
      activePlayer.status = 'ELIMINATED';
      this.addLog(`${activePlayer.name} was eliminated (lower card)`, activePlayer.id);
      return {
        success: true,
        message: `You lost the comparison and are eliminated`,
        eliminatedPlayerId: activePlayer.id,
        newState: this.state,
      };
    } else if (targetValue < activeValue) {
      // Move the eliminated player's card(s) to their discard pile
      while (targetPlayer.hand.length > 0) {
        const card = targetPlayer.hand.shift()!;
        targetPlayer.discardPile.push(card);
      }
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

  private applyTradeWithBurnedCard(activePlayer: PlayerState): ActionResult {
    // When King is played but no valid player targets exist, swap with the burned card
    const burnedCard = this.state.burnedCard;
    if (!burnedCard) {
      // No burned card available - should not happen but handle gracefully
      this.addLog(`King had no effect (no burned card)`, activePlayer.id);
      return {
        success: true,
        message: 'King had no effect - no burned card available',
        newState: this.state,
      };
    }

    // Swap player's card with the burned card
    const playerCard = activePlayer.hand[0];
    activePlayer.hand[0] = burnedCard;
    this.state.burnedCard = playerCard;

    this.addLog(`${activePlayer.name} swapped their card with the burned card`, activePlayer.id);

    return {
      success: true,
      message: 'You swapped your card with the burned card',
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
  
  private applySpyBonus(activePlayer: PlayerState): ActionResult {
    // Spy has no immediate effect when played - bonus is checked at round end
    this.addLog(`${activePlayer.name} played Spy`, activePlayer.id);
    return {
      success: true,
      message: 'Spy played - you may gain a token at round end if you are the only one with a Spy in your discard pile',
      newState: this.state,
    };
  }
  
  private applyChancellorDraw(activePlayer: PlayerState): ActionResult {
    // Draw up to 2 cards from the deck
    const drawnCards: string[] = [];
    for (let i = 0; i < 2; i++) {
      const card = this.state.deck.shift();
      if (card) {
        activePlayer.hand.push(card);
        drawnCards.push(card);
      }
    }
    
    if (drawnCards.length === 0) {
      // No cards to draw - Chancellor has no effect
      this.addLog(`Chancellor had no effect (deck empty)`, activePlayer.id);
      this.advanceTurn();
      return {
        success: true,
        message: 'Chancellor had no effect - deck is empty',
        newState: this.state,
      };
    }
    
    // Store drawn cards info and change phase
    this.state.chancellorCards = drawnCards;
    this.state.phase = 'CHANCELLOR_RESOLVING';
    
    this.addLog(`${activePlayer.name} drew ${drawnCards.length} cards with Chancellor`, activePlayer.id);
    
    return {
      success: true,
      message: `Drew ${drawnCards.length} cards. Select 2 cards to return to the bottom of the deck.`,
      newState: this.state,
    };
  }
  
  private applyChancellorReturn(action: GameAction): ActionResult {
    const validation = this.validateChancellorReturn(action.playerId, action);
    if (!validation.valid) {
      return {
        success: false,
        message: validation.error || 'Invalid action',
        newState: this.state,
      };
    }
    
    const activePlayer = this.getActivePlayer()!;
    const cardsToReturn = action.cardsToReturn!;
    
    // Remove cards from hand and add to bottom of deck
    for (const cardId of cardsToReturn) {
      const index = activePlayer.hand.indexOf(cardId);
      if (index !== -1) {
        activePlayer.hand.splice(index, 1);
        this.state.deck.push(cardId);  // Add to bottom of deck
      }
    }
    
    // Clear chancellor state
    this.state.chancellorCards = undefined;
    
    this.addLog(`${activePlayer.name} returned 2 cards to the deck`, activePlayer.id);
    
    // Now advance turn
    this.advanceTurn();
    
    return {
      success: true,
      message: 'Cards returned to deck',
      newState: this.state,
    };
  }

  /**
   * Advance to next player's turn
   */
  advanceTurn(): void {
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
        
        // Reset protection status for the NEW active player (protection lasts until their next turn)
        if (player.status === 'PROTECTED') {
          player.status = 'PLAYING';
        }
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
      // Still check for Spy bonus even if no winner
      this.checkSpyBonus();
      return;
    }

    // Find player(s) with highest card value
    let highestValue = 0;
    let winners: PlayerState[] = [];

    for (const player of activePlayers) {
      const card = player.hand[0];
      if (card) {
        const value = getCardValue(card, this.state.ruleset);
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
    } else {
      this.addLog('Round ended in a tie');
    }
    
    // Check for Spy bonus (only in 2019 ruleset)
    this.checkSpyBonus();
    
    // Check if game is over
    this.checkGameEnd();
  }
  
  /**
   * Check for Spy bonus at end of round
   * If exactly one non-eliminated player has a Spy in their discard pile, they gain a token
   */
  private checkSpyBonus(): void {
    // Only applies to 2019 ruleset
    if (this.state.ruleset !== '2019') {
      return;
    }
    
    // Find all non-eliminated players who have Spy in their discard pile
    // Eliminated players' spies don't count for the bonus
    const playersWithSpy = this.state.players.filter(p => 
      p.discardPile.includes('spy') && p.status !== 'ELIMINATED'
    );
    
    // If exactly one non-eliminated player has a Spy, they get a bonus token
    if (playersWithSpy.length === 1) {
      const spyPlayer = playersWithSpy[0];
      spyPlayer.tokens++;
      this.addLog(`${spyPlayer.name} gained a token from Spy bonus!`, spyPlayer.id);
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
