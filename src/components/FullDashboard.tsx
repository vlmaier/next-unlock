import React, { useState, useMemo } from 'react';
import { Game, RankedAchievements, CategoryFilterType, ColorThemeId, Achievement } from '../types/achievement';
import { ProgressRing } from './ProgressRing';
import { CategoryFilter } from './CategoryFilter';
import { AchievementCard } from './AchievementCard';
import { SearchBar } from './SearchBar';
import { ThemeSwitcher } from './ThemeSwitcher';
import { GameSelector } from './GameSelector';
import { Trophy, Award, CheckCircle2, ListFilter, Sparkles, Layers } from 'lucide-react';

interface FullDashboardProps {
  games: Game[];
  selectedAppId: number | 'all';
  selectedGame: Game;
  ranked: RankedAchievements;
  onSelectGame: (appid: number | 'all') => void;
  onTogglePin: (id: string) => void;
  onUnlockAchievement?: (appid: number, id: string) => void;
  currentTheme: ColorThemeId;
  onThemeChange: (theme: ColorThemeId) => void;
}

export const FullDashboard: React.FC<FullDashboardProps> = ({
  games,
  selectedAppId,
  selectedGame,
  ranked,
  onSelectGame,
  onTogglePin,
  onUnlockAchievement,
  currentTheme,
  onThemeChange,
}) => {
  const [activeCategory, setActiveCategory] = useState<CategoryFilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [bannerImgError, setBannerImgError] = useState(false);

  const isAllGamesMode = selectedAppId === 'all';

  // Aggregate stats across all games if in 'all' mode
  const allGamesStats = useMemo(() => {
    let totalAch = 0;
    let unlockedAch = 0;
    let allAchievementsList: (Achievement & { gameName?: string; appid?: number })[] = [];

    games.forEach((g) => {
      totalAch += g.total_achievements;
      unlockedAch += g.unlocked_count;
      g.achievements.forEach((a) => {
        allAchievementsList.push({ ...a, gameName: g.name, appid: g.appid });
      });
    });

    const completion = totalAch > 0 ? (unlockedAch / totalAch) * 100 : 0;
    return {
      totalAch,
      unlockedAch,
      completion,
      achievements: allAchievementsList,
    };
  }, [games]);

  // Compute category counts
  const counts = useMemo(() => {
    if (isAllGamesMode) {
      const allAch = allGamesStats.achievements;
      const locked = allAch.filter((a) => !a.unlocked);
      const unlocked = allAch.filter((a) => a.unlocked);
      const pinned = allAch.filter((a) => a.is_pinned && !a.unlocked);
      const missable = allAch.filter((a) => (a.hidden || a.category === 'Missable') && !a.unlocked);
      const almostThere = allAch.filter((a) => a.progress && (a.progress.current / a.progress.max) >= 0.75 && !a.unlocked);
      const easyGrabs = allAch.filter((a) => (a.global_percentage >= 30 || (a.estimated_minutes && a.estimated_minutes <= 15)) && !a.unlocked);

      return {
        all: allAch.length,
        up_next: Math.min(6, locked.length),
        almost_there: almostThere.length,
        easy_grabs: easyGrabs.length,
        missable: missable.length,
        pinned: pinned.length,
        unlocked: unlocked.length,
      };
    }

    return {
      all: selectedGame.achievements.length,
      up_next: ranked.up_next.length,
      almost_there: ranked.almost_there.length,
      easy_grabs: ranked.easy_grabs.length,
      missable: ranked.missable.length,
      pinned: ranked.pinned.length,
      unlocked: ranked.unlocked.length,
    };
  }, [isAllGamesMode, selectedGame, ranked, allGamesStats]);

  // Filter achievements list
  const filteredAchievements = useMemo(() => {
    let list: (Achievement & { appid?: number })[] = isAllGamesMode
      ? allGamesStats.achievements
      : selectedGame.achievements;

    if (isAllGamesMode) {
      if (activeCategory === 'up_next') {
        list = [...allGamesStats.achievements]
          .filter((a) => !a.unlocked)
          .sort((a, b) => (b.rec_score || 0) - (a.rec_score || 0))
          .slice(0, 8);
      } else if (activeCategory === 'almost_there') {
        list = allGamesStats.achievements.filter(
          (a) => !a.unlocked && a.progress && a.progress.current / a.progress.max >= 0.75
        );
      } else if (activeCategory === 'easy_grabs') {
        list = allGamesStats.achievements.filter(
          (a) => !a.unlocked && (a.global_percentage >= 30 || (a.estimated_minutes && a.estimated_minutes <= 15))
        );
      } else if (activeCategory === 'missable') {
        list = allGamesStats.achievements.filter((a) => !a.unlocked && (a.hidden || a.category === 'Missable'));
      } else if (activeCategory === 'pinned') {
        list = allGamesStats.achievements.filter((a) => a.is_pinned && !a.unlocked);
      } else if (activeCategory === 'unlocked') {
        list = allGamesStats.achievements.filter((a) => a.unlocked);
      }
    } else {
      if (activeCategory === 'up_next') list = ranked.up_next;
      else if (activeCategory === 'almost_there') list = ranked.almost_there;
      else if (activeCategory === 'easy_grabs') list = ranked.easy_grabs;
      else if (activeCategory === 'missable') list = ranked.missable;
      else if (activeCategory === 'pinned') list = ranked.pinned;
      else if (activeCategory === 'unlocked') list = ranked.unlocked;
    }

    if (!searchQuery.trim()) return list;

    const q = searchQuery.toLowerCase();
    return list.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        (a.hint && a.hint.toLowerCase().includes(q))
    );
  }, [isAllGamesMode, allGamesStats, selectedGame, ranked, activeCategory, searchQuery]);

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col gap-6 p-4 md:p-6">
      {/* Layer 1: Clean Top Header Navbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border-color)] pb-4">
        <div className="flex items-center gap-3">
          <div className="bg-[var(--bg-surface)] p-2.5 rounded-xl border border-[var(--border-color)] shadow-sm">
            <Trophy className="w-6 h-6 text-[var(--accent-gold)]" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-[var(--text-main)]">
              Next Unlock
            </h1>
            <p className="text-xs text-[var(--text-muted)] mt-0.5 font-medium">
              Smart Achievement Companion & Priority Roadmap
            </p>
          </div>
        </div>

        {/* Live Theme Switcher */}
        <div className="flex items-center gap-3">
          <ThemeSwitcher currentTheme={currentTheme} onThemeChange={onThemeChange} />
        </div>
      </div>

      {/* Layer 2: Game Selector Pills Bar */}
      <GameSelector games={games} selectedAppId={selectedAppId} onSelectGame={onSelectGame} />

      {/* Layer 3: Hero Active Game Card */}
      <div className="next-card p-4 md:p-5 flex flex-col md:flex-row items-center justify-between gap-5 bg-[var(--bg-card)] relative overflow-hidden">
        {isAllGamesMode ? (
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="w-24 h-24 md:w-28 md:h-28 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] flex items-center justify-center text-[var(--accent-primary)] shadow-md flex-shrink-0">
              <Layers className="w-12 h-12" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-[var(--accent-primary)] uppercase tracking-wider bg-[var(--bg-primary)] px-2 py-0.5 rounded border border-[var(--border-color)]">
                Library Overview
              </span>
              <h2 className="text-xl md:text-2xl font-black text-[var(--text-main)] mt-1 tracking-tight">All Tracked Games</h2>
              <div className="flex items-center gap-4 mt-2 text-xs text-[var(--text-muted)] font-semibold">
                <span className="flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-[var(--accent-gold)]" /> {allGamesStats.unlockedAch} of {allGamesStats.totalAch} Total Unlocked
                </span>
                <span className="flex items-center gap-1.5 text-[var(--accent-emerald)]">
                  <CheckCircle2 className="w-4 h-4 text-[var(--accent-emerald)]" /> {games.length} Games Tracked
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-4 w-full md:w-auto">
            {!bannerImgError && selectedGame.header_image ? (
              <img
                src={selectedGame.header_image}
                alt={selectedGame.name}
                onError={() => setBannerImgError(true)}
                className="w-24 h-24 md:w-28 md:h-28 rounded-xl object-cover border border-[var(--border-color)] shadow-md flex-shrink-0"
              />
            ) : (
              <div className="w-24 h-24 md:w-28 md:h-28 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] flex items-center justify-center font-black text-[var(--text-main)] text-lg text-center p-2 flex-shrink-0">
                {selectedGame.name}
              </div>
            )}

            <div>
              <span className="text-[10px] font-bold text-[var(--accent-primary)] uppercase tracking-wider bg-[var(--bg-primary)] px-2 py-0.5 rounded border border-[var(--border-color)]">
                Active Title
              </span>
              <h2 className="text-xl md:text-2xl font-black text-[var(--text-main)] mt-1 tracking-tight">{selectedGame.name}</h2>
              <div className="flex items-center gap-4 mt-2 text-xs text-[var(--text-muted)] font-semibold">
                <span className="flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-[var(--accent-gold)]" /> {selectedGame.unlocked_count} of {selectedGame.total_achievements} Unlocked
                </span>
                <span className="flex items-center gap-1.5 text-[var(--accent-emerald)]">
                  <CheckCircle2 className="w-4 h-4 text-[var(--accent-emerald)]" /> {Math.round(selectedGame.completion_percentage)}% Completed
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Completion Progress Ring */}
        <div className="flex items-center gap-4 bg-[var(--bg-primary)]/90 backdrop-blur px-5 py-3.5 rounded-xl border border-[var(--border-color)] shadow-inner">
          <ProgressRing
            percentage={isAllGamesMode ? allGamesStats.completion : selectedGame.completion_percentage}
            unlockedCount={isAllGamesMode ? allGamesStats.unlockedAch : selectedGame.unlocked_count}
            totalCount={isAllGamesMode ? allGamesStats.totalAch : selectedGame.total_achievements}
            size={84}
            strokeWidth={8}
          />
          <div className="text-xs flex flex-col gap-1">
            <span className="font-bold text-[var(--text-main)]">
              {isAllGamesMode ? 'Library Progress' : 'Game Completion'}
            </span>
            <span className="text-[var(--text-muted)] text-[11px] font-medium">
              {(isAllGamesMode ? allGamesStats.totalAch - allGamesStats.unlockedAch : selectedGame.total_achievements - selectedGame.unlocked_count)} remaining
            </span>
            {!isAllGamesMode && ranked.up_next.length > 0 && (
              <span className="text-[11px] text-[var(--accent-primary)] font-bold flex items-center gap-1 mt-0.5 truncate">
                <Sparkles className="w-3.5 h-3.5 flex-shrink-0" /> Up Next: {ranked.up_next[0].name}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Layer 4: Section Header & Category Filters Section */}
      <div className="flex flex-col gap-3">
        {/* Section Title & Search Input Header Row */}
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-[var(--text-main)] uppercase tracking-wider flex items-center gap-2">
            <span>Achievements</span>
            <span className="text-xs px-2 py-0.5 bg-[var(--bg-surface)] text-[var(--text-muted)] border border-[var(--border-color)] rounded-full font-bold">
              {filteredAchievements.length}
            </span>
          </h3>

          {/* SearchBar Input Box */}
          <SearchBar value={searchQuery} onChange={setSearchQuery} />
        </div>

        {/* Single Horizontal Category Filter Row */}
        <CategoryFilter
          activeCategory={activeCategory}
          onSelectCategory={setActiveCategory}
          counts={counts}
        />
      </div>

      {/* Achievement Grid */}
      {filteredAchievements.length === 0 ? (
        <div className="next-card p-10 text-center text-xs text-[var(--text-muted)] flex flex-col items-center gap-2">
          <ListFilter className="w-8 h-8 opacity-40" />
          <p className="font-bold text-[var(--text-main)]">No achievements found.</p>
          <p className="text-[11px]">Clear search or switch category filters above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filteredAchievements.map((ach) => (
            <AchievementCard
              key={ach.id}
              achievement={ach}
              onTogglePin={onTogglePin}
              onUnlock={(id) => onUnlockAchievement && onUnlockAchievement(ach.appid || selectedGame.appid, id)}
              showUnlockButton={true}
            />
          ))}
        </div>
      )}
    </div>
  );
};
