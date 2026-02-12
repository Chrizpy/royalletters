# Code Quality Summary

## Critical Issues
**🔴 7 high-severity issues found — Attention recommended**

### Top 3 Problems
1. **Svelte 4 Syntax on Svelte 5** — All 17 components use legacy `export let`, `$:`, and `on:click` patterns — **Priority: High**
2. **God Components** — `HostLobby.svelte` (1,172 lines) and `GameScreen.svelte` (854 lines) handle too many responsibilities — **Priority: High**
3. **Duplicated Logic (3×)** — Target validation, token-to-win maps, and name formatting are copy-pasted across 3–4 files each — **Priority: High**

## Overall Assessment
- **Project Size**: 45+ source files, 2 languages (TypeScript, Svelte)
- **Code Quality Grade**: **C** (28 total issues, 7 high-severity)
- **Total Issues**: High: 7 | Medium: 12 | Low: 9
- **Overall Complexity**: Medium — well-structured engine, but component layer needs work

## Business Impact
- **Technical Debt**: Medium — Framework migration (Svelte 4→5) is the biggest item
- **Maintenance Risk**: Medium — Duplicated logic means bugs can appear in one copy but not others
- **Development Velocity Impact**: Medium — Large components are hard to navigate and modify
- **Recommended Priority**: High — Address duplication and decomposition before adding new features

## ✅ Quick Wins
- **Consolidate 3 duplicated functions**: Priority: High — Eliminates shotgun surgery risk across 10+ files
- **Replace `JSON.parse(JSON.stringify)` with `structuredClone`**: Priority: Low — One-line fix, more robust
- **Extract `broadcastAndScheduleAI()` helper**: Priority: Medium — Removes 9 copy-paste call pairs
- **Remove unused interfaces/dead code**: Priority: Low — Reduces confusion for new developers

## 🔧 Major Refactoring Needed
- **Decompose `HostLobby.svelte`**: Priority: High — 1,172-line God component mixing networking, AI, game lifecycle, and UI
- **Decompose `GameScreen.svelte`**: Priority: High — 854 lines mixing state derivation, animations, selection logic, and layout
- **Migrate to Svelte 5 runes**: Priority: Medium — All 17 components need `$props()`, `$derived()`, `$state()`, `$effect()`
- **Make game engine immutable**: Priority: Low — Currently mutates state despite docs saying otherwise

## Recommended Action Plan

### Phase 1 (Immediate — 1-2 days)
- Consolidate the 3 duplicated utility functions into single sources
- Remove dead code (`GameSync` class, unused interfaces)
- Fix `JSON.parse/stringify` deep clone

### Phase 2 (Short-term — 1 week)
- Decompose `HostLobby.svelte` into sub-components + host game store
- Decompose `GameScreen.svelte` into focused sub-components
- Make `NetworkMessage` a proper discriminated union for type safety
- Replace effect switch statement with a handler registry

### Phase 3 (Long-term — ongoing)
- Migrate all components from Svelte 4 to Svelte 5 rune syntax
- Refactor engine toward immutable state updates
- Add structured action tracking instead of parsing log strings

## 💡 Key Takeaways
- **The engine layer is well-designed** — Clean separation of effects, validation, deck, and player modules
- **The component layer needs decomposition** — Two components carry most of the application's complexity
- **The project's own architecture docs are good** — but the code doesn't fully follow them (especially immutability and store-layer indirection)

---
*Detailed technical analysis available in `code-smell-detector-report.md`*
