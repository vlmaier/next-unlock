# Spec 01: Game Discovery, Active Game Detection & Library Selection

## 1. Overview
Defines how Next Unlock discovers installed games, detects the currently running game, and manages game selection when no game is running or when a game has zero achievements.

## 2. Installed Game Discovery (`backend/achievement_parser.py`)
1. **Steam Root Resolution (`find_all_steam_roots`)**:
   - Honors `NEXT_UNLOCK_STEAM_ROOT` environment variable if set (used for deterministic local testing and CI fixtures).
   - Scans `DECKY_USER_HOME`, `/home/*/.local/share/Steam`, `/home/*/.steam/steam`, `/home/*/.var/app/com.valvesoftware.Steam/.local/share/Steam`, and `~/` equivalents so discovery works regardless of whether Decky runs as `deck`, another username, or `root`.
2. **Library Folders (`get_library_folders`)**:
   - Reads `steamapps/libraryfolders.vdf` in each Steam root and extracts all `"path"` entries containing a valid `steamapps` directory.
   - Scans bounded shallow SD card / external mount patterns (`/run/media/*/steamapps`, `/run/media/*/*/steamapps`, `/media/*/steamapps`, `/mnt/*/steamapps`, etc. — never `recursive=True` `**` walks).
3. **App Manifest Parsing (`parse_appmanifest`)**:
   - Parses `appmanifest_<appid>.acf` for `"appid"`, `"name"`, and `"LastPlayed"` timestamp.
   - Filters out non-game tools, Proton versions, Steam Linux Runtimes, Steamworks Common Redistributables, and Soundtracks (`IGNORED_APP_IDS` + case-insensitive name filter).
4. **Full Owned Library Merge & Sorting**:
   - Deduplicates by `appid` (keeping the entry with the highest `last_played`).
   - Places the currently running `appid` first (if any), followed by all installed games sorted by `last_played` descending, then `name` ascending.
   - Frontend `getGames` also inspects SteamOS Gaming Mode's native library store (`window.collectionStore?.allAppsCollection?.allApps` / `window.appStore?.m_mapApps`) for owned games (`app_type === 1`), merging any uninstalled owned games after installed games (sorted by `rt_last_time_played` desc) so the user's entire owned library (e.g. 200+ games) is discovered and progressively synced while surfacing `"Syncing library (X/Y)..."`.

## 3. Running Game Detection
1. **Frontend Sync Detection (`getActiveApp`)**:
   - Checks `window.Router?.MainRunningApp` and `window.Router?.RunningApps?.[0]`.
   - Returns `{ appid: number, name: string } | null`.
2. **Backend Process Detection (`get_running_steam_appid`)**:
   - Honors `NEXT_UNLOCK_RUNNING_APPID` environment variable if set (for testing/sandbox simulation).
   - Scans `/proc/[0-9]*/environ` with `O_RDONLY | O_NONBLOCK` for `SteamAppId=<id>`, ignoring `IGNORED_APP_IDS`.

## 4. Game Selection State Machine (With or Without an Active Game)
1. **Initial Selection Priority**:
   - If the user explicitly selected a game (`selectedAppId`) during the session, preserve `selectedAppId`.
   - Else if a game is currently running (`activeApp`), select `activeApp.appid`.
   - Else if `games.length > 0`, select `games[0].appid` (the most recently played installed game).
   - Else `selectedGame` is `null` (empty library state).
2. **Zero-Achievement Game Handling (Critical Regression Requirement)**:
   - If the selected game has `total_achievements === 0` (e.g., a game without Steam achievements or offline uncached game):
     - `selectedGame` MUST still be updated to that game object (`total_achievements: 0, achievements: []`).
     - It MUST NEVER leave the previous game's achievements on screen or reset `selectedGame` to `null`.
     - The Game Selector dropdown in QAM and Game Selector pills in Full Dashboard MUST remain visible and interactive so the user can switch to any other installed game.
3. **All Games Overview Mode (`selectedAppId === 'all'`)**:
   - In Full Dashboard, selecting `'all'` aggregates achievements across all loaded games (`SteamApiService.getAllGamesDetails(games)`), allowing cross-library filtering ("Up Next", "Easy Grabs", "Pinned", "Unlocked") with the game title badged on each card.
