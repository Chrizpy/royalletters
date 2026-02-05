# Royal Letters Project - Copilot Instructions

This document provides guidance for GitHub Copilot to ensure its suggestions align with the project's architecture, conventions, and technology stack.

## 1. Project Overview

This project is a web-based, peer-to-peer implementation of the card game "Royal Letters" (a variant of "Love Letter"). The frontend is built with Svelte and TypeScript, and networking is handled via WebRTC.

## 2. Technology Stack

- **Framework:** Svelte
- **Language:** TypeScript
- **Build Tool:** Vite
- **Deployment:** Cloudflare Pages/Workers (inferred from `wrangler.jsonc`)
- **State Management:** Svelte Stores (`src/lib/stores`)
- **Networking:** Peer-to-peer using PeerJS (`src/lib/network/peer.ts`)
- **Testing:** Vitest

## 3. Architecture and Directory Structure

Please adhere to the following architectural separation:

- **`src/lib/engine` (Core Game Logic):**
  - Contains all rules, game state management (`game.ts`), and AI logic (`ai.ts`).
  - **CRITICAL:** Code in this directory must remain UI-agnostic. It should be pure TypeScript without any Svelte-related imports.
  - Game state modifications should be handled through functions that return a _new_ state object, promoting immutability.

- **`src/lib/stores` (State Management):**
  - Svelte stores that wrap the game engine and network state.
  - This is the primary bridge between the UI and the application's core logic.
  - UI components should interact with the stores, not the engine directly.

- **`src/lib/components` (Svelte Components):**
  - Reusable UI components.
  - These components should be stateless whenever possible, receiving data and callbacks as props.
  - They subscribe to stores to get the data they need to render.

- **`src/lib/network` (Networking):**
  - Manages peer-to-peer communication via PeerJS.
  - Defines the message structure for game actions (`messages.ts`).
  - Handles state synchronization between peers (`sync.ts`).

- **`src/lib/data` (Static Data):**
  - Contains JSON configuration files for game data (e.g., card definitions).
  - Card definitions in `cards.json` should be the single source of truth for card properties.

- **`src/lib/types.ts` (Shared Types):**
  - Contains all shared TypeScript interfaces and types used across the application.
  - Prefer using types from this file over defining them locally.

## 4. Coding Conventions

- **Immutability:** When updating the game state in the `engine`, always create a new state object instead of mutating the existing one.
- **Type Safety:** Use TypeScript consistently. Leverage the types defined in `src/lib/types.ts`.
- **Component Design:** Keep Svelte components small and focused on a single responsibility.
- **Game Actions:** All player actions must be represented by messages defined in `src/lib/network/messages.ts` and processed through the game engine.
- **Deterministic RNG:** Use seeded random number generation (`rng.ts`) for any game logic randomness to ensure state consistency across peers.
- **Rulesets:** The game supports multiple rulesets (`classic` | `2019`). When adding game logic, ensure it respects the `ruleset` property in `GameState`.

## 5. Testing

- **Test Framework:** Vitest
- **Location:** Test files are co-located with their source files (e.g., `game.test.ts` alongside `game.ts`).
- **Coverage:** Critical game engine logic should have corresponding tests.

By following these guidelines, you will help maintain a clean, scalable, and maintainable codebase.
