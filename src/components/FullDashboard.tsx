import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Game, RankedAchievements, CategoryFilterType, Achievement } from '../types/achievement';
import { ProgressRing } from './ProgressRing';
import { CategoryFilter } from './CategoryFilter';
import { AchievementCard } from './AchievementCard';
import { SearchBar } from './SearchBar';
import { GameSelector } from './GameSelector';
import { Trophy, Award, CheckCircle2, ListFilter, Sparkles, Layers, Gamepad2, RefreshCw, ArrowLeft, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { Focusable } from './deckyUi';
import { rankAchievements, computeAchievementSets } from '../services/steamApi';

interface FullDashboardProps {
  games: Game[];
  selectedAppId: number | 'all';
  selectedGame: Game | null;
  ranked: RankedAchievements | null;
  isRunningGame?: boolean;
  isRefreshing?: boolean;
  syncStatus?: { done: number; total: number } | null;
  onSelectGame: (appid: number | 'all') => void;
  onTogglePin: (id: string) => void;
  onRefresh?: () => void;
  onBack?: () => void;
}

const RibbonThumbnail: React.FC<{
  appid: number;
  headerImage?: string;
  alt: string;
}> = ({ appid, headerImage, alt }) => {
  const [idx, setIdx] = useState(0);
  const candidates = useMemo(() => {
    const list: string[] = [];
    if (headerImage) list.push(headerImage);
    list.push(
      `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appid}/header.jpg`,
      `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appid}/header.jpg`,
      `https://steamcdn-a.akamaihd.net/steam/apps/${appid}/header.jpg`
    );
    return Array.from(new Set(list));
  }, [appid, headerImage]);

  useEffect(() => {
    setIdx(0);
  }, [appid, headerImage]);

  const src = idx < candidates.length ? candidates[idx] : null;
  if (!src) {
    return (
      <div
        style={{ width: 38, height: 18 }}
        className="rounded bg-[#161f2c] border border-[#2e3d52] flex items-center justify-center flex-shrink-0"
      >
        <Gamepad2 className="w-3 h-3 text-[#389fff]" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={() => setIdx((prev) => prev + 1)}
      style={{ width: 38, height: 18 }}
      className="rounded object-cover flex-shrink-0 border border-black/30"
    />
  );
};

interface RibbonTarget {
  key: string;
  appid: number;
  gameName: string;
  setId: number | 'all';
  setName?: string;
  headerImage: string;
  unlockedCount: number;
  totalCount: number;
  remaining: number;
  completionPct: number;
}

export const FullDashboard: React.FC<FullDashboardProps> = ({
  games,
  selectedAppId,
  selectedGame,
  ranked,
  isRunningGame = false,
  isRefreshing = false,
  syncStatus = null,
  onSelectGame,
  onTogglePin,
  onRefresh,
  onBack,
}) => {
  const [activeCategory, setActiveCategory] = useState<CategoryFilterType>('all');
  const [activeSetId, setActiveSetId] = useState<number | 'all'>('all');
  const [revealAllSecrets, setRevealAllSecrets] = useState(false);
  const [onlyMissable, setOnlyMissable] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [imgIdx, setImgIdx] = useState(0);
  const pendingSetIdRef = useRef<number | 'all' | null>(null);

  useEffect(() => {
    setImgIdx(0);
    setOnlyMissable(false);
    if (pendingSetIdRef.current !== null) {
      setActiveSetId(pendingSetIdRef.current);
      pendingSetIdRef.current = null;
    } else {
      setActiveSetId('all');
    }
  }, [selectedGame?.appid, selectedAppId]);

  useEffect(() => {
    setImgIdx(0);
  }, [activeSetId]);

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

  // Aggregate stats, canonical ranking, and "Closest to 100% Ribbon" advisor across all games
  const allGamesStats = useMemo(() => {
    let totalAch = 0;
    let unlockedAch = 0;
    const allAchievementsList: (Achievement & { gameName?: string; appid?: number })[] = [];
    const pinnedSet = new Set<string>();
    const ribbonCandidates: RibbonTarget[] = [];

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

      const sets = computeAchievementSets(gameAchs, g.achievement_sets);
      if (sets.length > 1) {
        sets.forEach((s) => {
          if (s.archived || s.total_achievements === 0) return;
          if (s.unlocked_count > 0 && s.unlocked_count < s.total_achievements) {
            ribbonCandidates.push({
              key: `${g.appid}-set-${s.id}`,
              appid: g.appid,
              gameName: g.name,
              setId: s.id,
              setName: s.name,
              headerImage: s.header_image || g.header_image,
              unlockedCount: s.unlocked_count,
              totalCount: s.total_achievements,
              remaining: s.total_achievements - s.unlocked_count,
              completionPct: s.completion_percentage,
            });
          }
        });
      } else if (gTotal > 0 && gUnlocked > 0 && gUnlocked < gTotal) {
        ribbonCandidates.push({
          key: `${g.appid}-all`,
          appid: g.appid,
          gameName: g.name,
          setId: 'all',
          headerImage: g.header_image,
          unlockedCount: gUnlocked,
          totalCount: gTotal,
          remaining: gTotal - gUnlocked,
          completionPct: Math.round((gUnlocked / gTotal) * 1000) / 10,
        });
      }
    });

    ribbonCandidates.sort(
      (a, b) => a.remaining - b.remaining || b.completionPct - a.completionPct
    );

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
      closestRibbons: ribbonCandidates.slice(0, 3),
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

  const hasLockedSecrets = useMemo(() => {
    if (!activeRanked) return false;
    return activeRanked.locked.some((a) => Boolean(a.hidden));
  }, [activeRanked]);

  const lockedMissablesCount = useMemo(() => {
    if (!activeRanked) return 0;
    return activeRanked.locked.filter((a) => Boolean(a.is_missable || a.category === 'Missable')).length;
  }, [activeRanked]);

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

    if (onlyMissable) {
      list = list.filter((a) => !a.unlocked && Boolean(a.is_missable || a.category === 'Missable'));
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
  }, [activeRanked, activeCategory, onlyMissable, searchQuery]);

  const imageCandidates = useMemo(() => {
    if (!selectedGame) return [];
    const candidates: (string | undefined)[] = [];
    if (activeSet?.header_image) {
      candidates.push(activeSet.header_image);
    }
    if (activeSet?.dlc_appid) {
      candidates.push(
        `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${activeSet.dlc_appid}/header.jpg`,
        `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${activeSet.dlc_appid}/header.jpg`
      );
    }
    candidates.push(
      selectedGame.header_image,
      `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${selectedGame.appid}/header.jpg`,
      `https://steamcdn-a.akamaihd.net/steam/apps/${selectedGame.appid}/header.jpg`,
      `https://cdn.cloudflare.steamstatic.com/steam/apps/${selectedGame.appid}/header.jpg`
    );
    return candidates.filter(Boolean) as string[];
  }, [selectedGame, activeSet]);

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

  const handleSelectRibbonTarget = (target: RibbonTarget) => {
    pendingSetIdRef.current = target.setId;
    onSelectGame(target.appid);
  };

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
          {syncStatus && syncStatus.total > 0 && (
            <span
              data-testid="library-sync-status"
              className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-[#161f2c] text-[#389fff] border border-[#389fff]/30 whitespace-nowrap"
            >
              Syncing library ({syncStatus.done}/{syncStatus.total})...
            </span>
          )}
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
                  {lockedMissablesCount > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveCategory('all');
                        setOnlyMissable((prev) => !prev);
                      }}
                      data-testid="missable-radar-btn"
                      className={`flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] font-bold transition-colors ${
                        onlyMissable
                          ? 'bg-amber-500 text-[#0e141b] border-amber-400'
                          : 'bg-amber-500/15 text-amber-300 border-amber-500/35 hover:border-amber-400'
                      }`}
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>
                        {lockedMissablesCount} Missable Left
                      </span>
                    </button>
                  )}
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

        {/* Closest to 100% Ribbon Advisor (in All Games Overview mode) */}
        {isAllGamesMode && allGamesStats.closestRibbons.length > 0 && (
          <div className="border-t border-[#2e3d52] pt-3.5 flex flex-col gap-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5 text-[#eab308]" />
                Closest to 100% Ribbon
              </span>
              <span className="text-slate-400 hidden sm:inline">
                Fastest path to your next completion badge
              </span>
            </div>

            <Focusable flow-children="row" className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {allGamesStats.closestRibbons.map((item) => (
                <Focusable
                  key={item.key}
                  focusable={true}
                  onActivate={() => handleSelectRibbonTarget(item)}
                  onClick={() => handleSelectRibbonTarget(item)}
                  data-testid={`ribbon-advisor-${item.key}`}
                  className="px-3 py-2 rounded-lg bg-[#0e141b] hover:bg-[#1e293b] border border-[#2e3d52] hover:border-[#389fff]/60 flex items-center justify-between gap-2.5 transition-all cursor-pointer focus:ring-2 focus:ring-[#389fff] focus:outline-none"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <RibbonThumbnail
                      appid={item.appid}
                      headerImage={item.headerImage}
                      alt={item.gameName}
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-100 truncate">
                        {item.gameName}
                      </div>
                      {item.setName && (
                        <div className="text-[10px] font-semibold text-slate-400 truncate">
                          {item.setName}
                        </div>
                      )}
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold whitespace-nowrap flex-shrink-0">
                    {item.remaining} left • {Math.round(item.completionPct)}%
                  </span>
                </Focusable>
              ))}
            </Focusable>
          </div>
        )}

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
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 border transition-all cursor-pointer flex-shrink-0 focus:ring-2 focus:ring-[#389fff] focus:outline-none ${
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
                const setThumbUrl = setItem.header_image || selectedGame.header_image;
                return (
                  <Focusable
                    key={setItem.id}
                    focusable={true}
                    onActivate={() => setActiveSetId(setItem.id)}
                    onClick={() => setActiveSetId(setItem.id)}
                    data-testid={`achievement-set-${setItem.id}`}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 border transition-all cursor-pointer flex-shrink-0 focus:ring-2 focus:ring-[#389fff] focus:outline-none ${
                      isSelected
                        ? 'bg-[#389fff] text-[#0e141b] border-[#389fff]'
                        : isSetComplete
                        ? 'bg-[#0e141b] text-emerald-300 border-emerald-500/40 hover:border-emerald-400'
                        : 'bg-[#0e141b] text-slate-200 border-[#2e3d52] hover:border-slate-500'
                    }`}
                  >
                    {setThumbUrl && (
                      <img
                        src={setThumbUrl}
                        alt={setItem.name}
                        style={{ width: 38, height: 18 }}
                        className="rounded object-cover flex-shrink-0 border border-black/30"
                      />
                    )}
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

      {/* Category Filter, Spoiler Reveal & Search Row */}
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

          <div className="flex items-center gap-2">
            {lockedMissablesCount > 0 && (
              <Focusable
                focusable={true}
                onActivate={() => setOnlyMissable((prev) => !prev)}
                onClick={() => setOnlyMissable((prev) => !prev)}
                data-testid="toggle-missable-only-btn"
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer flex-shrink-0 focus:ring-2 focus:ring-[#389fff] focus:outline-none ${
                  onlyMissable
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                    : 'bg-[#161f2c] text-amber-300/90 border-[#2e3d52] hover:border-amber-500/40'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <span>Missable ({lockedMissablesCount})</span>
              </Focusable>
            )}
            {hasLockedSecrets && (
              <Focusable
                focusable={true}
                onActivate={() => setRevealAllSecrets((prev) => !prev)}
                onClick={() => setRevealAllSecrets((prev) => !prev)}
                data-testid="toggle-reveal-secrets-btn"
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer flex-shrink-0 focus:ring-2 focus:ring-[#389fff] focus:outline-none ${
                  revealAllSecrets
                    ? 'bg-[#389fff]/15 text-[#389fff] border-[#389fff]/40'
                    : 'bg-[#161f2c] text-slate-300 border-[#2e3d52] hover:border-slate-500'
                }`}
              >
                {revealAllSecrets ? (
                  <>
                    <EyeOff className="w-3.5 h-3.5 text-[#389fff]" />
                    <span>Hide Secrets</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-3.5 h-3.5 text-slate-400" />
                    <span>Reveal Secrets</span>
                  </>
                )}
              </Focusable>
            )}
            <SearchBar value={searchQuery} onChange={setSearchQuery} />
          </div>
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
              appid={ach.appid || selectedGame?.appid}
              forceRevealSpoilers={revealAllSecrets}
              onTogglePin={onTogglePin}
            />
          ))}
        </Focusable>
      )}
    </div>
  );
};
