import { v4 as uuidv4 } from 'uuid';
import type {
  GameState,
  GameConfig,
  PlayerState,
  GameAction,
  ActionResult,
  LogEntry,
} from '../types';
import { createDeck, shuffle, getCardDefinition, getCardValue } from './deck';
import { getTokensToWin } from './constants';
import { validateCardPlay } from './validation';
import {
  createPlayers,
  resetPlayersForRound,
  getActivePlayers,
  getPlayersWithCardInDiscard,
  formatPlayerNames,
} from './player';
import {
  type EffectContext,
  addLog as addLogUtil,
  applyGuessCard,
  applyGuessCardRevenge,
  applyRevengeGuess,
  applySeeHand,
  applyCompareHands,
  applyProtection,
  applyForceDiscard,
  applyTradeHands,
  applyTradeWithBurnedCard,
  applyConditionalDiscard,
  applyLoseIfDiscarded,
  applySpyBonus,
  applyChancellorDraw,
  applyChancellorReturn,
  validateChancellorReturn,
} from './effects';

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
      winnerIds: [],
      lastRoundWinnerId: null,
      logs: [],
      rngSeed: '',
      roundCount: 0,
      ruleset: 'classic',
      tokensToWin: 4,  // Default, will be set properly in init()
    };
  }

  /**
   * Initialize the game with players
   */
  init(config: GameConfig): void {
    const players = createPlayers(config.players, uuidv4());

    // Calculate default tokens to win based on player count
    const playerCount = players.length;
    const defaultTokensToWin = getTokensToWin(playerCount);
    
    this.state = {
      ...this.createEmptyState(),
      players,
      phase: 'LOBBY',
      ruleset: config.ruleset || 'classic',
      tokensToWin: config.tokensToWin ?? defaultTokensToWin,
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
    this.state.players = resetPlayersForRound(this.state.players);

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
    // Default to player 0, but if there was a winner in the last round, they start
    this.state.activePlayerIndex = 0;
    if (this.state.lastRoundWinnerId) {
      const winnerIndex = this.state.players.findIndex(p => p.id === this.state.lastRoundWinnerId);
      if (winnerIndex !== -1) {
        this.state.activePlayerIndex = winnerIndex;
      }
    }
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
      return validateChancellorReturn(playerId, action, this.state, this.getActivePlayer());
    }
    
    // Delegate to validation module
    return validateCardPlay(this.state, playerId, action, this.getActivePlayer());
  }

  /**
   * Apply a card play action
   */
  applyMove(action: GameAction): ActionResult {
    // Handle Chancellor return action
    if (action.type === 'CHANCELLOR_RETURN') {
      return this.applyChancellorReturnAction(action);
    }
    
    // Handle Revenge guess action (tillbakakaka)
    if (action.type === 'REVENGE_GUESS') {
      return this.applyRevengeGuessAction(action);
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

    // Log the play with target if applicable
    if (action.targetPlayerId) {
      const targetPlayer = this.state.players.find(p => p.id === action.targetPlayerId);
      if (targetPlayer) {
        this.addLog(`${activePlayer.name} played ${cardDef.name} on ${targetPlayer.name}`, activePlayer.id, action.cardId);
      } else {
        this.addLog(`${activePlayer.name} played ${cardDef.name}`, activePlayer.id, action.cardId);
      }
    } else {
      this.addLog(`${activePlayer.name} played ${cardDef.name}`, activePlayer.id, action.cardId);
    }

    // Check if card requires target but no target was provided (all players protected/eliminated)
    if (cardDef.effect.requiresTargetPlayer && !action.targetPlayerId) {
      // House rules: King swaps with burned card when no valid targets
      if (cardDef.effect.type === 'TRADE_HANDS' && this.state.ruleset === 'house' && this.state.burnedCard) {
        const effectResult = applyTradeWithBurnedCard(activePlayer, this.state);
        result = this.toActionResult(effectResult);
      } else {
        // Card fizzles - no valid targets available
        this.addLog(`${cardDef.name} had no effect (no valid targets)`, activePlayer.id);
        result = {
          success: true,
          message: `${cardDef.name} had no effect - all other players are protected or eliminated`,
          newState: this.state,
        };
      }
    } else {
      // Create effect context
      const context: EffectContext = {
        state: this.state,
        action,
        activePlayer,
      };

      // Apply card effect using extracted handlers
      let effectResult;
      switch (cardDef.effect.type) {
        case 'GUESS_CARD':
          effectResult = applyGuessCard(context);
          break;
        case 'GUESS_CARD_REVENGE':
          effectResult = applyGuessCardRevenge(context);
          // If revenge phase started, don't advance turn yet
          if (effectResult.skipTurnAdvance) {
            return this.toActionResult(effectResult);
          }
          break;
        case 'SEE_HAND':
          effectResult = applySeeHand(context);
          break;
        case 'COMPARE_HANDS':
          effectResult = applyCompareHands(context);
          break;
        case 'PROTECTION':
          effectResult = applyProtection(context);
          break;
        case 'FORCE_DISCARD':
          effectResult = applyForceDiscard(context);
          break;
        case 'TRADE_HANDS':
          effectResult = applyTradeHands(context);
          break;
        case 'CONDITIONAL_DISCARD':
          effectResult = applyConditionalDiscard(context);
          break;
        case 'LOSE_IF_DISCARDED':
          effectResult = applyLoseIfDiscarded(context);
          break;
        case 'SPY_BONUS':
          effectResult = applySpyBonus(context);
          break;
        case 'CHANCELLOR_DRAW':
          effectResult = applyChancellorDraw(context);
          // Don't advance turn yet - waiting for player to return cards
          return this.toActionResult(effectResult);
      }
      
      if (effectResult) {
        result = this.toActionResult(effectResult);
      }
    }

    // Advance turn
    this.advanceTurn();

    return result;
  }

  /**
   * Convert an EffectResult to an ActionResult
   */
  private toActionResult(effectResult: { message: string; revealedCard?: string; eliminatedPlayerId?: string }): ActionResult {
    return {
      success: true,
      message: effectResult.message,
      revealedCard: effectResult.revealedCard,
      eliminatedPlayerId: effectResult.eliminatedPlayerId,
      newState: this.state,
    };
  }

  /**
   * Apply revenge guess action using extracted handler
   */
  private applyRevengeGuessAction(action: GameAction): ActionResult {
    const result = applyRevengeGuess(action, this.state);
    
    if (!result.success) {
      return {
        success: false,
        message: result.message,
        newState: this.state,
      };
    }
    
    // Advance turn after revenge guess
    this.advanceTurn();
    
    return {
      success: true,
      message: result.message,
      eliminatedPlayerId: result.eliminatedPlayerId,
      newState: this.state,
    };
  }

  /**
   * Apply Chancellor return action using extracted handler
   */
  private applyChancellorReturnAction(action: GameAction): ActionResult {
    const validation = validateChancellorReturn(action.playerId, action, this.state, this.getActivePlayer());
    if (!validation.valid) {
      return {
        success: false,
        message: validation.error || 'Invalid action',
        newState: this.state,
      };
    }
    
    const activePlayer = this.getActivePlayer()!;
    const effectResult = applyChancellorReturn(action, this.state, activePlayer);
    
    // Advance turn after Chancellor return
    this.advanceTurn();
    
    return this.toActionResult(effectResult);
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
    const activePlayers = getActivePlayers(this.state.players);

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
    const activePlayers = getActivePlayers(this.state.players);

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

    // Award tokens to ALL winners (including ties)
    if (winners.length > 0) {
      for (const winner of winners) {
        winner.tokens++;
        winner.status = 'WON_ROUND';
      }
      
      // Set lastRoundWinnerId to first winner (for turn order in next round)
      // When there's a tie, the first winner in player order starts the next round
      this.state.lastRoundWinnerId = winners[0].id;
      
      // Log appropriate message with card info
      const winningCard = winners[0].hand[0];
      const cardDef = getCardDefinition(winningCard);
      const cardInfo = cardDef ? `${cardDef.name} (${cardDef.value})` : winningCard;
      
      if (winners.length === 1) {
        this.addLog(`${winners[0].name} won with ${cardInfo}!`, winners[0].id);
      } else {
        const winnerNames = formatPlayerNames(winners.map(w => w.name));
        this.addLog(`${winnerNames} tied with ${cardInfo}!`);
      }
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
    const playersWithSpy = getPlayersWithCardInDiscard(this.state.players, 'spy', true);
    
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
    const tokensNeeded = this.state.tokensToWin;

    // Find all players who have reached the token threshold
    const qualifyingPlayers = this.state.players.filter(p => p.tokens >= tokensNeeded);
    
    if (qualifyingPlayers.length === 0) {
      return; // No one has won yet
    }
    
    // If only one player reached the threshold, they win
    if (qualifyingPlayers.length === 1) {
      this.state.phase = 'GAME_END';
      this.state.winnerIds = [qualifyingPlayers[0].id];
      this.addLog(`${qualifyingPlayers[0].name} won the game!`, qualifyingPlayers[0].id);
      return;
    }
    
    // Multiple players reached threshold - apply Spy bonus priority rule
    // Only players who won the round (status WON_ROUND) are considered winners
    const roundWinners = qualifyingPlayers.filter(p => p.status === 'WON_ROUND');
    
    if (roundWinners.length > 0) {
      // If any qualifying players won the round, only they are winners
      this.state.phase = 'GAME_END';
      this.state.winnerIds = roundWinners.map(p => p.id);
      
      const winnerNames = formatPlayerNames(roundWinners.map(w => w.name));
      this.addLog(`${winnerNames} win the game!`);
    } else {
      // All qualifying players reached threshold via Spy bonus only
      // This is an edge case - all win
      this.state.phase = 'GAME_END';
      this.state.winnerIds = qualifyingPlayers.map(p => p.id);
      
      const winnerNames = formatPlayerNames(qualifyingPlayers.map(w => w.name));
      this.addLog(`${winnerNames} win the game!`);
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
