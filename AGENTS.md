# AGENTS.md — Engineering & AI Agent Playbook for `next-unlock`

Welcome to **Next Unlock**, a Decky Loader plugin for SteamOS / Steam Deck. Every contributor and AI agent working in this repository **must** follow these rules to prevent regressions and ensure every change works before being installed on a physical Steam Deck.

---

## 1. Spec-First Development (`openspec/`)

Before changing business logic, caching, RPC methods, or UI state transitions, read the specifications in [`openspec/`](./openspec/):
- [`openspec/project.md`](./openspec/project.md) — Architecture, boundaries, and core product invariants.
- [`openspec/specs/01-game-discovery.md`](./openspec/specs/01-game-discovery.md) — Installed `.acf` manifest scanning, `/proc` active game detection, and no-active-game library behavior.
- [`openspec/specs/02-achievement-fetching-and-caching.md`](./openspec/specs/02-achievement-fetching-and-caching.md) — Steam Community scraping, disk cache format, native `SteamClient` merge, and 0ms synchronous cache hydration.
- [`openspec/specs/03-recommendation-and-pinning.md`](./openspec/specs/03-recommendation-and-pinning.md) — Canonical recommendation scoring (`Up Next` = easiest & closest to completion) and pin synchronization.
- [`openspec/specs/04-ui-and-ux.md`](./openspec/specs/04-ui-and-ux.md) — Native SteamOS Slate UX, QAM & Full Dashboard requirements, and controller focus rules.

If a requirement changes, **update the relevant OpenSpec document first**, then update the tests and implementation.

---

## 2. Toolchain & `justfile` Commands

We use **`just`** (`justfile`) as our task runner, the **Astral Python suite** (`uv`, `ruff`, `ty`, `pytest`), and **pnpm + Vite/Vitest/Rollup** for TypeScript/React.

| Command | Description |
| :--- | :--- |
| `just verify` | **Mandatory quality gate.** Runs formatting checks, linters (`ruff`), typecheckers (`ty` + `tsc`), unit tests, integration tests, production build, and bundle smoke verification. |
| `just dev` | Starts the full-stack pre-Steam Deck sandbox (live Python `main.py` dev RPC bridge + Vite browser emulator mounting `src/index.tsx`). |
| `just lint` | Runs `uv run ruff check .` and TypeScript/React static checks. |
| `just fmt` | Formats Python code with `uv run ruff format .` and checks imports. |
| `just typecheck` | Runs `uv run ty check main.py backend` and `pnpm run typecheck` (`tsc --noEmit`). |
| `just test` | Runs all Python (`pytest`), Frontend (`vitest`), and Integration tests. |
| `just test-py` | Runs Python unit and fixture tests via `uv run pytest`. |
| `just test-ts` | Runs Frontend unit and component tests via `pnpm test`. |
| `just build` | Compiles Tailwind CSS and builds the Decky Rollup bundle (`dist/index.js`). |
| `just package` | Builds and packages `next-unlock.zip` and runs `scripts/verify_release_zip.py`. |

> **Rule:** Never declare a task finished until `just verify` exits with code `0`.

---

## 3. Non-Negotiable Architectural Invariants

1. **Single Canonical Recommendation Formula:**
   - Python (`backend/recommendation.py`) and TypeScript (`src/services/steamApi.ts` `rankAchievements`) MUST use the exact same scoring formula defined in `openspec/specs/03-recommendation-and-pinning.md`:
     `rec_score = round((ratio * 60.0) + (global_pct * 0.8) + visibility_bonus, 1)`
   - **Higher `global_percentage` = easier achievement = higher score.** Never invert `global_percentage` (`100 - pct`).
2. **Instant Synchronous Cache Hydration & Immediate Invalidation:**
   - Opening the QAM drawer or Full Dashboard must initialize React state synchronously from `SteamApiService.getCachedGames()` and `SteamApiService.getCachedGameDetails(appid)` so previously loaded data renders in `0ms` without flashing a spinner.
   - Mutating pins (`togglePin`) MUST synchronously update `pinnedIds`, `localStorage`, and all cached `{ game, ranked }` entries in `detailsCache` before returning.
   - Clicking "Refresh" or "Scan Again" MUST pass `forceRefresh = true` all the way through `SteamApiService` to the backend RPC.
3. **Must Work Without an Active Running Game:**
   - Never lock the user on a "No Game Detected" screen when installed games exist in their library.
   - Always render the Game Selector dropdown in QAM (when `games.length > 0`) and the "Open Full Dashboard" button.
   - Selecting a game with `0` achievements must still set `selectedGame` to that game (showing its empty achievements state) rather than ignoring the selection or hiding the game switcher.
4. **Decky Loader & SteamOS CEF Runtime Safety:**
   - In `src/components/deckyUi.tsx`, always resolve `window.DFL` dynamically at render time (`getDFL()`), never once at module evaluation time.
   - Do not use external Google Fonts (`@import url(...)`) that block rendering when the Steam Deck is offline.
   - Never ship mock data fallbacks, fake "Strategy" popups that duplicate descriptions, or fake "Unlock" buttons in production UI.
