# Royal Letters

A mobile-web, P2P version of the card game *Love Letter*.

## Phase 1: Core Engine (Current)

This phase implements the headless game logic layer - a pure TypeScript engine with no UI, designed for P2P synchronization via deterministic RNG and serializable state.

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

The test suite includes 48 tests covering:
- RNG determinism
- Deck creation and shuffling
- Game initialization and round management
- All 8 card effects (Guard, Priest, Baron, Handmaid, Prince, King, Countess, Princess)
- Win conditions and state serialization

### 3. Development Server (UI Preview)

```bash
npm run dev
```

This starts the Vite development server. Note: Phase 1 only includes the core game engine - the UI is placeholder content from the Svelte template.

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
src/lib/
├── data/
│   └── cards.json          # Card definitions (8 card types)
├── engine/
│   ├── rng.ts              # Deterministic random number generator
│   ├── deck.ts             # Deck creation and shuffling
│   ├── game.ts             # Core game engine (583 LOC)
│   └── game.test.ts        # Comprehensive test suite (48 tests)
└── types.ts                # TypeScript type definitions
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
- **Well-tested**: 48 passing tests with full coverage of game logic

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Svelte](https://marketplace.visualstudio.com/items?itemName=svelte.svelte-vscode)
