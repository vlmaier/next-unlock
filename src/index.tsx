import React, { useState, useEffect, Component, ErrorInfo, ReactNode } from 'react';
import { Trophy, AlertTriangle } from 'lucide-react';
import { FaTrophy } from 'react-icons/fa';
import { SteamApiService, getActiveApp, getActiveAppAsync } from './services/steamApi';
import { Game, RankedAchievements, ColorThemeId } from './types/achievement';
import { FullDashboard } from './components/FullDashboard';
import { QuickAccessMenu } from './components/QuickAccessMenu';
import cssText from './generated.css';

if (typeof document !== 'undefined') {
  try {
    let style = document.getElementById('next-unlock-styles');
    if (!style) {
      style = document.createElement('style');
      style.id = 'next-unlock-styles';
      document.head.appendChild(style);
    }
    style.textContent = typeof cssText === 'string' ? cssText : '';
  } catch (err) {
    console.error('[Next Unlock] Style injection error:', err);
  }
}

// Ensure Decky Loader SP_JSX fallback compatibility
if (typeof window !== 'undefined') {
  const w = window as any;
  if (!w.SP_JSX) {
    const reactObj = w.SP_REACT || w.SP_REMOTES?.react || React;
    w.SP_JSX = {
      jsx: reactObj?.createElement || React.createElement,
      jsxs: reactObj?.createElement || React.createElement,
      Fragment: reactObj?.Fragment || 'div'
    };
  }
}

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
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

import {
  PanelSection,
  PanelSectionRow,
  SteamSpinner,
  Field,
  ButtonItem,
  staticClasses,
  Navigation,
  showModal,
  ModalRoot,
  Focusable,
} from './components/deckyUi';
import { definePlugin, routerHook } from '@decky/api';

const FullDashboardPage: React.FC = () => {
  const syncActive = getActiveApp();
  const [games, setGames] = useState<Game[]>([]);
  const [selectedAppId, setSelectedAppId] = useState<number | 'all'>(() => syncActive?.appid || 'all');
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [ranked, setRanked] = useState<RankedAchievements | null>(null);
  const [currentTheme, setCurrentTheme] = useState<ColorThemeId>('steam_slate');
  const [loading, setLoading] = useState<boolean>(true);

  const loadData = async (targetIdInput?: number | 'all') => {
    try {
      const active = await getActiveAppAsync() || getActiveApp();
      const gameList = await SteamApiService.getGames();

      let targetId: number | null = null;
      if (targetIdInput && targetIdInput !== 'all') {
        targetId = targetIdInput;
      } else if (selectedAppId !== 'all') {
        targetId = selectedAppId;
      } else if (active) {
        targetId = active.appid;
      } else if (gameList.length > 0) {
        targetId = gameList[0].appid;
      }

      if (targetId) {
        const details = await SteamApiService.getGameDetails(targetId);

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
    }
  };

  useEffect(() => {
    loadData(selectedAppId);
  }, [selectedAppId]);

  const handleTogglePin = async (id: string) => {
    await SteamApiService.togglePin(id);
    loadData(selectedAppId);
  };

  const handleUnlock = async (appid: number, id: string) => {
    await SteamApiService.unlockAchievement(appid, id);
    loadData(selectedAppId);
  };

  return (
    <div
      data-theme={currentTheme}
      style={{
        width: '100%',
        minHeight: '100vh',
        backgroundColor: '#0e141d',
        color: '#e2e8f0',
        padding: '24px 32px',
        overflowY: 'auto',
        boxSizing: 'border-box',
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      }}
      className="w-full min-h-screen bg-[var(--bg-primary,#0e141d)] text-[var(--text-main,#e2e8f0)] p-6 overflow-y-auto font-sans"
    >
      <style dangerouslySetInnerHTML={{ __html: typeof cssText === 'string' ? cssText : '' }} />
      <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Sleek Steam Deck Header Bar with Focusable Quick Exit */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-sky-400" />
            <span className="font-extrabold text-base text-slate-100 tracking-tight">Next Unlock</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-800 ml-2">
              Full Dashboard
            </span>
          </div>

          <Focusable
            focusable={true}
            onActivate={() => {
              try {
                Navigation.NavigateBack();
              } catch {
                window.history.back();
              }
            }}
            onClick={() => {
              try {
                Navigation.NavigateBack();
              } catch {
                window.history.back();
              }
            }}
            className="flex items-center gap-2 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-slate-200 hover:text-white rounded-lg border border-slate-700 text-xs font-bold transition-all cursor-pointer shadow-sm focus:ring-2 focus:ring-sky-400 focus:scale-[1.02] focus:outline-none"
          >
            ← Back to Game
          </Focusable>
        </div>

        {selectedGame && ranked ? (
          <FullDashboard
            games={games}
            selectedAppId={selectedAppId}
            selectedGame={selectedGame}
            ranked={ranked}
            onSelectGame={(id) => {
              setSelectedAppId(id);
              if (id !== 'all') loadData(id);
            }}
            onTogglePin={handleTogglePin}
            onUnlockAchievement={handleUnlock}
            currentTheme={currentTheme}
            onThemeChange={setCurrentTheme}
          />
        ) : (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '100px 0' }}>
            <SteamSpinner />
          </div>
        )}
      </div>
    </div>
  );
};

const DeckyContent: React.FC = () => {
  const syncActive = getActiveApp();
  const [games, setGames] = useState<Game[]>([]);
  const [selectedAppId, setSelectedAppId] = useState<number | 'all'>(() => syncActive?.appid || 'all');
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [ranked, setRanked] = useState<RankedAchievements | null>(null);
  const [currentTheme, setCurrentTheme] = useState<ColorThemeId>('steam_slate');
  const [loading, setLoading] = useState<boolean>(true);

  const loadData = async () => {
    try {
      const active = await getActiveAppAsync() || syncActive;
      const gameList = await SteamApiService.getGames();
      
      let targetId: number | null = null;
      if (selectedAppId !== 'all') {
        targetId = selectedAppId;
      } else if (active) {
        targetId = active.appid;
      } else if (gameList.length > 0) {
        targetId = gameList[0].appid;
      }

      if (targetId) {
        const details = await SteamApiService.getGameDetails(targetId);

        const mergedGames = [...gameList];
        const existingIdx = mergedGames.findIndex((g) => g.appid === targetId);
        if (existingIdx >= 0) {
          mergedGames[existingIdx] = { ...mergedGames[existingIdx], ...details.game };
        } else {
          mergedGames.unshift(details.game);
        }
        setGames(mergedGames);

        if (details && details.game && details.game.total_achievements > 0) {
          setSelectedGame(details.game);
          setRanked(details.ranked);
        }
      } else {
        setGames(gameList);
        setSelectedGame(null);
        setRanked(null);
      }
    } catch (err) {
      console.error('[Next Unlock] Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const act = getActiveApp();
    if (act && selectedAppId === 'all') {
      setSelectedAppId(act.appid);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    loadData().finally(() => {
      if (mounted) setLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, [selectedAppId]);

  const handleTogglePin = async (id: string) => {
    await SteamApiService.togglePin(id);
    loadData();
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
  const isRunning = !!(activeApp && selectedGame && activeApp.appid === selectedGame.appid);

  if (loading && !selectedGame) {
    return (
      <div data-theme={currentTheme} className="w-full">
        <style dangerouslySetInnerHTML={{ __html: typeof cssText === 'string' ? cssText : '' }} />
        <PanelSection title="Next Unlock">
          <PanelSectionRow>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 0', width: '100%', gap: '8px' }}>
              <SteamSpinner />
              <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>Scanning active game achievements...</span>
            </div>
          </PanelSectionRow>
        </PanelSection>
      </div>
    );
  }

  return (
    <div data-theme={currentTheme} className="w-full">
      <style dangerouslySetInnerHTML={{ __html: typeof cssText === 'string' ? cssText : '' }} />
      <QuickAccessMenu
        game={selectedGame}
        ranked={ranked}
        games={games}
        isRunningGame={isRunning}
        onSelectGame={(id) => setSelectedAppId(id)}
        onTogglePin={handleTogglePin}
        onOpenFullDashboard={handleOpenFullDashboard}
        onRefresh={loadData}
      />
    </div>
  );
};

// Decky Loader Plugin Default Export matching official template
export default definePlugin(() => {
  try {
    routerHook?.addRoute?.('/next-unlock', FullDashboardPage, { exact: true });
  } catch (e) {
    console.warn('[Next Unlock] routerHook addRoute error:', e);
  }

  return {
    name: 'Next Unlock',
    title: <div className={staticClasses?.Title || 'font-bold text-sm'}>Next Unlock</div>,
    titleView: <div className={staticClasses?.Title || 'font-bold text-sm'}>Next Unlock</div>,
    content: (
      <ErrorBoundary>
        <DeckyContent />
      </ErrorBoundary>
    ),
    icon: <FaTrophy />,
    onDismount() {
      try {
        routerHook?.removeRoute?.('/next-unlock');
      } catch {}
    },
  };
});
