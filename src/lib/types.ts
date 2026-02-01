export type EffectType = 'GUESS_CARD' | 'SEE_HAND' | 'COMPARE_HANDS' | 'PROTECTION' | 'FORCE_DISCARD' | 'TRADE_HANDS' | 'CONDITIONAL_DISCARD' | 'LOSE_IF_DISCARDED' | 'SPY_BONUS' | 'CHANCELLOR_DRAW';

export type Ruleset = 'classic' | '2019';

export interface CardEffect {
  type: EffectType;
  requiresTargetPlayer?: boolean;
  requiresTargetCardType?: boolean;
  canTargetSelf?: boolean;
  condition?: string[];
}

export interface CardDefinition {
  id: string;
  name: string;
  value: number;
  count: number;
  description: string;
  assetPath: string;
  effect: CardEffect;
}

export type PlayerStatus = 'PLAYING' | 'ELIMINATED' | 'PROTECTED' | 'WON_ROUND';

export interface PlayerState {
  id: string;
  name: string;
  avatarId: string;
  hand: string[]; // Card IDs
  discardPile: string[];
  tokens: number;
  status: PlayerStatus;
  isHost: boolean;
}

export type GamePhase = 'LOBBY' | 'ROUND_START' | 'TURN_START' | 'WAITING_FOR_ACTION' | 'WAITING_FOR_TARGET' | 'RESOLVING_ACTION' | 'CHANCELLOR_RESOLVING' | 'ROUND_END' | 'GAME_END';

export interface LogEntry {
  timestamp: number;
  message: string;
  actorId?: string;
  cardId?: string;
}

export interface PendingAction {
  cardId: string | null;
  targetPlayerId: string | null;
  targetCardGuess: string | null;
}

export interface GameState {
  players: PlayerState[];
  deck: string[];
  burnedCard: string | null;
  burnedCardsFaceUp: string[];  // For 2-player game, 3 additional face-up burned cards
  activePlayerIndex: number;
  phase: GamePhase;
  pendingAction: PendingAction | null;
  winnerId: string | null;
  logs: LogEntry[];
  rngSeed: string;
  roundCount: number;
  ruleset: Ruleset;
  chancellorCards?: string[];  // Cards drawn for Chancellor effect, waiting for player to select which to return
}

export interface GameAction {
  type: 'PLAY_CARD' | 'CHANCELLOR_RETURN';
  playerId: string;
  cardId?: string;
  targetPlayerId?: string;
  targetCardGuess?: string;
  cardsToReturn?: string[];  // For Chancellor effect: the 2 cards to return to deck bottom
}

export interface ActionResult {
  success: boolean;
  message: string;
  revealedCard?: string;
  eliminatedPlayerId?: string;
  newState: GameState;
}

export interface GameConfig {
  players: Array<{
    id: string;
    name: string;
    avatarId?: string;
    isHost?: boolean;
  }>;
  tokensToWin?: number;
  ruleset?: Ruleset;
}

export const TOKENS_TO_WIN: Record<number, number> = {
  2: 6,
  3: 5,
  4: 4,
  5: 3,
  6: 3,
};
