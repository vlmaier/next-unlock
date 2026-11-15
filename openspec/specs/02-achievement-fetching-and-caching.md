# Spec 02: Achievement Fetching, Caching & Native Merge

## 1. Overview
Defines how achievement schemas and global rarity stats are fetched from Steam Community, cached on disk and in memory, and merged with local SteamOS unlock state.

## 2. Backend Fetching, SteamOS Local LibraryCache & Disk Cache (`backend/`)
1. **SteamOS Local `librarycache` Reader (`parse_local_user_stats` in `backend/achievement_parser.py`)**:
   - Scans `<steam_root>/userdata/*/config/librarycache/<appid>.json` (the local JSON cache written by SteamOS Gaming Mode).
   - Extracts `nTotal`, `nAchieved`, `vecHighlight`, `vecAchievedHidden`, and `vecUnachieved` (including `flCurrentProgress`, `flMaxProgress`, `flAchieved`, `rtUnlocked`, `strName`, `strDescription`, `strImage`).
   - Used by `get_installed_games()` to immediately populate `total_achievements`, `unlocked_count`, and `completion_percentage` for installed games without network requests.
   - Merged in `get_game_details(appid)` so user unlock states and multi-step progress counters (`flCurrentProgress / flMaxProgress`) work offline and without an active running game.
2. **Cache Location**:
   - Controlled by `NEXT_UNLOCK_CACHE_DIR` env var or defaults to `~/.config/next-unlock/cache`.
   - File path: `achievements_<appid>.json`.
2. **Canonical Disk Cache Schema**:
   ```json
   {
     "appid": 1245620,
     "game_title": "Elden Ring",
     "achievements": [
       {
         "id": "ach_elden_lord",
         "name": "Elden Lord",
         "description": "Achieved the \"Elden Lord\" ending.",
         "icon": "https://...",
         "unlocked": false,
         "unlock_time": null,
         "global_percentage": 24.5,
         "rarity_tier": "common",
         "hidden": false,
         "rec_score": 37.3
       }
     ]
   }
   ```
   - `save_cached_achievements(appid, payload)` MUST always persist the dictionary `{"appid": appid, "game_title": game_title, "achievements": achievements}`.
   - `load_cached_achievements(appid)` MUST normalize legacy list caches into `{"appid": appid, "game_title": None, "achievements": list}` and NEVER double-wrap dictionaries on network failure fallback.
3. **Force Refresh**:
   - `fetch_achievements_from_steam(appid, force_refresh=False)` bypasses the disk cache before making the HTTP request when `force_refresh=True`, falling back to disk cache only if the HTTP request fails.
4. **No Fake Hints**:
   - Do not populate `hint` with a duplicate of `description` or `"Unlocked by X% of players"`. `description` holds the official achievement description.

## 3. Frontend Multi-Tier Cache & Instant Hydration (`src/services/steamApi.ts`)
1. **Synchronous Access for Zero-Spinner Mounts**:
   - `SteamApiService.getCachedGames()` returns the in-memory games list immediately if available.
   - `SteamApiService.getCachedGameDetails(appid)` returns the in-memory or `localStorage` cached `{ game, ranked }` synchronously so `DeckyContent` and `FullDashboardPage` can initialize `useState` with existing data and avoid showing a loading spinner on every drawer toggle.
2. **Native SteamOS Client Merge (Parallel Execution)**:
   - Queries `window.SteamClient?.Apps?.GetMyAchievementsForApp` (supporting both numeric and string `appid`) and `window.appDetailsStore` (`GetAchievements(appid)` / `GetAppDetails(appid)`) **in parallel** with the backend RPC call (`Promise.all`) to avoid sequential timeout delays.
   - Maps each native achievement (`bAchieved`, `rtUnlocked`, `flCurrentProgress`, `flMaxProgress`) by ID and normalized name.
   - Native unlock status and progress override backend defaults, and `unlocked_count`, `completion_percentage`, and `ranked` are recomputed using the canonical ranking algorithm.
3. **Cache Invalidation**:
   - `togglePin(achievementId)` MUST immediately update `pinnedIds` AND re-rank all entries in `detailsCache` and `localStorage` synchronously before returning, so any component reading `getGameDetails(appid)` immediately sees the updated `is_pinned` and `ranked.pinned` lists.
   - `refresh(appid)` (`forceRefresh = true`) MUST bypass in-memory and `localStorage` caches and pass `force_refresh=True` to the backend RPC.
