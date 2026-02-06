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

The test suite covers:
- RNG determinism and deck shuffling
- Game initialization and round management
- All card effects (classic + 2019 ruleset cards)
- Win conditions and state serialization
- P2P message encoding/decoding
- Game state synchronization
- AI player decision-making

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

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full directory structure, layer responsibilities, and data flow diagrams.

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
- **Well-tested**: Comprehensive test suite covering game logic and networking
- **Mobile-First**: Optimized for mobile browsers with native app-like experience
- **P2P Networking**: WebRTC-based communication for low-latency gameplay

## Documentation

- [Architecture Overview](docs/ARCHITECTURE.md) - System design, directory structure, and data flow
- [Coding Guidelines](.github/copilot-instructions.md) - Conventions for contributing

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Svelte](https://marketplace.visualstudio.com/items?itemName=svelte.svelte-vscode)
