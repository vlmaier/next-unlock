import React, { useState, useEffect, Component, ErrorInfo, ReactNode, useCallback } from 'react';
import { AlertTriangle } from 'lucide-react';
import { SteamApiService, getActiveApp, getActiveAppAsync } from '../services/steamApi';
import { Game, RankedAchievements } from '../types/achievement';
import { FullDashboard } from './FullDashboard';
import { QuickAccessMenu } from './QuickAccessMenu';
import cssText from '../generated.css';
import {
  PanelSection,
  PanelSectionRow,
  SteamSpinner,
  Navigation,
  showModal,
  ModalRoot,
} from './deckyUi';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[Next Unlock] Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 text-xs text-rose-300 bg-rose-950/40 border border-rose-800/60 rounded-xl flex flex-col gap-2 m-2">
          <div className="flex items-center gap-2 font-bold text-rose-200">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            <span>Next Unlock Error</span>
          </div>
          <p className="text-[11px] text-rose-300/80 leading-relaxed">
            {this.state.error?.message || 'An unexpected rendering error occurred.'}
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}

function resolveInitialState(allowAllMode: boolean) {
  const syncActive = getActiveApp();
  const cachedGames = SteamApiService.getCachedGamesSync();
  const lastSelected = SteamApiService.getLastSelectedAppId();

  let initialAppId: number | 'all' = 'all';
  if (lastSelected !== null && (allowAllMode || lastSelected !== 'all')) {
    initialAppId = lastSelected;
  } else if (syncActive) {
    initialAppId = syncActive.appid;
  } else if (cachedGames.length > 0) {
    initialAppId = cachedGames[0].appid;
  }

  const targetNumericId =
    initialAppId !== 'all'
      ? initialAppId
      : syncActive?.appid || cachedGames[0]?.appid || null;

  const cachedDetails = targetNumericId
    ? SteamApiService.getCachedGameDetailsSync(targetNumericId)
    : null;

  return {
    games: cachedGames,
    selectedAppId: initialAppId,
    selectedGame:
      cachedDetails?.game ||
      (targetNumericId ? cachedGames.find((g) => g.appid === targetNumericId) || null : null),
    ranked: cachedDetails?.ranked || null,
    hasHydratedData: Boolean(cachedDetails || cachedGames.length > 0),
  };
}

export const FullDashboardPage: React.FC = () => {
  const init = resolveInitialState(true);
  const [games, setGames] = useState<Game[]>(init.games);
  const [selectedAppId, setSelectedAppId] = useState<number | 'all'>(init.selectedAppId);
  const [selectedGame, setSelectedGame] = useState<Game | null>(init.selectedGame);
  const [ranked, setRanked] = useState<RankedAchievements | null>(init.ranked);
  const [loading, setLoading] = useState<boolean>(!init.hasHydratedData);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const loadData = useCallback(
    async (targetInput: number | 'all' = selectedAppId, forceRefresh = false) => {
      if (forceRefresh) setIsRefreshing(true);
      try {
        const active = (await getActiveAppAsync()) || getActiveApp();
        const gameList = await SteamApiService.getGames(forceRefresh);

        if (targetInput === 'all' && SteamApiService.getLastSelectedAppId() === 'all') {
          const allLoadedGames = await SteamApiService.getAllGamesDetails(gameList, forceRefresh);
          setGames(allLoadedGames);
          const primaryId = active?.appid || allLoadedGames[0]?.appid;
          if (primaryId) {
            const det = await SteamApiService.getGameDetails(primaryId, false);
            setSelectedGame(det.game);
            setRanked(det.ranked);
          }
          return;
        }

        const targetId =
          (targetInput !== 'all' ? targetInput : null) ||
          active?.appid ||
          gameList[0]?.appid ||
          null;

        if (targetId && targetInput === 'all') {
          setSelectedAppId(targetId);
        }

        if (targetId) {
          const details = await SteamApiService.getGameDetails(targetId, forceRefresh);
          const mergedGames = [...gameList];
          const existingIdx = mergedGames.findIndex((g) => g.appid === targetId);
          if (existingIdx >= 0) {
            mergedGames[existingIdx] = { ...mergedGames[existingIdx], ...details.game };
          } else {
            mergedGames.unshift(details.game);
          }

          setGames(mergedGames);
          setSelectedGame(details.game);
          setRanked(details.ranked);
        } else {
          setGames(gameList);
          setSelectedGame(null);
          setRanked(null);
        }
      } catch (e) {
        console.error('[Next Unlock] Error loading dashboard:', e);
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [selectedAppId]
  );

  useEffect(() => {
    loadData(selectedAppId, false);
  }, [selectedAppId, loadData]);

  const handleSelectGame = (id: number | 'all') => {
    SteamApiService.setLastSelectedAppId(id);
    setSelectedAppId(id);
    if (id !== 'all') {
      const syncDet = SteamApiService.getCachedGameDetailsSync(id);
      if (syncDet) {
        setSelectedGame(syncDet.game);
        setRanked(syncDet.ranked);
      }
    }
  };

  const handleTogglePin = async (id: string) => {
    await SteamApiService.togglePin(id);
    await loadData(selectedAppId, false);
  };

  const handleBack = () => {
    try {
      Navigation.NavigateBack();
    } catch {
      if (typeof window !== 'undefined') window.history.back();
    }
  };

  const activeApp = getActiveApp();
  const isRunning = Boolean(activeApp && selectedGame && activeApp.appid === selectedGame.appid);

  return (
    <div
      data-theme="steam_slate"
      style={{
        width: '100%',
        minHeight: '100vh',
        backgroundColor: '#0e141b',
        color: '#f1f5f9',
        overflowY: 'auto',
        boxSizing: 'border-box',
      }}
      className="w-full min-h-screen bg-[#0e141b] text-slate-100 overflow-y-auto font-sans"
    >
      <style dangerouslySetInnerHTML={{ __html: typeof cssText === 'string' ? cssText : '' }} />
      {loading && !selectedGame && games.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <SteamSpinner />
          <span className="text-xs text-slate-400 font-semibold">Loading Steam library achievements...</span>
        </div>
      ) : (
        <FullDashboard
          games={games}
          selectedAppId={selectedAppId}
          selectedGame={selectedGame}
          ranked={ranked}
          isRunningGame={isRunning}
          isRefreshing={isRefreshing}
          onSelectGame={handleSelectGame}
          onTogglePin={handleTogglePin}
          onRefresh={() => loadData(selectedAppId, true)}
          onBack={handleBack}
        />
      )}
    </div>
  );
};

export const DeckyContent: React.FC = () => {
  const init = resolveInitialState(false);
  const [games, setGames] = useState<Game[]>(init.games);
  const [selectedAppId, setSelectedAppId] = useState<number | 'all'>(init.selectedAppId);
  const [selectedGame, setSelectedGame] = useState<Game | null>(init.selectedGame);
  const [ranked, setRanked] = useState<RankedAchievements | null>(init.ranked);
  const [loading, setLoading] = useState<boolean>(!init.hasHydratedData);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const loadData = useCallback(
    async (forceRefresh = false) => {
      if (forceRefresh) setIsRefreshing(true);
      try {
        const active = (await getActiveAppAsync()) || getActiveApp();
        const gameList = await SteamApiService.getGames(forceRefresh);

        let targetId: number | null = null;
        if (selectedAppId !== 'all') {
          targetId = selectedAppId;
        } else if (active) {
          targetId = active.appid;
        } else if (gameList.length > 0) {
          targetId = gameList[0].appid;
        }

        if (targetId) {
          if (selectedAppId === 'all') {
            setSelectedAppId(targetId);
            SteamApiService.setLastSelectedAppId(targetId);
          }
          const details = await SteamApiService.getGameDetails(targetId, forceRefresh);

          const mergedGames = [...gameList];
          const existingIdx = mergedGames.findIndex((g) => g.appid === targetId);
          if (existingIdx >= 0) {
            mergedGames[existingIdx] = { ...mergedGames[existingIdx], ...details.game };
          } else {
            mergedGames.unshift(details.game);
          }
          setGames(mergedGames);
          setSelectedGame(details.game);
          setRanked(details.ranked);
        } else {
          setGames(gameList);
          setSelectedGame(null);
          setRanked(null);
        }
      } catch (err) {
        console.error('[Next Unlock] Error loading QAM data:', err);
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [selectedAppId]
  );

  useEffect(() => {
    let mounted = true;
    loadData(false).finally(() => {
      if (mounted) setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, [selectedAppId, loadData]);

  const handleSelectGame = (appid: number) => {
    SteamApiService.setLastSelectedAppId(appid);
    setSelectedAppId(appid);
    const syncDet = SteamApiService.getCachedGameDetailsSync(appid);
    if (syncDet) {
      setSelectedGame(syncDet.game);
      setRanked(syncDet.ranked);
    } else {
      const chosen = games.find((g) => g.appid === appid);
      if (chosen) setSelectedGame(chosen);
    }
  };

  const handleTogglePin = async (id: string) => {
    await SteamApiService.togglePin(id);
    await loadData(false);
  };

  const handleOpenFullDashboard = () => {
    try {
      Navigation.CloseSideMenus();
      Navigation.Navigate('/next-unlock');
    } catch (e) {
      console.warn('[Next Unlock] router navigation error, trying showModal:', e);
      try {
        showModal(
          <ModalRoot bAllowFullSize={true} bHideCloseIcon={false}>
            <FullDashboardPage />
          </ModalRoot>
        );
      } catch (modalErr) {
        console.error('[Next Unlock] showModal fallback error:', modalErr);
      }
    }
  };

  const activeApp = getActiveApp();
  const isRunning = Boolean(activeApp && selectedGame && activeApp.appid === selectedGame.appid);

  if (loading && !selectedGame && games.length === 0) {
    return (
      <div data-theme="steam_slate" className="w-full">
        <style dangerouslySetInnerHTML={{ __html: typeof cssText === 'string' ? cssText : '' }} />
        <PanelSection title="Next Unlock">
          <PanelSectionRow>
            <div className="flex flex-col items-center justify-center py-6 w-full gap-2">
              <SteamSpinner />
              <span className="text-[11px] text-slate-400 font-semibold">
                Loading Steam library & achievements...
              </span>
            </div>
          </PanelSectionRow>
        </PanelSection>
      </div>
    );
  }

  return (
    <div data-theme="steam_slate" className="w-full">
      <style dangerouslySetInnerHTML={{ __html: typeof cssText === 'string' ? cssText : '' }} />
      <QuickAccessMenu
        game={selectedGame}
        ranked={ranked}
        games={games}
        isRunningGame={isRunning}
        isRefreshing={isRefreshing}
        onSelectGame={handleSelectGame}
        onTogglePin={handleTogglePin}
        onOpenFullDashboard={handleOpenFullDashboard}
        onRefresh={() => loadData(true)}
      />
    </div>
  );
};
