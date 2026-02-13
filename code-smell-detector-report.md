# Code Smell Detection Report

## Executive Summary

**Project:** Royal Letters — a peer-to-peer card game (Love Letter variant)  
**Stack:** Svelte 5 + TypeScript + Vite + PeerJS  
**Files Analyzed:** 45+ source files (`.ts`, `.svelte`)  
**Total Source Lines:** ~13,900  
**Analysis Date:** 12 February 2026

### Summary of Findings

| Severity  | Count  |
| --------- | ------ |
| 🔴 High   | 7      |
| 🟡 Medium | 12     |
| 🟢 Low    | 9      |
| **Total** | **28** |

---

## High Severity Issues (Architectural Impact)

### H1. Svelte 4 Syntax in a Svelte 5 Project — **Inconsistent Style / Framework Misuse**

**Files:** All 17 `.svelte` components  
**Category:** Inconsistent Style, Technical Debt  
**Principles Violated:** Framework Best Practices

The project uses `svelte@^5.43.8` but **all components** use Svelte 4 patterns exclusively:

- **`export let` for props** — Every component uses `export let` instead of Svelte 5's `$props()` rune. Found in all 17 components (40+ instances).
- **`$:` reactive declarations** — `GameScreen.svelte` alone has 15+ `$:` reactive statements. Should use `$derived()` and `$effect()` runes.
- **`on:click` event handlers** — All event handlers use the old `on:click` directive syntax instead of Svelte 5's `onclick` attribute syntax. 30+ instances found.
- **`on:click|stopPropagation`** — Event modifiers like `|stopPropagation` are not supported in Svelte 5 rune mode.
- **`writable()` stores** — All stores use `svelte/store` `writable()` instead of Svelte 5's `$state()` rune.
- **`$storeValue` auto-subscriptions** — Used throughout `GameScreen.svelte`, `HostLobby.svelte`, `JoinGame.svelte`, and `App.svelte`.

**Impact:** The entire project is written in Svelte 4 "legacy mode." While Svelte 5 supports this for backward compatibility, it misses all the performance and DX benefits of runes. More critically, it creates inconsistency with what `package.json` declares and will eventually need a full migration.

**Recommendation:** Migrate components to rune mode incrementally. Start with leaf components (`Card.svelte`, `CardReveal.svelte`) and work up to container components.

---

### H2. Duplicated `getValidTargets` Function — **Duplicated Code**

**Files:**

- `src/lib/engine/validation.ts` (lines 20–30)
- `src/lib/engine/ai.ts` (lines 24–34)
- `src/lib/components/GameScreen.svelte` (lines 296–305)

**Category:** Dispensable — Duplicated Code  
**Principles Violated:** DRY, Single Source of Truth  
**Original Source:** Fowler (1999)

The exact same player-filtering logic (`getValidTargets`) is implemented **three separate times** across three different layers:

1. **Engine validation** (`validation.ts`): Filters by eliminated/protected status
2. **AI module** (`ai.ts`): Identical filter logic, not imported from validation
3. **UI component** (`GameScreen.svelte`): Re-implements the same filter in the component

All three check the same conditions: `status === 'ELIMINATED'`, `status === 'PROTECTED'`, and `canTargetSelf`.

**Impact:** Any rule change to targeting (e.g., adding a new status) must be updated in three places. This is a Shotgun Surgery risk.

**Recommendation:** Export and reuse the single implementation from `validation.ts`. The AI module and the UI component should import from it. This aligns with the project's own `copilot-instructions.md` which states "UI components should interact with the stores, not the engine directly."

---

### H3. Duplicated `tokensToWin` / `getTokensToWin` Logic — **Duplicated Code**

**Files:**

- `src/lib/types.ts` (lines 106–111) — `TOKENS_TO_WIN` constant
- `src/lib/engine/constants.ts` (lines 21–33) — `TOKENS_TO_WIN_MAP` + `getTokensToWin()`
- `src/lib/components/GameScreen.svelte` (lines 189–192) — local `getTokensToWin()` function
- `src/lib/components/HostLobby.svelte` (lines 29–34) — `DEFAULT_TOKENS_MAP`

**Category:** Dispensable — Duplicated Code  
**Principles Violated:** DRY, Single Source of Truth

The tokens-to-win mapping `{2:6, 3:5, 4:4, 5:3, 6:3}` is defined **four separate times** across four files. `types.ts` has `TOKENS_TO_WIN`, `constants.ts` has `TOKENS_TO_WIN_MAP`, `GameScreen.svelte` has a local `getTokensToWin`, and `HostLobby.svelte` has `DEFAULT_TOKENS_MAP`.

**Impact:** If game rules change (e.g., supporting 7 players), all four locations must be updated.

**Recommendation:** Use the single `getTokensToWin()` from `engine/constants.ts` everywhere. Remove the duplicates from `types.ts`, `GameScreen.svelte`, and `HostLobby.svelte`.

---

### H4. `HostLobby.svelte` — **Large Class / God Component** (1,172 lines)

**File:** `src/lib/components/HostLobby.svelte`  
**Category:** Bloater — Large Class  
**Principles Violated:** SRP, High Cohesion (GRASP)  
**Original Source:** Fowler (1999)

At 1,172 lines, `HostLobby.svelte` is the largest file and handles far too many concerns:

1. **Peer networking** — Creates `PeerManager`, handles connections/disconnections
2. **Message routing** — Giant `handleMessage()` switch with 5+ message types
3. **Game lifecycle** — `handleStartGame()`, `handlePlayAgain()`, `handleStartRound()`
4. **AI orchestration** — `scheduleAIMove()`, `processAITurn()`
5. **Player management** — Adding/removing players, AI slider logic
6. **Chat system** — `handleSendChat()`
7. **QR code generation** — `onMount` QR generation
8. **UI rendering** — The entire lobby UI + settings

**Impact:** Extremely difficult to test, understand, or modify any single feature without risk of breaking others.

**Recommendation:** Extract into multiple composable pieces:

- A `hostGameManager.ts` (or store) for networking + game lifecycle + AI orchestration
- A `LobbySettings.svelte` sub-component for ruleset/AI/tokens UI
- A `PlayerList.svelte` sub-component for player display

---

### H5. `GameScreen.svelte` — **Large Class / God Component** (854 lines)

**File:** `src/lib/components/GameScreen.svelte`  
**Category:** Bloater — Large Class  
**Principles Violated:** SRP, High Cohesion (GRASP)

At 854 lines, `GameScreen.svelte` mixes:

1. **Complex game state derivation** — 15+ reactive declarations
2. **Animation tracking logic** — Log parsing with regex to detect card effects (lines 131–175)
3. **Target validation** — Re-implemented `getValidTargets()` (see H2)
4. **Player reordering algorithm** — 40-line `reorderPlayersClockwise()` function
5. **Card selection state machine** — `selectCard()` → `selectTarget()` → `selectGuess()` flow
6. **Name formatting** — Duplicated `formatWinnerNames()` (see H6)
7. **200+ lines of CSS**

**Impact:** Hard to reason about component state; high cognitive load for maintenance.

**Recommendation:** Extract `reorderPlayersClockwise()` into a utility. Move card selection state machine to a store or composable. Extract animation tracking to a separate module.

---

### H6. Duplicated Name Formatting — **Duplicated Code**

**Files:**

- `src/lib/engine/player.ts` (lines 82–90) — `formatPlayerNames()`
- `src/lib/components/GameScreen.svelte` (lines 45–52) — `formatWinnerNames()`

**Category:** Dispensable — Duplicated Code  
**Principles Violated:** DRY

Both functions implement identical Oxford comma formatting logic:

- 0 names → `''`
- 1 name → `'Alice'`
- 2 names → `'Alice and Bob'`
- 3+ names → `'Alice, Bob, and Carol'`

The only difference is `formatWinnerNames` accepts `(string | undefined)[]` and filters out undefined values.

**Recommendation:** Use `formatPlayerNames` from `player.ts` with a simple `.filter(Boolean)` wrapper.

---

### H7. GameEngine Mutates State Directly — **Mutable Data / Side Effects**

**File:** `src/lib/engine/game.ts`, all effect handlers  
**Category:** Data Dealer — Mutable Data  
**Principles Violated:** Immutability (per project's own `copilot-instructions.md`), Pure Function principle

The project's `copilot-instructions.md` explicitly states:

> _"Game state modifications should be handled through functions that return a new state object, promoting immutability."_

However, `GameEngine` and all effect handlers **mutate state directly**:

- `game.ts`: `this.state.deck.shift()`, `player.hand.push(card)`, `activePlayer.hand.splice(cardIndex, 1)`, `this.state.logs.push(entry)`
- `effects/utils.ts`: `player.hand.shift()!`, `player.discardPile.push(card)`, `player.status = 'ELIMINATED'`
- `effects/prince.ts`: `targetPlayer.hand.shift()`, `state.deck.shift()`, `targetPlayer.hand.push(newCard)`
- `effects/king.ts`: `activePlayer.hand = targetPlayer.hand` (direct swap)
- `effects/chancellor.ts`: `state.deck.shift()`, `activePlayer.hand.push(card)`, `state.deck.push(cardId)`

The `getState()` and `setState()` methods use `JSON.parse(JSON.stringify(...))` for deep cloning, which is a workaround for the underlying mutation problem.

**Impact:** Violates the project's own stated architecture. Makes debugging P2P sync issues harder. Prevents structural sharing optimizations.

**Recommendation:** Refactor engine functions to produce new state objects rather than mutating. This is a significant refactoring effort but aligns with the documented architecture.

---

## Medium Severity Issues (Design Problems)

### M1. `broadcastGameState()` + `scheduleAIMove()` Pattern Duplication — **Shotgun Surgery**

**File:** `src/lib/components/HostLobby.svelte`  
**Category:** Change Preventer — Shotgun Surgery  
**Principles Violated:** DRY

The pair `broadcastGameState(); scheduleAIMove();` is called **9 times** throughout `HostLobby.svelte`:

- `handleStartGame()`, `handlePlayCard()`, `handleChancellorReturn()`, `handleRevengeGuess()`, `handleStartRound()`, `handlePlayAgain()`, `handleMessage(PLAYER_ACTION)`, `handleMessage(RECONNECT)`, `processAITurn()`

**Recommendation:** Extract a `commitGameAction()` helper that wraps both calls.

---

### M2. `applyMove()` Switch Statement — **Conditional Complexity**

**File:** `src/lib/engine/game.ts` (lines 236–282)  
**Category:** Obfuscator — Conditional Complexity  
**Principles Violated:** OCP (Open/Closed Principle)

The `applyMove()` method contains an 11-case switch statement on `cardDef.effect.type`. Adding a new card effect requires modifying this method.

**Impact:** Violates Open/Closed Principle. The unused `EffectHandler` interface in `effects/types.ts` suggests an intent to use polymorphism that was never implemented.

**Recommendation:** Implement the Strategy pattern using the existing `EffectHandler` interface and an effect registry map, e.g.:

```typescript
const effectHandlers: Record<EffectType, (ctx: EffectContext) => EffectResult> = { ... };
```

---

### M3. UI Components Directly Import Engine Modules — **Architectural Violation / Feature Envy**

**Files:**

- `src/lib/components/GameScreen.svelte` — imports `getCardDefinition` from `engine/deck`
- `src/lib/components/GuessSelector.svelte` — imports from `engine/deck`
- `src/lib/components/ChancellorModal.svelte` — imports from `engine/deck`
- `src/lib/components/Card.svelte` — imports from `engine/deck`
- `src/lib/components/DeckInfoModal.svelte` — imports from `engine/deck`
- `src/lib/components/PlayerArea.svelte` — imports from `engine/deck`

**Category:** Coupler — Feature Envy  
**Principles Violated:** Layered Architecture, GRASP Indirection

The project's `copilot-instructions.md` states:

> _"UI components should interact with the stores, not the engine directly."_

Six components bypass the store layer and directly import `getCardDefinition` from the engine. While this is a read-only lookup and unlikely to cause bugs, it violates the stated architecture.

**Recommendation:** Expose card definition lookups through a store or utility re-export in the stores layer.

---

### M4. Non-null Assertions (`!`) Overuse — **Afraid to Fail**

**Files:** Throughout engine and effects  
**Category:** Other — Afraid to Fail

Frequent use of non-null assertion (`!`) without safety checks:

- `game.ts:212` — `action.cardId!`
- `game.ts:213` — `activePlayer.hand.splice(cardIndex, 1)` (cardIndex could be -1)
- `guard.ts:12` — `state.players.find(p => p.id === action.targetPlayerId)!`
- `baron.ts:12` — `state.players.find(p => p.id === action.targetPlayerId)!`
- `prince.ts:12` — `state.players.find(p => p.id === action.targetPlayerId)!`
- `king.ts:12` — `state.players.find(p => p.id === action.targetPlayerId)!`
- `tillbakakaka.ts:14` — `state.players.find(...)!`
- `chancellor.ts:97` — `action.cardsToReturn!`

**Impact:** Runtime crashes if any assertion fails. In a P2P game, corrupted messages could trigger these.

**Recommendation:** Add proper null checks and return error results rather than crashing.

---

### M5. `payload` Typed as `unknown` in `NetworkMessage` — **Primitive Obsession / Weak Typing**

**File:** `src/lib/network/messages.ts` (line 14)  
**Category:** OO Abuser — Primitive Obsession  
**Principles Violated:** Type Safety

```typescript
export interface NetworkMessage {
  payload: unknown;
  // ...
}
```

The `payload` is typed as `unknown`, requiring unsafe type assertions (`as PlayerJoinedPayload`, `as GameStateSyncPayload`, etc.) at every message handler site. This appears ~15 times across `HostLobby.svelte`, `JoinGame.svelte`, and `sync.ts`.

**Recommendation:** Use a discriminated union:

```typescript
type NetworkMessage =
  | { type: 'PLAYER_JOINED'; payload: PlayerJoinedPayload; ... }
  | { type: 'GAME_STATE_SYNC'; payload: GameStateSyncPayload; ... }
  // etc.
```

---

### M6. `GameSync` Class is Partially Redundant with `HostLobby` — **Parallel Implementation**

**Files:** `src/lib/network/sync.ts` vs `src/lib/components/HostLobby.svelte`  
**Category:** Dispensable — Dead Code / Parallel Implementation  
**Principles Violated:** DRY

`GameSync` in `sync.ts` (364 lines) implements a full message handling and game sync system, but `HostLobby.svelte` implements its **own** message handling directly via `peerManager.onMessage()`. Both handle `PLAYER_JOINED`, `PLAYER_ACTION`, `RECONNECT`, `REQUEST_STATE_SYNC`, and `GAME_STATE_SYNC`.

`GameSync` is imported nowhere in the component tree — it appears to be dead code or an incomplete refactoring.

**Impact:** 364 lines of code that provides no value if unused. Confusing for developers.

**Recommendation:** Either adopt `GameSync` as the networking layer (removing message handling from `HostLobby`) or remove `GameSync` if the current approach is intentional.

---

### M7. `JSON.parse(JSON.stringify(...))` for Deep Cloning — **Clever Code**

**File:** `src/lib/engine/game.ts` (lines 557, 564)  
**Category:** Obfuscator — Clever Code

```typescript
getState(): GameState {
  return JSON.parse(JSON.stringify(this.state));
}
setState(state: GameState): void {
  this.state = JSON.parse(JSON.stringify(state));
}
```

**Impact:** Breaks if state ever contains `undefined` values, `Date` objects, `Map`/`Set`, or circular references. Slower than `structuredClone()`.

**Recommendation:** Use `structuredClone(this.state)` which is available in all modern browsers and Node.js 17+.

---

### M8. Effect Animation Detection via Log Message Parsing — **Obscured Intent / Fragile Code**

**File:** `src/lib/components/GameScreen.svelte` (lines 131–175)  
**Category:** Obfuscator — Obscured Intent  
**Principles Violated:** Information Expert (GRASP)

The component parses log message strings using regex and string matching to determine which player was targeted by a card effect:

```javascript
if (message.includes(`${playerName} was eliminated`) ||
    message.includes(`saw ${playerName}'s hand`) ||
    message.includes(`and ${playerName} traded`) ||
    message.match(new RegExp(`(on|to|with)\\s+${playerName}`, 'i'))) {
```

**Impact:** Extremely fragile. Any change to log message wording breaks the animation system. This is coupling to string representation rather than structured data.

**Recommendation:** Add a structured `lastAction` field to `GameState` or `ActionResult` that explicitly records `{actorId, targetId, cardId}` instead of parsing it from text.

---

### M9. `_state` Unused Parameter — **Dead Code**

**File:** `src/lib/engine/effects/utils.ts` (line 15)  
**Category:** Dispensable — Dead Code

```typescript
export function eliminatePlayer(
  player: PlayerState,
  reason: string,
  _state: GameState  // <-- prefixed but still required at every call site
): void {
```

The `_state` parameter is never used in the function body but is required at every call site (6+ invocations), adding noise.

**Recommendation:** Remove the parameter or add a TODO explaining why it's preserved for future use.

---

### M10. `EffectHandler` Interface Never Implemented — **Speculative Generality**

**File:** `src/lib/engine/effects/types.ts` (lines 23–36)  
**Category:** Dispensable — Speculative Generality  
**Principles Violated:** YAGNI

The `EffectHandler` interface with `effectType` and `apply()` method is defined but never implemented by any effect handler. All effects are plain functions, not classes implementing this interface. Similarly, `EffectUtils` (lines 55–63) is defined but never used.

**Impact:** Misleading — suggests a design pattern that isn't followed.

**Recommendation:** Either implement the Strategy pattern using this interface (see M2) or remove the unused interface.

---

### M11. `getDeckComposition()` Creates a Full Deck on Every AI Call — **Inefficiency**

**File:** `src/lib/engine/ai.ts` (lines 12–19)  
**Category:** Other — Performance Smell

```typescript
function getDeckComposition(ruleset: Ruleset): Record<string, number> {
  const deck = createDeck(ruleset);
  // ...count cards...
}
```

Every time an AI needs to make a Guard guess, `getDeckComposition()` creates an entire deck and counts all cards. This is called inside `chooseGuardGuess()` which runs on every AI Guard play.

**Recommendation:** Cache the deck composition per ruleset (it never changes) or compute it once and store as a constant.

---

### M12. 50+ `console.log/warn/error` Statements — **Debug Leftovers**

**Files:** Throughout codebase  
**Category:** Dispensable — Dead Code (debug artifacts)

50 console statements found across the codebase, predominantly in networking code (`peer.ts`, `sync.ts`, `HostLobby.svelte`, `JoinGame.svelte`).

**Recommendation:** Introduce a logger utility with configurable levels, or remove debug statements for production builds.

---

## Low Severity Issues (Readability / Maintenance)

### L1. `addLog` Function Exists in Two Forms — **Inconsistent Interface**

**Files:**

- `src/lib/engine/effects/utils.ts` — `addLog(message, state, actorId?, cardId?)`
- `src/lib/engine/game.ts` — `this.addLog(message, actorId?, cardId?)`

**Category:** Lexical Abuser — Inconsistent Names

The effect utils version takes `state` as the second parameter; the `GameEngine` method doesn't (it uses `this.state`). Both are named `addLog` but have different signatures.

---

### L2. Magic String Card IDs — **Magic Number (String variant)**

**Files:** `ai.ts`, `validation.ts`, `game.ts`, `GameScreen.svelte`  
**Category:** Lexical Abuser — Magic Number

Card IDs like `'princess'`, `'countess'`, `'king'`, `'prince'`, `'guard'`, `'tillbakakaka'`, `'spy'`, `'chancellor'`, `'handmaid'`, `'priest'`, `'baron'` are hardcoded as string literals throughout the codebase (~40+ occurrences).

**Recommendation:** Define card ID constants in a shared location:

```typescript
export const CARD_IDS = { PRINCESS: 'princess', COUNTESS: 'countess', ... } as const;
```

---

### L3. Overly Broad `handleMessage` Functions — **Long Method**

**File:** `src/lib/components/HostLobby.svelte` (lines 110–244)  
**Category:** Bloater — Long Method

The `handleMessage()` function in `HostLobby.svelte` is ~130 lines with deeply nested conditionals for each message type.

**Recommendation:** Extract each message type handler into a separate function.

---

### L4. Callback Props Instead of Events — **Svelte Anti-Pattern**

**Files:** All components using `export let onSelect`, `export let onPlayCard`, etc.  
**Category:** Other — Framework Convention Violation

Components pass callback functions as props (`onPlayCard`, `onSelect`, `onCancel`, etc.) rather than using Svelte's event dispatching or Svelte 5's callback props pattern. While functional, Svelte 5 recommends the `$props()` + callback pattern or the `createEventDispatcher` pattern.

---

### L5. `pendingAction` Fields All Nullable — **Primitive Obsession**

**File:** `src/lib/types.ts` (lines 55–59)

```typescript
export interface PendingAction {
  cardId: string | null;
  targetPlayerId: string | null;
  targetCardGuess: string | null;
}
```

All fields are nullable independently, but they logically form a progression: `cardId` must be set before `targetPlayerId`, which must be set before `targetCardGuess`. This should be a discriminated union representing distinct states.

---

### L6. `let` Variables in `GameScreen` That Could Be `const` or Derived — **Mutable Data**

**File:** `src/lib/components/GameScreen.svelte`

Variables like `selectedCard`, `selectingTarget`, `selectingGuess`, `pendingCardId`, `pendingTargetId` form a mini state machine but are tracked as independent `let` variables. In Svelte 5, these would be better as `$state()` with derived values.

---

### L7. Color Constants Defined Only in Engine — **Misplaced Responsibility**

**File:** `src/lib/engine/constants.ts`

`PLAYER_COLORS` (a UI concern) is defined in the engine layer. The engine is supposed to be UI-agnostic per the project's architecture docs.

**Recommendation:** Move to a `src/lib/constants.ts` or `src/lib/data/colors.ts`.

---

### L8. `onScanError` Empty Function — **Dead Code**

**File:** `src/lib/components/JoinGame.svelte` (line 78)

```typescript
function onScanError(errorMessage: string) {
  // Ignore scan errors (they happen continuously while scanning)
}
```

The comment explains the intent, but the unused `errorMessage` parameter should be prefixed with `_`.

---

### L9. Session Expiry Uses Magic Number — **Magic Number**

**File:** `src/lib/stores/session.ts` (line 4)

```typescript
const SESSION_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes
```

While commented, this timeout value is hardcoded and not configurable. Minor, but worth noting.

---

## Impact Assessment

### Breakdown by Severity

| Severity  | Count | Examples                                                             |
| --------- | ----- | -------------------------------------------------------------------- |
| 🔴 High   | 7     | Svelte 4 syntax, duplicated functions, god components, mutable state |
| 🟡 Medium | 12    | Switch statement, dead code, weak typing, shotgun surgery            |
| 🟢 Low    | 9     | Magic strings, inconsistent APIs, misplaced constants                |

### Breakdown by Category

| Category                           | Count |
| ---------------------------------- | ----- |
| Duplicated Code                    | 4     |
| Large Class / Bloater              | 3     |
| Mutable Data / Side Effects        | 2     |
| Inconsistent Style                 | 2     |
| Dead Code / Speculative Generality | 3     |
| Conditional Complexity             | 1     |
| Feature Envy / Coupling            | 2     |
| Weak Typing                        | 2     |
| Obscured Intent                    | 2     |
| Magic Number/String                | 2     |
| Other                              | 5     |

### SOLID Principle Violations

| Principle                     | Violations | Details                                                                       |
| ----------------------------- | ---------- | ----------------------------------------------------------------------------- |
| **S** — Single Responsibility | 2          | HostLobby.svelte, GameScreen.svelte handle too many concerns                  |
| **O** — Open/Closed           | 1          | `applyMove()` switch requires modification for new effects                    |
| **L** — Liskov Substitution   | 0          | No inheritance hierarchy issues detected                                      |
| **I** — Interface Segregation | 0          | No fat interface issues detected                                              |
| **D** — Dependency Inversion  | 1          | Components depend directly on engine (concrete) rather than store abstraction |

### GRASP Principle Violations

| Principle                | Violations | Details                                                      |
| ------------------------ | ---------- | ------------------------------------------------------------ |
| **Information Expert**   | 1          | Log-parsing for animations instead of structured action data |
| **High Cohesion**        | 2          | HostLobby, GameScreen mix unrelated concerns                 |
| **Low Coupling**         | 1          | Components coupled directly to engine                        |
| **Indirection**          | 1          | Missing store abstraction for card lookups                   |
| **Protected Variations** | 1          | Animation system coupled to log message text                 |

---

## Recommendations and Refactoring Roadmap

### Phase 1 — Quick Wins (Low Risk, High Impact)

| #   | Task                                                               | Files                        | Effort  |
| --- | ------------------------------------------------------------------ | ---------------------------- | ------- |
| 1   | Consolidate `getValidTargets` to single source                     | `ai.ts`, `GameScreen.svelte` | Small   |
| 2   | Consolidate `tokensToWin` maps to single source                    | 4 files                      | Small   |
| 3   | Consolidate `formatPlayerNames` / `formatWinnerNames`              | `GameScreen.svelte`          | Small   |
| 4   | Replace `JSON.parse(JSON.stringify)` with `structuredClone`        | `game.ts`                    | Trivial |
| 5   | Remove unused `EffectHandler`/`EffectUtils` interfaces or add TODO | `effects/types.ts`           | Trivial |
| 6   | Remove `_state` parameter from `eliminatePlayer`                   | `effects/utils.ts` + callers | Small   |
| 7   | Extract `broadcastAndScheduleAI()` helper                          | `HostLobby.svelte`           | Small   |

### Phase 2 — Architectural Improvements (Medium Risk)

| #   | Task                                                            | Files                                      | Effort |
| --- | --------------------------------------------------------------- | ------------------------------------------ | ------ |
| 8   | Make `NetworkMessage` a discriminated union                     | `messages.ts` + handlers                   | Medium |
| 9   | Replace `applyMove()` switch with effect registry map           | `game.ts`, effects                         | Medium |
| 10  | Extract `handleMessage()` cases into separate handler functions | `HostLobby.svelte`                         | Medium |
| 11  | Add structured `lastAction` to state for animations             | `types.ts`, `game.ts`, `GameScreen.svelte` | Medium |
| 12  | Cache `getDeckComposition()` per ruleset                        | `ai.ts`                                    | Small  |
| 13  | Define card ID constants                                        | New file + callers                         | Medium |
| 14  | Evaluate/remove `GameSync` class if dead code                   | `sync.ts`                                  | Small  |

### Phase 3 — Major Refactoring (Higher Risk)

| #   | Task                                                          | Files                  | Effort     |
| --- | ------------------------------------------------------------- | ---------------------- | ---------- |
| 15  | Decompose `HostLobby.svelte` into sub-components + host store | `HostLobby.svelte`     | Large      |
| 16  | Decompose `GameScreen.svelte` into sub-components             | `GameScreen.svelte`    | Large      |
| 17  | Migrate components from Svelte 4 to Svelte 5 runes            | All `.svelte` files    | Large      |
| 18  | Refactor engine to immutable state updates                    | `game.ts`, all effects | Very Large |

---

## Appendix

### Files Analyzed

| File                                      | Lines | Issues                     |
| ----------------------------------------- | ----- | -------------------------- |
| `src/lib/components/HostLobby.svelte`     | 1,172 | H4, M1, M3, M6, L3         |
| `src/lib/components/GameScreen.svelte`    | 854   | H2, H3, H5, H6, M8, L2, L6 |
| `src/lib/components/JoinGame.svelte`      | 587   | H1, L8                     |
| `src/lib/engine/game.ts`                  | 586   | H7, M2, M4, M7             |
| `src/lib/components/GameFeed.svelte`      | 482   | H1                         |
| `src/lib/components/GuessSelector.svelte` | 384   | H1, M3                     |
| `src/lib/network/sync.ts`                 | 364   | M6                         |
| `src/lib/engine/ai.ts`                    | 320   | H2, M11, L2                |
| `src/lib/components/PlayerArea.svelte`    | 336   | H1, M3                     |
| `src/lib/engine/validation.ts`            | 189   | L2                         |
| `src/lib/stores/game.ts`                  | 155   | —                          |
| `src/lib/network/peer.ts`                 | 276   | M12                        |
| `src/lib/network/messages.ts`             | 95    | M5                         |
| `src/lib/engine/effects/types.ts`         | 64    | M10                        |
| `src/lib/engine/effects/utils.ts`         | 42    | M9                         |
| `src/lib/engine/effects/chancellor.ts`    | 126   | M4                         |
| `src/lib/engine/effects/guard.ts`         | 38    | M4                         |
| `src/lib/engine/effects/baron.ts`         | 60    | M4                         |
| `src/lib/engine/effects/prince.ts`        | 42    | M4                         |
| `src/lib/engine/effects/king.ts`          | 53    | —                          |
| `src/lib/engine/effects/tillbakakaka.ts`  | 123   | —                          |
| `src/lib/types.ts`                        | 112   | H3, L5                     |
| `src/lib/engine/constants.ts`             | 35    | L7                         |
| `src/lib/stores/session.ts`               | 82    | L9                         |
| `src/lib/stores/chat.ts`                  | 27    | —                          |
| `src/lib/stores/network.ts`               | 16    | —                          |
| `src/lib/engine/deck.ts`                  | 82    | —                          |
| `src/lib/engine/player.ts`                | 91    | —                          |
| `src/lib/engine/rng.ts`                   | 11    | —                          |
| `src/App.svelte`                          | 79    | H1                         |

### Detection Methodology

- **Manual static analysis** of all `.ts` and `.svelte` source files
- **Pattern matching** via `grep` for cross-file duplications
- **Line count analysis** for bloater detection
- **Framework version analysis** comparing `package.json` dependencies with code syntax
- **Architecture validation** against project's own `copilot-instructions.md`
- **Reference catalog:** Luzkan/smells taxonomy (Fowler 1999, Wake 2004, Martin 2008, Jerzyk 2022)
