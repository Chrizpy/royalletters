# Royal Letters - Architecture Overview

This document describes the high-level architecture of the Royal Letters project,
a peer-to-peer web-based card game built with Svelte and TypeScript.

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BROWSER (Player A)                             │
│  ┌────────────────────┐   ┌──────────────────┐   ┌───────────────────────┐  │
│  │   Svelte UI Layer  │◄──│  Svelte Stores   │◄──│    Game Engine        │  │
│  │   (components/)    │   │   (stores/)      │   │    (engine/)          │  │
│  └────────────────────┘   └──────────────────┘   └───────────────────────┘  │
│                                    ▲                        ▲               │
│                                    │                        │               │
│                           ┌────────┴────────────────────────┘               │
│                           │                                                 │
│                    ┌──────┴──────────┐                                      │
│                    │  Network Layer  │                                      │
│                    │   (network/)    │                                      │
│                    └────────┬────────┘                                      │
└─────────────────────────────┼───────────────────────────────────────────────┘
                              │
                              │  WebRTC (PeerJS)
                              │
┌─────────────────────────────┼───────────────────────────────────────────────┐
│                    ┌────────┴────────┐                                      │
│                    │  Network Layer  │                                      │
│                    │   (network/)    │                                      │
│                    └──────┬──────────┘                                      │
│                           │                                                 │
│                           └────────┬────────────────────────┐               │
│                                    │                        │               │
│                                    ▼                        ▼               │
│  ┌────────────────────┐   ┌──────────────────┐   ┌───────────────────────┐  │
│  │   Svelte UI Layer  │◄──│  Svelte Stores   │◄──│    Game Engine        │  │
│  │   (components/)    │   │   (stores/)      │   │    (engine/)          │  │
│  └────────────────────┘   └──────────────────┘   └───────────────────────┘  │
│                              BROWSER (Player B)                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Directory Structure

```
src/
├── main.ts                 # Application entry point
├── App.svelte              # Root component & routing
│
└── lib/
    ├── types.ts            # Shared TypeScript interfaces
    │
    ├── engine/             # 🎮 Core Game Logic (UI-agnostic)
    │   ├── game.ts         #    GameEngine class - orchestrator
    │   ├── constants.ts    #    Game configuration values
    │   ├── deck.ts         #    Deck creation & card utilities
    │   ├── ai.ts           #    AI player decision-making
    │   ├── rng.ts          #    Seeded random number generator
    │   └── effects/        #    Card effect handlers
    │       ├── index.ts    #    Effect registry & exports
    │       ├── types.ts    #    Effect interfaces
    │       ├── utils.ts    #    Shared utilities
    │       ├── guard.ts    #    Guard (guess card)
    │       ├── priest.ts   #    Priest (see hand)
    │       ├── baron.ts    #    Baron (compare hands)
    │       ├── handmaid.ts #    Handmaid (protection)
    │       ├── prince.ts   #    Prince (force discard)
    │       ├── king.ts     #    King (trade hands)
    │       ├── countess.ts #    Countess (conditional)
    │       ├── princess.ts #    Princess (lose if discarded)
    │       ├── spy.ts      #    Spy (bonus token)
    │       ├── chancellor.ts #  Chancellor (draw/return)
    │       └── tillbakakaka.ts # Cookie Guard (revenge)
    │
    ├── stores/             # 📦 Svelte Stores (State Management)
    │   ├── game.ts         #    Game state store & actions
    │   ├── network.ts      #    Network connection state
    │   └── chat.ts         #    In-game chat state
    │
    ├── network/            # 🌐 P2P Networking
    │   ├── peer.ts         #    PeerJS connection management
    │   ├── messages.ts     #    Message type definitions
    │   └── sync.ts         #    Game state synchronization
    │
    ├── components/         # 🖼️  Svelte UI Components
    │   ├── LobbyScreen.svelte
    │   ├── HostLobby.svelte
    │   ├── JoinGame.svelte
    │   ├── GameScreen.svelte
    │   ├── Card.svelte
    │   ├── PlayerArea.svelte
    │   └── ... (modals, selectors, etc.)
    │
    └── data/               # 📋 Static Game Data
        └── cards.json      #    Card definitions (source of truth)
```

---

## Layer Responsibilities

### 1. Game Engine (`src/lib/engine/`)

The **pure logic layer** - no UI dependencies, no network awareness.

```
┌─────────────────────────────────────────────────────────────────┐
│                        GameEngine                               │
├─────────────────────────────────────────────────────────────────┤
│  • Manages GameState (players, deck, phase, etc.)               │
│  • Validates and applies player actions                         │
│  • Enforces game rules for multiple rulesets                    │
│  • Returns new state (immutable updates)                        │
│  • Uses seeded RNG for deterministic shuffling                  │
└─────────────────────────────────────────────────────────────────┘
          │
          │  Reads card data from
          ▼
┌─────────────────────────────────────────────────────────────────┐
│  cards.json - Card definitions (value, count, effects)          │
└─────────────────────────────────────────────────────────────────┘
```

**Key Principle:** The engine must be testable in isolation and produce
identical results given the same inputs + RNG seed.

---

### 2. Svelte Stores (`src/lib/stores/`)

The **bridge layer** connecting UI ↔ Engine ↔ Network.

```
┌───────────────┐     ┌──────────────────┐     ┌───────────────┐
│  UI Component │────►│   gameState      │◄────│   Network     │
│               │     │   (Svelte Store) │     │   Messages    │
│  subscribes   │     └──────────────────┘     │   update      │
│  to store     │              │               │   store       │
└───────────────┘              │               └───────────────┘
                               ▼
                    ┌──────────────────┐
                    │   GameEngine     │
                    │   (wrapped)      │
                    └──────────────────┘
```

**Stores:**

- `gameState` - The reactive game state (wraps `GameEngine`)
- `networkState` - Connection status, peer info
- `chatState` - In-game chat messages

---

### 3. Network Layer (`src/lib/network/`)

Handles **peer-to-peer communication** via WebRTC (PeerJS).

```
        HOST                                    GUEST
┌───────────────────┐                   ┌───────────────────┐
│   PeerManager     │◄────WebRTC───────►│   PeerManager     │
│   (creates room)  │    DataChannel    │   (joins room)    │
└─────────┬─────────┘                   └─────────┬─────────┘
          │                                       │
          ▼                                       ▼
┌───────────────────┐                   ┌───────────────────┐
│    GameSync       │                   │    GameSync       │
│  (authoritative)  │                   │    (mirrors)      │
└───────────────────┘                   └───────────────────┘
```

**Message Flow:**

1. Guest joins → sends `PLAYER_JOINED`
2. Host acknowledges → sends `PLAYER_INFO`
3. Host starts round → broadcasts `ROUND_START` with RNG seed
4. Players act → `PLAYER_ACTION` messages
5. Host validates & broadcasts `GAME_STATE_SYNC`

---

### 4. UI Components (`src/lib/components/`)

**Stateless Svelte components** that render based on store data.

```
┌─────────────────────────────────────────────────────────────────┐
│  App.svelte (Router)                                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│   │ LobbyScreen │  │ HostLobby   │  │ GameScreen              │ │
│   │             │  │             │  │  ├─ PlayerArea          │ │
│   │ "Host/Join" │  │ "Waiting    │  │  ├─ Card                │ │
│   │  buttons    │  │  for guests"│  │  ├─ TargetSelector      │ │
│   └─────────────┘  └─────────────┘  │  ├─ GuessSelector       │ │
│                                     │  └─ GameLog             │ │
│   ┌─────────────┐                   └─────────────────────────┘ │
│   │ JoinGame    │                                               │
│   │ "Enter code"│                                               │
│   └─────────────┘                                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Flow: Playing a Card

```
     Player clicks card in UI
              │
              ▼
     ┌────────────────────┐
     │ Component emits    │
     │ action via store   │
     └────────┬───────────┘
              │
              ▼
     ┌────────────────────┐
     │ Store calls        │
     │ engine.applyMove() │
     └────────┬───────────┘
              │
              ▼
     ┌────────────────────┐
     │ Engine validates   │
     │ & returns new state│
     └────────┬───────────┘
              │
              ▼
     ┌────────────────────┐
     │ Store updates      │
     │ gameState (react.) │
     └────────┬───────────┘
              │
     ┌────────┴────────┐
     │                 │
     ▼                 ▼
┌──────────┐    ┌───────────────┐
│ UI       │    │ Network sends │
│ re-renders│    │ PLAYER_ACTION │
└──────────┘    │ to peers      │
                └───────────────┘
```

---

## Key Design Decisions

| Decision               | Rationale                                                          |
| ---------------------- | ------------------------------------------------------------------ |
| **Seeded RNG**         | All peers use the same seed → deterministic deck order → no desync |
| **Host authority**     | Host validates all actions and broadcasts authoritative state      |
| **Immutable state**    | Engine returns new state objects → clean Svelte reactivity         |
| **UI-agnostic engine** | Engine is testable, portable, and ruleset-swappable                |
| **WebRTC P2P**         | No dedicated server needed; low latency for real-time play         |

---

## Rulesets

The game supports multiple rulesets via the `ruleset` property in `GameState`:

- **`classic`** - Original Love Letter rules
- **`2019`** - Updated rules with additional cards (Spy, Chancellor)
- **`house`** - Custom/house rules (future)

Card behavior and win conditions adapt based on the active ruleset.

---

## Technology Stack

| Layer        | Technology       |
| ------------ | ---------------- |
| UI Framework | Svelte 5         |
| Language     | TypeScript       |
| Build Tool   | Vite             |
| Networking   | PeerJS (WebRTC)  |
| Testing      | Vitest           |
| Deployment   | Cloudflare Pages |

---

## File Naming Conventions

- **Components:** `PascalCase.svelte` (e.g., `GameScreen.svelte`)
- **Modules:** `kebab-case.ts` or `camelCase.ts` (e.g., `game.ts`, `peer.ts`)
- **Tests:** Co-located as `*.test.ts` (e.g., `game.test.ts`)

---

## Further Reading

- [.github/copilot-instructions.md](/.github/copilot-instructions.md) - Coding conventions & guidelines
- [src/lib/types.ts](/src/lib/types.ts) - All TypeScript interfaces
- [src/lib/data/cards.json](/src/lib/data/cards.json) - Card definitions
