# Next Unlock — OpenSpec Project Architecture & Invariants

## 1. Purpose
**Next Unlock** is a Decky Loader plugin for SteamOS / Steam Deck that helps players track achievement completion across their installed Steam library and recommends the **easiest, closest-to-completion achievements ("Up Next")** without leaving Gaming Mode.

## 2. Core Product Principles
1. **Works With or Without a Running Game:**
   - If a game is currently running, Next Unlock automatically selects it.
   - If **no game is running**, Next Unlock loads the user's installed Steam library (ordered by most recently played) and selects the last viewed or most recently played game. The user can always switch games in both the Quick Access Menu (QAM) and Full Dashboard, and can always open the Full Dashboard.
2. **Instant State Recall (Zero Unnecessary Spinners):**
   - Re-opening the QAM drawer or switching to the Full Dashboard must render previously loaded games, selected game, and achievement data **synchronously (0ms)** from memory/`localStorage`, revalidating quietly in the background only when stale or explicitly refreshed.
3. **Actionable, Accurate Recommendations ("Up Next" = Closest & Easiest):**
   - Players want to know what they can realistically unlock next.
   - Ranking prioritizes **partial progress proximity** (`current / max`) first, followed by **high global unlock percentage** (`global_percentage` — achievements most players unlock are the easiest/most natural next steps), and prioritizes visible achievements over hidden/secret ones.
   - Never invert `global_percentage` to recommend `0.1%` ultra-rare endgame grinds as "Up Next".
4. **Authentic SteamOS Gaming Mode UX:**
   - Cohesive SteamOS Deck Slate palette (`#0e141b` base, `#161f2c` surface, `#1e293b` cards, `#389fff` focus/accent blue, `#eab308` pinned gold, `#10b981` unlocked emerald).
   - No fake/placeholder data in production: no duplicate "Strategy & Tips" popups that just repeat the achievement description, no fake "Unlock" cheat buttons in production UI, and no multi-theme bloat.
   - Every interactive element must respond immediately to both **Gamepad (`onActivate` / D-Pad focus)** and **Touch/Mouse (`onClick`)** without nested focus traps.

## 3. System Architecture & Single Source of Truth

```
┌─────────────────────────────────────────────────────────────────────────┐
│ SteamOS Environment                                                     │
│  ├─ Local Steam Library: libraryfolders.vdf + appmanifest_<appid>.acf   │
│  ├─ Process Table: /proc/<pid>/environ (SteamAppId=<appid>)             │
│  ├─ Steam Client CEF Globals: window.SteamClient.Apps, window.Router    │
│  └─ Steam Community Public Stats: steamcommunity.com/stats/<appid>/...  │
└───────────────┬─────────────────────────────────────────┬───────────────┘
                │ Python Backend (main.py + backend/)     │ CEF Globals
                ▼                                         ▼
┌───────────────────────────────────────┐ ┌───────────────────────────────┐
│ Decky Python RPC Server               │ │ Frontend SteamApiService      │
│  ├─ get_active_app()                  │ │  ├─ Sync Memory + LocalStorage│
│  ├─ get_games(force_refresh)          │◄┼─►├─ Merges Native Unlock State│
│  ├─ get_game_details(appid, refresh)  │ │  ├─ Canonical Ranking Sync    │
│  ├─ toggle_pin(achievement_id)        │ │  └─ Immediate Cache Update    │
│  └─ get_pinned()                      │ └───────────────┬───────────────┘
└───────────────────────────────────────┘                 │
                                                          ▼
                                          ┌───────────────────────────────┐
                                          │ Decky UI Surfaces (index.tsx) │
                                          │  ├─ QuickAccessMenu (320px)   │
                                          │  └─ FullDashboardPage (Route) │
                                          └───────────────────────────────┘
```

### Boundaries & Responsibilities
- **Python Backend (`main.py`, `backend/`)**:
  - Discovers installed Steam games from `.acf` manifests across internal drive and SD card libraries.
  - Detects the active running Steam `appid` via `/proc` inspection.
  - Fetches public achievement schemas (names, descriptions, icons, global percentages, and Steam Achievement Sets / DLC sets from `schema_v2`) from Steam Community and caches them in `~/.config/next-unlock/cache/achievements_<appid>.json`.
  - Enriches achievements with **Missable** (`is_missable`, `missable_reason`) and **Unobtainable** (`is_unobtainable`) flags via the 3-tier hybrid resolver in `backend/missables_resolver.py` (Bundled + GitHub `achievement-scavenger-database` CDN -> Steam Community Guide `Missable` section parser -> SteamHunters `obtainability` API).
  - Persists pinned achievement IDs in `~/.config/next-unlock/settings.json`.
  - Computes canonical recommendation scores, per-set progress, and categories via `backend/recommendation.py`.
- **Frontend Service (`src/services/steamApi.ts`)**:
  - Maintains synchronous in-memory state (`getCachedState()`) + `localStorage` persistence so React components mount with data immediately when available.
  - Queries `window.SteamClient.Apps.GetMyAchievementsForApp` (when available in SteamOS CEF) to overlay the current user's exact `unlocked` status, `unlock_time`, and `progress` onto the achievement list.
  - Re-runs the **exact same canonical ranking function** (`rankAchievements`) whenever native unlock states or pin toggles modify achievement state, and **immediately updates both in-memory and `localStorage` caches** so UI re-renders instantaneously.
- **UI Components (`src/index.tsx`, `src/components/`)**:
  - Resolve `window.DFL` (Decky Frontend Library) dynamically at render time in `src/components/deckyUi.tsx`.
  - Never block the user from switching games or opening the Full Dashboard when a game has `0` achievements or when no game is currently running.
