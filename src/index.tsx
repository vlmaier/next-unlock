import React, { useState, useEffect, Component, ErrorInfo, ReactNode } from 'react';
import { Trophy, AlertTriangle } from 'lucide-react';
import { FaTrophy } from 'react-icons/fa';
import { SteamApiService } from './services/steamApi';
import { Game, RankedAchievements, ColorThemeId } from './types/achievement';
import { FullDashboard } from './components/FullDashboard';
import { QuickAccessMenu } from './components/QuickAccessMenu';
import './index.css';

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

const DeckyContent: React.FC<{ isQAM?: boolean; serverApi?: any }> = ({ isQAM = false, serverApi }) => {
  const [games, setGames] = useState<Game[]>([]);
  const [selectedAppId, setSelectedAppId] = useState<number | 'all'>('all');
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [ranked, setRanked] = useState<RankedAchievements | null>(null);
  const [currentTheme, setCurrentTheme] = useState<ColorThemeId>('steam_slate');

  const loadData = async () => {
    try {
      const gameList = await SteamApiService.getGames();
      setGames(gameList);

      const activeId = selectedAppId === 'all' ? (gameList[0]?.appid || 1245620) : selectedAppId;
      const details = await SteamApiService.getGameDetails(activeId);
      setSelectedGame(details.game);
      setRanked(details.ranked);
    } catch (err) {
      console.error('[Next Unlock] Error loading data:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedAppId]);

  const handleTogglePin = async (id: string) => {
    await SteamApiService.togglePin(id);
    loadData();
  };

  const handleUnlock = async (appid: number, id: string) => {
    await SteamApiService.unlockAchievement(appid, id);
    loadData();
  };

  if (!selectedGame || !ranked) {
    return (
      <div className="p-4 text-xs text-slate-400 flex items-center gap-2">
        <Trophy className="w-4 h-4 animate-spin text-[var(--accent-gold)]" />
        <span>Loading Next Unlock...</span>
      </div>
    );
  }

  return (
    <div data-theme={currentTheme} className="w-full min-h-screen bg-[var(--bg-primary)] text-[var(--text-main)] font-sans">
      {isQAM ? (
        <QuickAccessMenu
          game={selectedGame}
          ranked={ranked}
          onTogglePin={handleTogglePin}
        />
      ) : (
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
      )}
    </div>
  );
};

// Decky Loader Plugin Default Export
export default function definePlugin(serverApi?: any) {
  return {
    title: <div className="font-bold text-sm flex items-center gap-2">Next Unlock</div>,
    content: (
      <ErrorBoundary>
        <DeckyContent isQAM={true} serverApi={serverApi} />
      </ErrorBoundary>
    ),
    icon: <FaTrophy />,
    onDismount() {},
  };
}
