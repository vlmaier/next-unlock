# Spec 03: Recommendation Engine & Pinning Contract

## 1. Problem Statement
Previously, Python and TypeScript had two incompatible scoring formulas, and TypeScript used `rec_score = (100 - global_percentage) + 50`, which ranked the hardest `0.1%` achievements at the top of "Up Next". Furthermore, pinning an achievement did not invalidate the frontend details cache, making pin clicks appear broken.

## 2. Canonical Recommendation Formula (Shared Between Python & TypeScript)
For every **locked** achievement (`unlocked == false`):

1. **Progress Ratio (`ratio`)**:
   - If `progress` is present and `progress.max > 1` and `progress.current > 0`:
     `ratio = min(1.0, max(0.0, progress.current / progress.max))`
   - Else: `ratio = 0.0`
2. **Global Unlock Percentage (`global_pct`)**:
   - Clamped to `[0.0, 100.0]`. Higher `global_pct` means more players unlocked it (easier / earlier progression).
3. **Visibility Bonus (`visibility_bonus`)**:
   - `15.0` if `not hidden and bool(description.strip())` else `0.0` (visible achievements with clear objectives are much more actionable than secret achievements with hidden descriptions).
4. **Canonical Score (`rec_score`)**:
   - If `unlocked == true` or `archived == true` (retired achievement/set in Steam's Achievement Sets overhaul) or `is_unobtainable == true` (broken/discontinued achievement): `rec_score = 0.0`.
   - Otherwise:
   ```
   rec_score = round((ratio * 60.0) + (global_pct * 0.8) + visibility_bonus, 1)
   ```
   - **Why this works**:
     - An achievement that is 80% complete (`ratio = 0.8 -> +48 pts`) or unlocked by 65% of players (`65 * 0.8 = +52 pts`) scores high (`~67-100+`) and surfaces at the top of **Up Next**.
     - A brutal 0.5% endgame grind with 0 progress scores `0 + 0.4 + 15 = 15.4` and stays at the bottom.
     - A hidden 1.2% achievement with no description scores `0.96` and stays at the very bottom.
     - An `archived: true` retired achievement or `is_unobtainable: true` broken achievement scores `0.0` and is excluded from active recommendation buckets (`up_next`, `almost_there`, `easy_grabs`) so unobtainable achievements never block or pollute recommendations.

## 3. Category Definitions (`RankedAchievements`)
Given a list of achievements and `pinned_ids`:
- `unlocked`: All achievements where `unlocked == True`, sorted by `unlock_time` descending (then `global_percentage` ascending).
- `locked`: All achievements where `unlocked == False`, sorted by `rec_score` descending (tie-broken by `global_percentage` descending, then `name` ascending).
- `pinned`: Locked achievements where `id in pinned_ids`, sorted by `rec_score` descending.
- `up_next`: Top 5 locked, non-archived (`not archived`), obtainable (`not is_unobtainable`) achievements from `locked` (excluding hidden achievements that have no description and zero progress, unless no other locked non-archived obtainable achievements exist), sorted by `rec_score` descending.
- `almost_there`: Locked, non-archived, obtainable achievements with `progress.max > 1` and `ratio >= 0.5` (50%+ progress toward a multi-step goal), sorted by `ratio` descending.
- `easy_grabs`: Locked, non-archived, obtainable achievements with `global_percentage >= 25.0`, sorted by `global_percentage` descending.
- `missable`: Locked achievements where `is_missable == True` or `category == "Missable"` or `hidden == True` or `global_percentage <= 10.0`, sorted with explicit missables (`is_missable == True` or `category == "Missable"`) first, then by `rec_score` descending.

## 4. Pinning & Persistence Contract
1. **Startup Sync**:
   - `SteamApiService` loads persisted pins from `localStorage` (`next_unlock_pins`) immediately on module initialization and syncs with backend `get_pinned()` RPC on first load.
2. **Toggle Pin (`togglePin(achievementId)`)**:
   - Toggles `achievementId` in `pinnedIds` immediately (optimistic update), persists to `localStorage`, re-computes `is_pinned` and `ranked` across all cached games in `detailsCache`, and invokes backend `toggle_pin(achievementId)` RPC.
   - Returns `{ achievement_id: string, pinned: boolean }`.
