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
} from '@decky/ui';
import { definePlugin } from '@decky/api';

const DeckyContent: React.FC<{ isQAM?: boolean }> = ({ isQAM = false }) => {
  const [games, setGames] = useState<Game[]>([]);
  const [selectedAppId, setSelectedAppId] = useState<number | 'all'>('all');
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [ranked, setRanked] = useState<RankedAchievements | null>(null);
  const [currentTheme, setCurrentTheme] = useState<ColorThemeId>('steam_slate');
  const [loading, setLoading] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<'qam' | 'full'>('qam');

  const loadData = async () => {
    try {
      const syncActive = getActiveApp();
      if (syncActive) {
        setSelectedGame((prev) => prev && prev.appid === syncActive.appid ? prev : {
          appid: syncActive.appid,
          name: syncActive.name,
          header_image: `https://cdn.cloudflare.steamstatic.com/steam/apps/${syncActive.appid}/header.jpg`,
          total_achievements: 0,
          unlocked_count: 0,
          completion_percentage: 0,
          achievements: [],
        });
      }

      const active = await getActiveAppAsync() || syncActive;
      const gameList = await SteamApiService.getGames();
      
      const mergedGames = [...gameList];
      if (active && !mergedGames.some((g) => g.appid === active.appid)) {
        mergedGames.unshift({
          appid: active.appid,
          name: active.name,
          header_image: `https://cdn.cloudflare.steamstatic.com/steam/apps/${active.appid}/header.jpg`,
          total_achievements: 0,
          unlocked_count: 0,
          completion_percentage: 0,
          achievements: [],
        });
      }
      setGames(mergedGames);

      let targetId: number | null = null;
      if (selectedAppId !== 'all') {
        targetId = selectedAppId;
      } else if (active) {
        targetId = active.appid;
      } else if (mergedGames.length > 0) {
        targetId = mergedGames[0].appid;
      }

      if (targetId) {
        const details = await SteamApiService.getGameDetails(targetId);
        if (details && details.game) {
          setSelectedGame(details.game);
          setRanked(details.ranked);
        }
      } else {
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
    let mounted = true;
    const safetyTimer = setTimeout(() => {
      if (mounted) setLoading(false);
    }, 1500);

    loadData().finally(() => {
      if (mounted) setLoading(false);
    });

    return () => {
      mounted = false;
      clearTimeout(safetyTimer);
    };
  }, [selectedAppId]);

  const handleTogglePin = async (id: string) => {
    await SteamApiService.togglePin(id);
    loadData();
  };

  const handleUnlock = async (appid: number, id: string) => {
    await SteamApiService.unlockAchievement(appid, id);
    loadData();
  };

  const activeApp = getActiveApp();
  const isRunning = !!(activeApp && selectedGame && activeApp.appid === selectedGame.appid);

  if (loading && !selectedGame) {
    return (
      <PanelSection>
        <PanelSectionRow>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '24px 0', width: '100%' }}>
            <SteamSpinner />
          </div>
        </PanelSectionRow>
      </PanelSection>
    );
  }

  // Fullscreen Dashboard view requested
  if (viewMode === 'full' && selectedGame) {
    return (
      <div data-theme={currentTheme} className="w-full">
        <PanelSection>
          <PanelSectionRow>
            <ButtonItem layout="below" onClick={() => setViewMode('qam')}>
              ← Back to Quick View
            </ButtonItem>
          </PanelSectionRow>
        </PanelSection>
        {ranked ? (
          <FullDashboard
            games={games}
            selectedAppId={selectedAppId}
            selectedGame={selectedGame}
            ranked={ranked}
            onSelectGame={(id) => setSelectedAppId(id)}
            onTogglePin={handleTogglePin}
            onUnlockAchievement={handleUnlock}
            currentTheme={currentTheme}
            onThemeChange={setCurrentTheme}
          />
        ) : (
          <PanelSection>
            <PanelSectionRow>
              <Field label="Loading Dashboard" description="Scanning achievements..." />
            </PanelSectionRow>
          </PanelSection>
        )}
      </div>
    );
  }

  return (
    <div data-theme={currentTheme} className="w-full">
      <QuickAccessMenu
        game={selectedGame}
        ranked={ranked}
        games={games}
        isRunningGame={isRunning}
        onSelectGame={(id) => setSelectedAppId(id)}
        onTogglePin={handleTogglePin}
        onOpenFullDashboard={() => setViewMode('full')}
        onRefresh={loadData}
      />
    </div>
  );
};

// Decky Loader Plugin Default Export matching official template
export default definePlugin(() => {
  return {
    name: 'Next Unlock',
    title: <div className={staticClasses?.Title || 'font-bold text-sm'}>Next Unlock</div>,
    titleView: <div className={staticClasses?.Title || 'font-bold text-sm'}>Next Unlock</div>,
    content: (
      <ErrorBoundary>
        <DeckyContent isQAM={true} />
      </ErrorBoundary>
    ),
    icon: <FaTrophy />,
    onDismount() {},
  };
});
