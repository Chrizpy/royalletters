# Royal Letters

A mobile-web, P2P version of the card game *Love Letter*.

## Overview

Royal Letters is a full-stack mobile web game featuring:
- **Core Game Engine**: A pure TypeScript engine with deterministic RNG for P2P synchronization
- **P2P Networking**: WebRTC-based peer-to-peer communication using PeerJS
- **Mobile-First UI**: A Svelte-based responsive interface optimized for mobile devices with full-screen native app experience

## Prerequisites

- **Node.js** (v18 or higher recommended)
- **npm** (comes with Node.js)

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Run Tests

```bash
npm test
```

The test suite includes 73 tests covering:
- RNG determinism
- Deck creation and shuffling
- Game initialization and round management
- All 8 card effects (Guard, Priest, Baron, Handmaid, Prince, King, Countess, Princess)
- Win conditions and state serialization
- P2P message encoding/decoding
- Game state synchronization

### 3. Development Server (UI Preview)

```bash
npm run dev
```

This starts the Vite development server. The app features a mobile-first UI with:
- Host/Join game lobby
- QR code sharing for easy game joining
- Real-time P2P game state synchronization
- Full game screen with card interactions

### 4. Build for Production

```bash
npm run build
```

### 5. TypeScript Type Checking

```bash
npm run check
```

## Project Structure

```
src/
├── App.svelte              # Main app component with routing
├── app.css                 # Global styles (mobile-first)
├── main.ts                 # App entry point
└── lib/
    ├── components/         # Svelte UI components
    │   ├── LobbyScreen.svelte    # Host/Join selection
    │   ├── HostLobby.svelte      # Game hosting with QR code
    │   ├── JoinGame.svelte       # Join via QR/code
    │   ├── GameScreen.svelte     # Main game interface
    │   ├── Card.svelte           # Card display component
    │   ├── PlayerArea.svelte     # Player hand and info
    │   └── ...                   # Additional UI components
    ├── data/
    │   └── cards.json            # Card definitions (8 card types)
    ├── engine/
    │   ├── rng.ts                # Deterministic random number generator
    │   ├── deck.ts               # Deck creation and shuffling
    │   ├── game.ts               # Core game engine
    │   └── game.test.ts          # Game engine tests
    ├── network/
    │   ├── peer.ts               # PeerJS WebRTC wrapper
    │   ├── sync.ts               # Game state synchronization
    │   ├── messages.ts           # P2P message protocol
    │   └── *.test.ts             # Network layer tests
    ├── stores/
    │   ├── chat.ts               # Chat messages store
    │   ├── game.ts               # Game state store
    │   └── network.ts            # Network state store
    └── types.ts                  # TypeScript type definitions
```

## Using the Game Engine

```typescript
import { GameEngine } from './src/lib/engine/game';

// Initialize game
const game = new GameEngine();
game.init({
  players: [
    { id: 'p1', name: 'Alice' },
    { id: 'p2', name: 'Bob' }
  ]
});

// Start a round
game.startRound();  // Generates seed, shuffles deck, deals cards

// Player draws
game.drawPhase();

// Player plays a card
const result = game.applyMove({
  type: 'PLAY_CARD',
  playerId: 'p1',
  cardId: 'guard',
  targetPlayerId: 'p2',
  targetCardGuess: 'baron'
});

// Get current state (for P2P sync)
const state = game.getState();

// Restore state (from P2P sync)
game.setState(state);
```

## Key Features

- **Deterministic**: Same seed always produces same game sequence
- **Serializable**: Full state can be converted to/from JSON for P2P sync
- **Type-safe**: Complete TypeScript type definitions
- **Well-tested**: 73 passing tests with full coverage of game logic and networking
- **Mobile-First**: Optimized for mobile browsers with native app-like experience
- **P2P Networking**: WebRTC-based communication for low-latency gameplay

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Svelte](https://marketplace.visualstudio.com/items?itemName=svelte.svelte-vscode)
