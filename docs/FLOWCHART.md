# Royal Letters - Logic Flow Guide

This document describes the key flows in the Royal Letters codebase using visual diagrams.
Use this to quickly understand where to look when debugging or adding features.

> 💡 **Tip:** See [ARCHITECTURE.md](./ARCHITECTURE.md) for the structural overview.

---

## Table of Contents

1. [Application Startup](#1-application-startup)
2. [Hosting a Game](#2-hosting-a-game)
3. [Joining a Game](#3-joining-a-game)
4. [Playing a Card](#4-playing-a-card)
5. [Card Effect Resolution](#5-card-effect-resolution)
6. [Network Synchronization](#6-network-synchronization)
7. [Turn & Round Flow](#7-turn--round-flow)
8. [Special Flows](#8-special-flows)

---

## 1. Application Startup

**Entry:** `src/main.ts` → `src/App.svelte`

```
┌─────────────────────────────────────────────────────────────────┐
│                         App.svelte                              │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
                ┌───────────────────────┐
                │  Check for saved      │
                │  session (onMount)    │
                └───────────┬───────────┘
                            │
            ┌───────────────┴───────────────┐
            ▼                               ▼
    ┌───────────────┐               ┌───────────────┐
    │ Session found │               │ No session    │
    │ → RejoinPrompt│               │ → LobbyScreen │
    └───────────────┘               └───────────────┘
                                            │
                        ┌───────────────────┼───────────────────┐
                        ▼                   ▼                   ▼
                ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
                │ "Host Game"  │    │ "Join Game"  │    │  (Settings)  │
                │  → HostLobby │    │  → JoinGame  │    │              │
                └──────────────┘    └──────────────┘    └──────────────┘
```

**Key files:**
- [App.svelte](../src/App.svelte) - Routing logic
- [session.ts](../src/lib/stores/session.ts) - Session persistence
- [LobbyScreen.svelte](../src/lib/components/LobbyScreen.svelte) - Main menu

---

## 2. Hosting a Game

**Flow:** User clicks "Host Game"

```
┌────────────────────────────────────────────────────────────────────────┐
│                           HostLobby.svelte                             │
└────────────────────────────────┬───────────────────────────────────────┘
                                 │
        ┌────────────────────────┴────────────────────────────┐
        ▼                                                     │
┌───────────────────┐                                         │
│ 1. Create PeerJS  │  stores/network.ts                      │
│    connection     │  → setAsHost()                          │
│    (get peer ID)  │  → PeerManager.create()                 │
└────────┬──────────┘                                         │
         │                                                    │
         ▼                                                    │
┌───────────────────┐                                         │
│ 2. Display lobby  │  Show game code (peer ID)               │
│    with game code │  Wait for players to join               │
└────────┬──────────┘                                         │
         │                                                    │
         │  ◄─── Guest connects (WebRTC) ────────────────────┤
         │                                                    │
         ▼                                                    │
┌───────────────────┐                                         │
│ 3. Receive        │  network/sync.ts                        │
│    PLAYER_JOINED  │  → handlePlayerJoined()                 │
│    message        │  → Add player to lobby list             │
└────────┬──────────┘                                         │
         │                                                    │
         ▼                                                    │
┌───────────────────┐                                         │
│ 4. Host clicks    │  stores/game.ts                         │
│    "Start Game"   │  → initGame(players, ruleset)           │
│                   │  → startRound()                         │
└────────┬──────────┘                                         │
         │                                                    │
         ▼                                                    │
┌───────────────────┐                                         │
│ 5. Broadcast      │  network/sync.ts                        │
│    GAME_STATE_SYNC│  → broadcastState()                     │
│    to all guests  │  All clients now have same state        │
└────────┬──────────┘                                         │
         │                                                    │
         ▼                                                    │
┌───────────────────────────────────────────────────────────────────────┐
│                           GameScreen.svelte                           │
│                         (all players see this)                        │
└───────────────────────────────────────────────────────────────────────┘
```

**Key files:**
- [HostLobby.svelte](../src/lib/components/HostLobby.svelte) - Host UI
- [network.ts (store)](../src/lib/stores/network.ts) - Network state
- [peer.ts](../src/lib/network/peer.ts) - PeerJS wrapper
- [sync.ts](../src/lib/network/sync.ts) - Message handling

---

## 3. Joining a Game

**Flow:** User enters game code and clicks "Join"

```
┌────────────────────────────────────────────────────────────────────────┐
│                           JoinGame.svelte                              │
└────────────────────────────────┬───────────────────────────────────────┘
                                 │
         ┌───────────────────────┴───────────────────────┐
         ▼                                               │
┌────────────────────┐                                   │
│ 1. Create PeerJS   │  stores/network.ts                │
│    connection      │  → setAsGuest()                   │
│    with own ID     │  → PeerManager.create()           │
└─────────┬──────────┘                                   │
          │                                              │
          ▼                                              │
┌────────────────────┐                                   │
│ 2. Connect to      │  PeerManager.connectToPeer()      │
│    host's peer ID  │  (WebRTC connection)              │
└─────────┬──────────┘                                   │
          │                                              │
          ▼                                              │
┌────────────────────┐                                   │
│ 3. Send            │  network/sync.ts                  │
│    PLAYER_JOINED   │  → sendToHost()                   │
│    message         │                                   │
└─────────┬──────────┘                                   │
          │                                              │
          │  ◄─── Host sends PLAYER_INFO ───────────────┤
          │                                              │
          ▼                                              │
┌────────────────────┐                                   │
│ 4. Display lobby   │  Show player list                 │
│    (waiting)       │  Wait for host to start           │
└─────────┬──────────┘                                   │
          │                                              │
          │  ◄─── Host sends GAME_STATE_SYNC ───────────┤
          │                                              │
          ▼                                              │
┌───────────────────────────────────────────────────────────────────────┐
│                           GameScreen.svelte                           │
└───────────────────────────────────────────────────────────────────────┘
```

---

## 4. Playing a Card

**Flow:** Player selects and plays a card

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           GameScreen.svelte                             │
│                                                                         │
│   ┌───────────────┐    ┌─────────────────┐    ┌────────────────────┐   │
│   │  Player's     │    │  Target         │    │  Guess Selector    │   │
│   │  Hand (Cards) │───▶│  Selector       │───▶│  (for Guard)       │   │
│   │               │    │  (if needed)    │    │  (if needed)       │   │
│   └───────────────┘    └─────────────────┘    └──────────┬─────────┘   │
│                                                          │             │
└──────────────────────────────────────────────────────────┼─────────────┘
                                                           │
                                                           ▼
                              ┌─────────────────────────────────────────┐
                              │  stores/game.ts → applyAction()         │
                              │                                         │
                              │  Creates GameAction:                    │
                              │  {                                      │
                              │    type: 'PLAY_CARD',                   │
                              │    playerId: 'p1',                      │
                              │    cardId: 'guard',                     │
                              │    targetPlayerId: 'p2',                │
                              │    targetCardGuess: 'priest'            │
                              │  }                                      │
                              └──────────────────┬──────────────────────┘
                                                 │
                   ┌─────────────────────────────┴─────────────────────────┐
                   │                                                       │
                   ▼                                                       ▼
           ┌───────────────┐                                    ┌──────────────────┐
           │ LOCAL PLAY    │                                    │ NETWORKED PLAY   │
           │ (AI or Solo)  │                                    │ (Multiplayer)    │
           └───────┬───────┘                                    └────────┬─────────┘
                   │                                                     │
                   ▼                                                     ▼
           ┌───────────────┐                                    ┌──────────────────┐
           │ engine/game.ts│                                    │ network/sync.ts  │
           │ → applyMove() │                                    │ → sendAction()   │
           └───────┬───────┘                                    └────────┬─────────┘
                   │                                                     │
                   │                                                     ▼
                   │                                            ┌──────────────────┐
                   │                                            │ HOST receives    │
                   │                                            │ PLAYER_ACTION    │
                   │                                            │ → applyMove()    │
                   │                                            │ → broadcastState │
                   │                                            └────────┬─────────┘
                   │                                                     │
                   └─────────────────────┬───────────────────────────────┘
                                         │
                                         ▼
                              ┌──────────────────────────────────────────┐
                              │  GameEngine.applyMove()                  │
                              │  → validateMove()                        │
                              │  → Remove card from hand                 │
                              │  → Add to discard pile                   │
                              │  → Apply card effect (see next section)  │
                              │  → advanceTurn()                         │
                              │  → Return ActionResult                   │
                              └──────────────────────────────────────────┘
```

**Key files:**
- [GameScreen.svelte](../src/lib/components/GameScreen.svelte) - UI & interaction
- [game.ts (store)](../src/lib/stores/game.ts) - Action dispatching
- [game.ts (engine)](../src/lib/engine/game.ts) - Core logic
- [validation.ts](../src/lib/engine/validation.ts) - Move validation

---

## 5. Card Effect Resolution

**Flow:** Inside `GameEngine.applyMove()` after card is played

```
                              ┌──────────────────────────────────┐
                              │ Get CardDefinition from cards.json│
                              │ → effect.type determines handler  │
                              └───────────────┬──────────────────┘
                                              │
            ┌─────────────────────────────────┼─────────────────────────────────┐
            │                                 │                                 │
            ▼                                 ▼                                 ▼
    ┌───────────────┐               ┌───────────────┐               ┌───────────────┐
    │ GUESS_CARD    │               │ COMPARE_HANDS │               │ TRADE_HANDS   │
    │ (Guard)       │               │ (Baron)       │               │ (King)        │
    │               │               │               │               │               │
    │ effects/      │               │ effects/      │               │ effects/      │
    │  guard.ts     │               │  baron.ts     │               │  king.ts      │
    └───────┬───────┘               └───────┬───────┘               └───────┬───────┘
            │                               │                               │
            ▼                               ▼                               ▼
    ┌───────────────┐               ┌───────────────┐               ┌───────────────┐
    │ Check if      │               │ Compare card  │               │ Swap hands    │
    │ guess matches │               │ values        │               │ between       │
    │ target's hand │               │               │               │ players       │
    └───────┬───────┘               └───────┬───────┘               └───────┬───────┘
            │                               │                               │
            ▼                               ▼                               ▼
    ┌───────────────┐               ┌───────────────┐               ┌───────────────┐
    │ MATCH:        │               │ Lower value   │               │ Return        │
    │ Eliminate     │               │ player is     │               │ EffectResult  │
    │ target        │               │ eliminated    │               │               │
    │               │               │               │               │               │
    │ NO MATCH:     │               │ Tie: nothing  │               │               │
    │ Nothing       │               │               │               │               │
    └───────────────┘               └───────────────┘               └───────────────┘

                        ┌─────────────────────────────────────┐
                        │         OTHER EFFECTS               │
                        ├─────────────────────────────────────┤
                        │ SEE_HAND (Priest) → Reveal card     │
                        │ PROTECTION (Handmaid) → Set status  │
                        │ FORCE_DISCARD (Prince) → Discard    │
                        │ CONDITIONAL_DISCARD (Countess)      │
                        │ LOSE_IF_DISCARDED (Princess)        │
                        │ SPY_BONUS (Spy) → Token at round end│
                        │ CHANCELLOR_DRAW → Special phase     │
                        │ GUESS_CARD_REVENGE (🍪) → Revenge   │
                        └─────────────────────────────────────┘
```

**Key files:**
- [effects/index.ts](../src/lib/engine/effects/index.ts) - Effect registry
- [effects/types.ts](../src/lib/engine/effects/types.ts) - Interfaces
- [effects/*.ts](../src/lib/engine/effects/) - Individual effect handlers
- [cards.json](../src/lib/data/cards.json) - Card definitions (source of truth)

---

## 6. Network Synchronization

**Flow:** How state stays in sync across all players

```
                    HOST                                      GUESTS
                      │                                          │
    ┌─────────────────┴─────────────────┐                        │
    │                                   │                        │
    ▼                                   │                        │
┌──────────────────┐                    │                        │
│ GameEngine       │                    │                        │
│ (authoritative)  │                    │                        │
│                  │                    │                        │
│ All game logic   │                    │                        │
│ runs HERE        │                    │                        │
└────────┬─────────┘                    │                        │
         │                              │                        │
         ▼                              │                        │
┌──────────────────┐                    │                        │
│ State changes    │                    │                        │
│ → gameState.set()│                    │                        │
└────────┬─────────┘                    │                        │
         │                              │                        │
         ▼                              │                        │
┌──────────────────┐     GAME_STATE_SYNC (WebRTC)                │
│ broadcastState() │─────────────────────────────────────────────▶
│                  │                                              │
└──────────────────┘                                              │
                                                                  ▼
                                                    ┌──────────────────────┐
                                                    │ sync.ts              │
                                                    │ handleGameStateSync()│
                                                    └───────────┬──────────┘
                                                                │
                                                                ▼
                                                    ┌──────────────────────┐
                                                    │ setGameState(state)  │
                                                    │ → gameState.set()    │
                                                    └───────────┬──────────┘
                                                                │
                                                                ▼
                                                    ┌──────────────────────┐
                                                    │ UI updates via       │
                                                    │ Svelte reactivity    │
                                                    └──────────────────────┘


   ┌────────────────────────────────────────────────────────────────────┐
   │                        MESSAGE TYPES                               │
   ├────────────────────────────────────────────────────────────────────┤
   │ PLAYER_JOINED     │ Guest → Host  │ Announce joining              │
   │ PLAYER_INFO       │ Host → Guest  │ Current player list           │
   │ GAME_STATE_SYNC   │ Host → All    │ Full state (after any change) │
   │ PLAYER_ACTION     │ Any → Host    │ Player plays a card           │
   │ ROUND_START       │ Host → All    │ New round with RNG seed       │
   │ PRIEST_REVEAL     │ Host → One    │ Private card reveal           │
   │ CHAT_MESSAGE      │ Any → All     │ In-game chat                  │
   │ RECONNECT         │ Guest → Host  │ Rejoin after disconnect       │
   └────────────────────────────────────────────────────────────────────┘
```

**Key principle:** Host is authoritative. Guests send actions, host validates and broadcasts resulting state.

---

## 7. Turn & Round Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              GAME PHASES                                    │
└─────────────────────────────────────────────────────────────────────────────┘

  LOBBY ─────▶ ROUND_START ─────▶ ┌──────────────────────────────────────────┐
                                  │                                          │
                                  │    ┌────────────────────────────────┐    │
                                  │    │         TURN LOOP              │    │
                                  │    │                                │    │
                                  │    │  TURN_START                    │    │
                                  │    │      │                         │    │
                                  │    │      ▼                         │    │
                                  │    │  drawPhase()                   │    │
                                  │    │  → Player draws card           │    │
                                  │    │      │                         │    │
                                  │    │      ▼                         │    │
                                  │    │  WAITING_FOR_ACTION            │    │
                                  │    │      │                         │    │
                                  │    │      ▼                         │    │
                                  │    │  Player selects card + target  │    │
                                  │    │      │                         │    │
                                  │    │      ▼                         │    │
                                  │    │  RESOLVING_ACTION              │    │
                                  │    │  → applyMove()                 │    │
                                  │    │      │                         │    │
                                  │    │      ▼                         │    │
                                  │    │  advanceTurn()                 │    │
                                  │    │  → Next player                 │    │
                                  │    │  → Back to TURN_START          │    │
                                  │    │                                │    │
                                  │    └────────────────────────────────┘    │
                                  │                  │                       │
                                  │                  │ Round ends when:      │
                                  │                  │ • Deck empty          │
                                  │                  │ • 1 player left       │
                                  │                  ▼                       │
                                  └──────────▶ ROUND_END                     │
                                                    │                        │
                                                    ▼                        │
                                            Award token to winner            │
                                            Check if game over               │
                                                    │                        │
                                  ┌─────────────────┴──────────────────┐     │
                                  ▼                                    ▼     │
                             GAME_END                         Next ROUND ────┘
                             (display winner)


  ┌─────────────────────────────────────────────────────────────────────┐
  │                    SPECIAL PHASES                                   │
  ├─────────────────────────────────────────────────────────────────────┤
  │ CHANCELLOR_RESOLVING     │ Player must return 2 cards to deck      │
  │ WAITING_FOR_REVENGE_GUESS│ Target gets revenge guess (tillbakakaka)│
  └─────────────────────────────────────────────────────────────────────┘
```

**Key files:**
- [game.ts (engine)](../src/lib/engine/game.ts) - `advanceTurn()`, `checkRoundEnd()`
- [constants.ts](../src/lib/engine/constants.ts) - Tokens to win, etc.

---

## 8. Special Flows

### 8.1 Chancellor Effect (Draw & Return)

```
  Player plays Chancellor
          │
          ▼
  ┌───────────────────┐
  │ Draw 2 cards      │  engine/effects/chancellor.ts
  │ (now has 3 cards) │
  │ phase → CHANCELLOR│
  │ _RESOLVING        │
  └─────────┬─────────┘
            │
            ▼
  ┌───────────────────┐
  │ ChancellorSelector│  components/ChancellorSelector.svelte
  │ shows 3 cards     │
  │ Player picks 2    │
  │ to return         │
  └─────────┬─────────┘
            │
            ▼
  ┌───────────────────┐
  │ CHANCELLOR_RETURN │  GameAction
  │ → applyChancellor │
  │   ReturnAction()  │
  │ → Cards go to     │
  │   bottom of deck  │
  └─────────┬─────────┘
            │
            ▼
  Turn advances normally
```

### 8.2 Tillbakakaka (Cookie Guard) Revenge

```
  Player plays 🍪 Guard and guesses WRONG
          │
          ▼
  ┌───────────────────┐
  │ revengeGuess = {  │  effects/tillbakakaka.ts
  │   revengerId,     │
  │   targetId,       │
  │   originalGuess   │  ← Shows what was guessed
  │ }                 │
  │ phase → WAITING_  │
  │ FOR_REVENGE_GUESS │
  └─────────┬─────────┘
            │
            ▼
  ┌───────────────────┐
  │ GuessSelector     │  components/GuessSelector.svelte
  │ shows to target   │  (with originalGuess displayed)
  │ They guess back   │
  └─────────┬─────────┘
            │
            ▼
  ┌───────────────────┐
  │ REVENGE_GUESS     │  GameAction
  │ → applyRevenge    │
  │   GuessAction()   │
  └─────────┬─────────┘
            │
      ┌─────┴─────┐
      ▼           ▼
  CORRECT      INCORRECT
  → Eliminate  → Nothing
    original
    guesser
            │
            ▼
  Turn advances normally
```

### 8.3 AI Turn

```
  It's an AI player's turn
          │
          ▼
  ┌───────────────────┐
  │ After state sync  │  stores/game.ts or JoinGame.svelte
  │ Check if AI turn  │  → checkAndPlayAI()
  └─────────┬─────────┘
            │
            ▼
  ┌───────────────────┐
  │ engine/ai.ts      │
  │ decideAIMove()    │
  │ → Analyze hand    │
  │ → Pick best card  │
  │ → Select target   │
  │ → Return action   │
  └─────────┬─────────┘
            │
            ▼
  ┌───────────────────┐
  │ applyAction()     │  Same as human player
  │ (small delay for  │
  │  natural feel)    │
  └───────────────────┘
```

---

## Quick Reference: Where to Look

| I want to...                        | Look in...                                    |
|-------------------------------------|-----------------------------------------------|
| Add a new card effect               | `engine/effects/` + `data/cards.json`         |
| Change how cards are validated      | `engine/validation.ts`                        |
| Modify UI for playing cards         | `components/GameScreen.svelte`                |
| Add a new network message type      | `network/messages.ts` + `network/sync.ts`     |
| Change how state syncs              | `network/sync.ts`                             |
| Modify AI behavior                  | `engine/ai.ts`                                |
| Add a new game phase                | `types.ts` (GamePhase) + `engine/game.ts`     |
| Change lobby flow                   | `components/HostLobby.svelte` or `JoinGame.svelte` |
| Persist data (sessions, settings)   | `stores/session.ts`                           |
| Add new UI component                | `components/` + import in parent              |

---

## Data Flow Summary

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   USER INPUT          STORE ACTION         ENGINE            NETWORK        │
│       │                    │                  │                 │           │
│       ▼                    ▼                  ▼                 ▼           │
│   ┌───────┐          ┌──────────┐        ┌────────┐       ┌──────────┐     │
│   │Click  │─────────▶│applyAction│───────▶│applyMove│──────▶│broadcast │     │
│   │Card   │          │()        │        │()      │       │State()  │     │
│   └───────┘          └──────────┘        └────────┘       └────┬─────┘     │
│                            │                  │                 │           │
│                            │                  │                 │           │
│                            ▼                  ▼                 ▼           │
│                      ┌──────────┐        ┌────────┐       ┌──────────┐     │
│                      │gameState │◀───────│Return  │       │Guests    │     │
│                      │.set()    │        │newState│       │receive   │     │
│                      └────┬─────┘        └────────┘       │& set     │     │
│                           │                               └──────────┘     │
│                           ▼                                                 │
│                      ┌──────────┐                                           │
│                      │ Svelte   │                                           │
│                      │ reactivity                                           │
│                      │ → UI     │                                           │
│                      │ updates  │                                           │
│                      └──────────┘                                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

*Last updated: February 2026*
