# Spec 04: SteamOS UI Surfaces, UX & Controller Navigation

## 1. Design Philosophy
Next Unlock must look and feel like a native part of **SteamOS Gaming Mode** (`#0e141b` dark slate background, `#161f2c` elevated surface, `#1e293b` cards, `#389fff` Steam focus blue, crisp typography, zero clutter).

### Eliminated Anti-Patterns
1. **No Fake Strategy Hints**: Never show a "Strategy" button or popup when no real strategy guide exists; never repeat `description` inside a `hint` popup.
2. **No Production Cheat Buttons**: Never render a mock "Unlock" button on achievement cards in the Decky plugin UI.
3. **No Multi-Theme Clutter**: Remove the 5-theme dropdown (`ThemeSwitcher`). Use the single, cohesive SteamOS Slate palette everywhere.
4. **No Duplicate Headers**: `FullDashboardPage` and `FullDashboard` must have a single unified top bar with the title, active game / library status, Refresh button, and `← Back` action.
5. **No Nested Interactive Traps inside `Focusable`**: Ensure clicking or pressing `A` (Gamepad Activate) on any control (`DropdownItem`, `ButtonItem`, `Field`, `AchievementCard`, `GameSelector`, `CategoryFilter`) reliably triggers its handler without being swallowed by parent containers.

## 2. Surface 1: Quick Access Menu (`QuickAccessMenu.tsx` — 320px Drawer)
The QAM panel is the fast, in-game or library-side companion. It must include:
1. **Game Selector & Controls Section (Always Visible When `games.length > 0`)**:
   - Even if no game is actively running (`isRunningGame == false`) or the selected game has `0` achievements, the **Game Selector Dropdown (`DropdownItem`)** MUST be rendered whenever `games.length > 0` so the user can pick any installed game.
   - Displays completion progress bar (`ProgressBarWithInfo`) when `total_achievements > 0`, or a clear status message ("No Steam achievements recorded for this title — select another game above") when `total_achievements === 0`.
2. **Pinned Achievements Section**:
   - Shown whenever `ranked.pinned.length > 0`.
   - Clicking/activating a pinned item unpins it immediately.
3. **Up Next (Easiest & Closest Unlocks) Section**:
   - Shows top 3 recommended locked achievements with clear icon, title, description (or progress bar `current / max`), global unlock `%`, and pin indicator (`★ Pin`).
   - Clicking/activating an item pins/unpins it immediately with instant visual feedback.
4. **Action Buttons Section (Always Visible)**:
   - **Open Full Dashboard** button (`ButtonItem`) — ALWAYS visible so the user can open the full-screen view even when no game is running.
   - **Refresh Achievements** button (`ButtonItem`) — calls `onRefresh(true)` (`forceRefresh = true`) with a visual loading indicator (`isRefreshing`) so the user sees immediate feedback.

## 3. Surface 2: Full Dashboard (`FullDashboard.tsx` — Fullscreen Route `/next-unlock`)
1. **Unified Header Bar**:
   - App title & icon, **Refresh** button (with spinning state during refresh), and **Back** button (`Navigation.NavigateBack()`).
2. **Game Selector Bar (`GameSelector.tsx`)**:
   - Horizontal focusable row (`flow-children="row"`) with **All Games Overview** pill + individual installed game pills showing game icon, title, and completion percentage (when loaded).
3. **Hero Summary Card & Steam Achievement Sets Bar**:
   - In single-game mode: Game widescreen capsule (`460:215`), title, status badge (`Running Now` when actively running), unlocked count (`X of Y Unlocked`), and `ProgressRing` + `Up Next` highlight.
   - **Steam Achievement Sets Support**:
     - When a game defines multiple Achievement Sets (`achievement_sets.length > 1`, e.g., `Base Game`, `DLC` expansions, thematic categories, or `Archived` sets), both the Full Dashboard and QAM surface a **Set Selector Bar** (`All Sets` + individual sets with `unlocked/total`, completion `%`, `DLC` badge when `dlc_appid > 0`, `100%` trophy badge when a set is complete, and `Archived` badge when retired).
     - Selecting an Achievement Set filters the displayed achievements and dynamically recomputes `RankedAchievements` and `CategoryFilter` badge counts for that set so base-game completion and DLC completion can be tracked independently.
     - Individual `AchievementCard` and QAM items display a Set badge when a game has multiple sets (e.g., `DLC · Shadow of the Erdtree`) and an `Archived` badge when `archived === true`.
   - In `All Games Overview` mode: Aggregated achievement count across loaded games, total tracked games count, and overall `ProgressRing`.
4. **Filter & Search Controls**:
   - `CategoryFilter` pills (`All`, `Up Next`, `Easy Grabs`, `Almost There`, `Pinned`, `Secret / Rare`, `Unlocked`) with live badge counts.
   - `SearchBar` filtering by achievement name or description.
5. **Achievement Grid (`AchievementCard.tsx`)**:
   - Clean 2-column responsive layout (`grid-cols-1 md:grid-cols-2`).
   - Each card is a `Focusable` element (`onActivate` and `onClick` toggle pin).
   - Displays: `AchievementIcon` (with lock/check badge), title (or `Hidden Achievement` with option to reveal or clear indicator), rarity badge (`Ultra Rare ≤5%`, `Rare ≤15%`, `Common >15%`), full 2-line description, progress bar (`current / max` when applicable), unlock status/timestamp, and clear `Pin / Pinned` badge button.
