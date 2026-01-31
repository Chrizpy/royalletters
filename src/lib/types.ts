export type EffectType = 'GUESS_CARD' | 'SEE_HAND' | 'COMPARE_HANDS' | 'PROTECTION' | 'FORCE_DISCARD' | 'TRADE_HANDS' | 'CONDITIONAL_DISCARD' | 'LOSE_IF_DISCARDED';

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

export type GamePhase = 'LOBBY' | 'ROUND_START' | 'TURN_START' | 'WAITING_FOR_ACTION' | 'WAITING_FOR_TARGET' | 'RESOLVING_ACTION' | 'ROUND_END' | 'GAME_END';

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
  activePlayerIndex: number;
  phase: GamePhase;
  pendingAction: PendingAction | null;
  winnerId: string | null;
  logs: LogEntry[];
  rngSeed: string;
  roundCount: number;
}

export interface GameAction {
  type: 'PLAY_CARD';
  playerId: string;
  cardId: string;
  targetPlayerId?: string;
  targetCardGuess?: string;
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
}

export const TOKENS_TO_WIN: Record<number, number> = {
  2: 7,
  3: 5,
  4: 4,
};
