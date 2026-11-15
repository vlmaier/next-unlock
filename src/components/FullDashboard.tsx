import React, { useState, useMemo, useEffect } from 'react';
import { Game, RankedAchievements, CategoryFilterType, Achievement } from '../types/achievement';
import { ProgressRing } from './ProgressRing';
import { CategoryFilter } from './CategoryFilter';
import { AchievementCard } from './AchievementCard';
import { SearchBar } from './SearchBar';
import { GameSelector } from './GameSelector';
import { Trophy, Award, CheckCircle2, ListFilter, Sparkles, Layers, Gamepad2, RefreshCw, ArrowLeft } from 'lucide-react';
import { Focusable } from './deckyUi';
import { rankAchievements, computeAchievementSets } from '../services/steamApi';

interface FullDashboardProps {
  games: Game[];
  selectedAppId: number | 'all';
  selectedGame: Game | null;
  ranked: RankedAchievements | null;
  isRunningGame?: boolean;
  isRefreshing?: boolean;
  onSelectGame: (appid: number | 'all') => void;
  onTogglePin: (id: string) => void;
  onRefresh?: () => void;
  onBack?: () => void;
}

export const FullDashboard: React.FC<FullDashboardProps> = ({
  games,
  selectedAppId,
  selectedGame,
  ranked,
  isRunningGame = false,
  isRefreshing = false,
  onSelectGame,
  onTogglePin,
  onRefresh,
  onBack,
}) => {
  const [activeCategory, setActiveCategory] = useState<CategoryFilterType>('all');
  const [activeSetId, setActiveSetId] = useState<number | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [imgIdx, setImgIdx] = useState(0);

  useEffect(() => {
    setImgIdx(0);
    setActiveSetId('all');
  }, [selectedGame?.appid, selectedAppId]);

  const isAllGamesMode = selectedAppId === 'all';

  // Compute Steam Achievement Sets for the currently selected game
  const achievementSets = useMemo(() => {
    if (isAllGamesMode || !selectedGame) return [];
    return computeAchievementSets(
      selectedGame.achievements || [],
      selectedGame.achievement_sets
    );
  }, [isAllGamesMode, selectedGame]);

  const activeSet = useMemo(() => {
    if (activeSetId === 'all') return null;
    return achievementSets.find((s) => s.id === activeSetId) || null;
  }, [achievementSets, activeSetId]);

  // Aggregate stats and canonical ranking across all games when in 'all' mode
  const allGamesStats = useMemo(() => {
    let totalAch = 0;
    let unlockedAch = 0;
    const allAchievementsList: (Achievement & { gameName?: string; appid?: number })[] = [];
    const pinnedSet = new Set<string>();

    games.forEach((g) => {
      const gameAchs = g.achievements || [];
      const gTotal = Math.max(g.total_achievements || 0, gameAchs.length);
      const gUnlocked =
        gameAchs.length > 0
          ? gameAchs.filter((a) => a.unlocked).length
          : g.unlocked_count || 0;
      totalAch += gTotal;
      unlockedAch += gUnlocked;
      gameAchs.forEach((a) => {
        if (a.is_pinned) pinnedSet.add(a.id);
        allAchievementsList.push({ ...a, gameName: g.name, appid: g.appid });
      });
    });

    if (allAchievementsList.length === 0 && selectedGame && (selectedGame.achievements?.length || 0) > 0) {
      totalAch = selectedGame.total_achievements;
      unlockedAch = selectedGame.unlocked_count;
      selectedGame.achievements.forEach((a) => {
        if (a.is_pinned) pinnedSet.add(a.id);
        allAchievementsList.push({
          ...a,
          gameName: selectedGame.name,
          appid: selectedGame.appid,
        });
      });
    }

    const gameLookup = new Map<string, { gameName?: string; appid?: number }>();
    allAchievementsList.forEach((a) => {
      gameLookup.set(`${a.id}::${a.name}`, { gameName: a.gameName, appid: a.appid });
    });

    const enrich = (list: Achievement[]) =>
      list.map((a) => ({
        ...a,
        ...(gameLookup.get(`${a.id}::${a.name}`) || {}),
      }));

    const baseRanked = rankAchievements(allAchievementsList, pinnedSet);
    const allRanked = {
      pinned: enrich(baseRanked.pinned),
      up_next: enrich(baseRanked.up_next),
      almost_there: enrich(baseRanked.almost_there),
      easy_grabs: enrich(baseRanked.easy_grabs),
      missable: enrich(baseRanked.missable),
      locked: enrich(baseRanked.locked),
      unlocked: enrich(baseRanked.unlocked),
    };

    const completion = totalAch > 0 ? Math.round((unlockedAch / totalAch) * 1000) / 10 : 0;
    return {
      totalAch,
      unlockedAch,
      completion,
      achievements: [...allRanked.locked, ...allRanked.unlocked],
      ranked: allRanked,
    };
  }, [games, selectedGame]);

  // Compute canonical ranking for the selected Set (or entire game / library)
  const activeRanked = useMemo(() => {
    if (isAllGamesMode) return allGamesStats.ranked;
    if (!selectedGame || activeSetId === 'all') return ranked;

    const pinnedSet = new Set<string>();
    const setAchs = (selectedGame.achievements || []).filter((a) => {
      if (a.is_pinned) pinnedSet.add(a.id);
      return (typeof a.set_id === 'number' ? a.set_id : 0) === activeSetId;
    });
    return rankAchievements(setAchs, pinnedSet);
  }, [isAllGamesMode, allGamesStats.ranked, selectedGame, activeSetId, ranked]);

  // Compute category counts using the single canonical ranking structure
  const counts = useMemo(() => {
    if (!activeRanked) {
      return {
        all: 0,
        up_next: 0,
        almost_there: 0,
        easy_grabs: 0,
        missable: 0,
        pinned: 0,
        unlocked: 0,
      };
    }

    return {
      all: activeRanked.locked.length + activeRanked.unlocked.length,
      up_next: activeRanked.up_next.length,
      almost_there: activeRanked.almost_there.length,
      easy_grabs: activeRanked.easy_grabs.length,
      missable: activeRanked.missable.length,
      pinned: activeRanked.pinned.length,
      unlocked: activeRanked.unlocked.length,
    };
  }, [activeRanked]);

  // Filter achievements list from canonical activeRanked
  const filteredAchievements = useMemo(() => {
    let list: (Achievement & { gameName?: string; appid?: number })[] = [];

    if (activeRanked) {
      if (activeCategory === 'all') {
        list = [...activeRanked.locked, ...activeRanked.unlocked];
      } else if (activeCategory === 'up_next') {
        list = activeRanked.up_next;
      } else if (activeCategory === 'almost_there') {
        list = activeRanked.almost_there;
      } else if (activeCategory === 'easy_grabs') {
        list = activeRanked.easy_grabs;
      } else if (activeCategory === 'missable') {
        list = activeRanked.missable;
      } else if (activeCategory === 'pinned') {
        list = activeRanked.pinned;
      } else if (activeCategory === 'unlocked') {
        list = activeRanked.unlocked;
      }
    }

    if (!searchQuery.trim()) return list;

    const q = searchQuery.toLowerCase();
    return list.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        (a.gameName && a.gameName.toLowerCase().includes(q)) ||
        (a.set_name && a.set_name.toLowerCase().includes(q))
    );
  }, [activeRanked, activeCategory, searchQuery]);

  const imageCandidates = useMemo(() => {
    if (!selectedGame) return [];
    return [
      selectedGame.header_image,
      `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${selectedGame.appid}/header.jpg`,
      `https://steamcdn-a.akamaihd.net/steam/apps/${selectedGame.appid}/header.jpg`,
      `https://cdn.cloudflare.steamstatic.com/steam/apps/${selectedGame.appid}/header.jpg`,
    ].filter(Boolean) as string[];
  }, [selectedGame]);

  const currentImg = imgIdx < imageCandidates.length ? imageCandidates[imgIdx] : null;

  const ringUnlocked = isAllGamesMode
    ? allGamesStats.unlockedAch
    : activeSet
    ? activeSet.unlocked_count
    : selectedGame?.unlocked_count || 0;
  const ringTotal = isAllGamesMode
    ? allGamesStats.totalAch
    : activeSet
    ? activeSet.total_achievements
    : selectedGame?.total_achievements || 0;
  const ringPct = isAllGamesMode
    ? allGamesStats.completion
    : activeSet
    ? activeSet.completion_percentage
    : selectedGame?.completion_percentage || 0;

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col gap-5 p-4 md:p-6">
      {/* Unified SteamOS Top Header Bar */}
      <div className="flex items-center justify-between gap-3 border-b border-[#2e3d52] pb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="bg-[#161f2c] p-2 rounded-lg border border-[#2e3d52]">
            <Trophy className="w-5 h-5 text-[#389fff]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-extrabold tracking-tight text-slate-100">
                Next Unlock
              </h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#161f2c] text-[#389fff] border border-[#2e3d52]">
                Achievement Tracker
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">
              Prioritized by completion progress and global unlock rate
            </p>
          </div>
        </div>

        <Focusable flow-children="row" className="flex items-center gap-2">
          {onRefresh && (
            <Focusable
              focusable={true}
              onActivate={onRefresh}
              onClick={onRefresh}
              data-testid="dashboard-refresh-btn"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#161f2c] hover:bg-[#1e293b] text-slate-200 hover:text-white rounded-lg border border-[#2e3d52] text-xs font-bold transition-all cursor-pointer focus:ring-2 focus:ring-[#389fff] focus:outline-none"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#389fff]' : ''}`} />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </Focusable>
          )}
          {onBack && (
            <Focusable
              focusable={true}
              onActivate={onBack}
              onClick={onBack}
              data-testid="dashboard-back-btn"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#161f2c] hover:bg-[#1e293b] text-slate-200 hover:text-white rounded-lg border border-[#2e3d52] text-xs font-bold transition-all cursor-pointer focus:ring-2 focus:ring-[#389fff] focus:outline-none"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </Focusable>
          )}
        </Focusable>
      </div>

      {/* Game Selector Pills Bar */}
      {games.length > 0 && (
        <GameSelector games={games} selectedAppId={selectedAppId} onSelectGame={onSelectGame} />
      )}

      {/* Hero Summary Card */}
      <div className="next-card p-4 md:p-5 flex flex-col gap-4 bg-[#161f2c]">
        <div className="flex flex-col md:flex-row items-center justify-between gap-5">
          {isAllGamesMode ? (
            <div className="flex items-center gap-4 w-full md:w-auto">
              <div
                style={{ width: 156, height: 73 }}
                className="rounded-lg bg-[#0e141b] border border-[#2e3d52] flex items-center justify-center text-[#389fff] flex-shrink-0"
              >
                <Layers className="w-8 h-8" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-[#389fff] uppercase tracking-wider bg-[#0e141b] px-2 py-0.5 rounded border border-[#2e3d52]">
                  Library Overview
                </span>
                <h2 className="text-lg md:text-xl font-black text-slate-100 mt-1 tracking-tight">
                  All Installed Games
                </h2>
                <div className="flex items-center gap-4 mt-1.5 text-xs text-slate-300 font-semibold flex-wrap">
                  <span className="flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-[#eab308]" /> {allGamesStats.unlockedAch} / {allGamesStats.totalAch} Unlocked
                  </span>
                  <span className="flex items-center gap-1.5 text-[#10b981]">
                    <CheckCircle2 className="w-4 h-4 text-[#10b981]" /> {games.length} Games in Library
                  </span>
                </div>
              </div>
            </div>
          ) : selectedGame ? (
            <div className="flex items-center gap-4 w-full md:w-auto">
              {currentImg ? (
                <img
                  src={currentImg}
                  alt={selectedGame.name}
                  onError={() => setImgIdx((prev) => prev + 1)}
                  style={{ width: 156, height: 73 }}
                  className="rounded-lg object-cover border border-[#2e3d52] shadow-md flex-shrink-0"
                />
              ) : (
                <div
                  style={{ width: 156, height: 73 }}
                  className="rounded-lg bg-[#0e141b] border border-[#2e3d52] flex flex-col items-center justify-center text-[#389fff] p-2 flex-shrink-0"
                >
                  <Gamepad2 className="w-6 h-6 mb-1" />
                  <span className="text-[10px] font-bold text-center text-slate-200 truncate max-w-full">
                    {selectedGame.name}
                  </span>
                </div>
              )}

              <div>
                {isRunningGame ? (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border bg-emerald-500/15 text-emerald-300 border-emerald-500/30 inline-block mb-1">
                    Running Now
                  </span>
                ) : selectedGame.total_achievements > 0 &&
                  selectedGame.unlocked_count >= selectedGame.total_achievements ? (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border bg-amber-500/15 text-amber-300 border-amber-500/30 inline-block mb-1">
                    100% Completed
                  </span>
                ) : null}
                <h2 className="text-lg md:text-xl font-black text-slate-100 tracking-tight">
                  {selectedGame.name}
                </h2>
                <div className="flex items-center gap-4 mt-1.5 text-xs text-slate-300 font-semibold flex-wrap">
                  <span className="flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-[#eab308]" /> {ringUnlocked} of {ringTotal} Unlocked
                    {activeSet ? ` (${activeSet.name})` : ''}
                  </span>
                  <span className="flex items-center gap-1.5 text-[#10b981]">
                    <CheckCircle2 className="w-4 h-4 text-[#10b981]" /> {Math.round(ringPct)}% Completed
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-400 py-4">No game selected.</div>
          )}

          {/* Completion Progress Ring */}
          {(isAllGamesMode || selectedGame) && (
            <div className="flex items-center gap-4 bg-[#0e141b] px-4 py-3 rounded-lg border border-[#2e3d52] w-full md:w-auto justify-between md:justify-start">
              <ProgressRing
                percentage={ringPct}
                unlockedCount={ringUnlocked}
                totalCount={ringTotal}
                size={76}
                strokeWidth={7}
              />
              <div className="text-xs flex flex-col gap-1 min-w-0">
                <span className="font-bold text-slate-100">
                  {isAllGamesMode
                    ? 'Library Progress'
                    : activeSet
                    ? `Set: ${activeSet.name}`
                    : 'Game Completion'}
                </span>
                <span className="text-slate-400 text-[11px] font-medium">
                  {Math.max(0, ringTotal - ringUnlocked)} remaining
                </span>
                {activeRanked && activeRanked.up_next.length > 0 && (
                  <span className="text-[11px] text-[#389fff] font-bold flex items-center gap-1 mt-0.5 truncate max-w-[220px]">
                    <Sparkles className="w-3.5 h-3.5 flex-shrink-0" /> Next: {activeRanked.up_next[0].name} ({activeRanked.up_next[0].global_percentage}%)
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Steam Achievement Sets Bar (Base Game / DLC / Updates / Archived) */}
        {!isAllGamesMode && achievementSets.length > 1 && selectedGame && (
          <div className="border-t border-[#2e3d52] pt-3.5 flex flex-col gap-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#389fff]" />
                Steam Achievement Sets ({achievementSets.length})
              </span>
              <span className="text-slate-400 hidden sm:inline">
                Base game &amp; DLC expansions tracked independently
              </span>
            </div>

            <Focusable flow-children="row" className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              <Focusable
                focusable={true}
                onActivate={() => setActiveSetId('all')}
                onClick={() => setActiveSetId('all')}
                data-testid="achievement-set-all"
                className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 border transition-all cursor-pointer flex-shrink-0 focus:ring-2 focus:ring-[#389fff] focus:outline-none ${
                  activeSetId === 'all'
                    ? 'bg-[#389fff] text-[#0e141b] border-[#389fff]'
                    : 'bg-[#0e141b] text-slate-200 border-[#2e3d52] hover:border-slate-500'
                }`}
              >
                <span>All Sets</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                    activeSetId === 'all'
                      ? 'bg-[#0e141b]/20 text-[#0e141b]'
                      : 'bg-[#161f2c] text-slate-300'
                  }`}
                >
                  {selectedGame.unlocked_count}/{selectedGame.total_achievements}
                </span>
              </Focusable>

              {achievementSets.map((setItem) => {
                const isSelected = activeSetId === setItem.id;
                const isSetComplete =
                  setItem.total_achievements > 0 &&
                  setItem.unlocked_count >= setItem.total_achievements;
                return (
                  <Focusable
                    key={setItem.id}
                    focusable={true}
                    onActivate={() => setActiveSetId(setItem.id)}
                    onClick={() => setActiveSetId(setItem.id)}
                    data-testid={`achievement-set-${setItem.id}`}
                    className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 border transition-all cursor-pointer flex-shrink-0 focus:ring-2 focus:ring-[#389fff] focus:outline-none ${
                      isSelected
                        ? 'bg-[#389fff] text-[#0e141b] border-[#389fff]'
                        : isSetComplete
                        ? 'bg-[#0e141b] text-emerald-300 border-emerald-500/40 hover:border-emerald-400'
                        : 'bg-[#0e141b] text-slate-200 border-[#2e3d52] hover:border-slate-500'
                    }`}
                  >
                    {isSetComplete && (
                      <Trophy
                        className={`w-3.5 h-3.5 flex-shrink-0 ${
                          isSelected ? 'text-[#0e141b]' : 'text-[#eab308]'
                        }`}
                      />
                    )}
                    <span>{setItem.name}</span>
                    {setItem.dlc_appid && (
                      <span
                        className={`text-[9px] uppercase px-1.5 py-0.5 rounded font-extrabold ${
                          isSelected
                            ? 'bg-[#0e141b]/25 text-[#0e141b]'
                            : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                        }`}
                      >
                        DLC
                      </span>
                    )}
                    {setItem.archived && (
                      <span
                        className={`text-[9px] uppercase px-1.5 py-0.5 rounded font-extrabold ${
                          isSelected
                            ? 'bg-[#0e141b]/25 text-[#0e141b]'
                            : 'bg-slate-700/60 text-slate-400'
                        }`}
                      >
                        Archived
                      </span>
                    )}
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                        isSelected
                          ? 'bg-[#0e141b]/20 text-[#0e141b]'
                          : isSetComplete
                          ? 'bg-emerald-500/15 text-emerald-300'
                          : 'bg-[#161f2c] text-slate-300'
                      }`}
                    >
                      {setItem.unlocked_count}/{setItem.total_achievements} ({Math.round(setItem.completion_percentage)}%)
                    </span>
                  </Focusable>
                );
              })}
            </Focusable>
          </div>
        )}
      </div>

      {/* Category Filter & Search Row */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              {activeSet ? `${activeSet.name} Achievements` : 'Achievements'}
            </h3>
            <span className="text-[11px] px-2 py-0.5 bg-[#161f2c] text-slate-300 border border-[#2e3d52] rounded-full font-bold">
              {filteredAchievements.length}
            </span>
            <span className="text-[11px] text-slate-400 hidden sm:inline">
              • Click or press A on any locked card to pin/unpin
            </span>
          </div>

          <SearchBar value={searchQuery} onChange={setSearchQuery} />
        </div>

        <CategoryFilter
          activeCategory={activeCategory}
          onSelectCategory={setActiveCategory}
          counts={counts}
        />
      </div>

      {/* Achievement Grid */}
      {filteredAchievements.length === 0 ? (
        <div className="next-card p-8 text-center text-xs text-slate-400 flex flex-col items-center gap-2 bg-[#161f2c]">
          <ListFilter className="w-7 h-7 opacity-50 text-slate-400" />
          <p className="font-bold text-slate-200">
            {selectedGame && selectedGame.total_achievements === 0 && !isAllGamesMode
              ? `No Steam achievements recorded for ${selectedGame.name}.`
              : 'No matching achievements in this view.'}
          </p>
          <p className="text-[11px]">
            {selectedGame && selectedGame.total_achievements === 0 && !isAllGamesMode
              ? 'Select another installed game from the bar above.'
              : 'Try switching category tabs or clearing the search filter.'}
          </p>
        </div>
      ) : (
        <Focusable flow-children="grid" className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredAchievements.map((ach) => (
            <AchievementCard
              key={`${ach.appid || selectedGame?.appid || 'g'}-${ach.id}`}
              achievement={ach}
              onTogglePin={onTogglePin}
            />
          ))}
        </Focusable>
      )}
    </div>
  );
};
