import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { SteamApiService } from './services/steamApi';
import { Game, RankedAchievements, ColorThemeId } from './types/achievement';
import { FullDashboard } from './components/FullDashboard';
import { QuickAccessMenu } from './components/QuickAccessMenu';
import { Monitor, Smartphone, Sparkles, RefreshCw } from 'lucide-react';
import './index.css';

const HarnessApp: React.FC = () => {
  const [games, setGames] = useState<Game[]>([]);
  const [selectedAppId, setSelectedAppId] = useState<number | 'all'>(1245620);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [ranked, setRanked] = useState<RankedAchievements | null>(null);
  const [currentTheme, setCurrentTheme] = useState<ColorThemeId>('steam_slate');
  const [viewMode, setViewMode] = useState<'dashboard' | 'qam'>('dashboard');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', currentTheme);
    document.body.setAttribute('data-theme', currentTheme);
  }, [currentTheme]);

  const loadData = async (appid: number | 'all' = selectedAppId) => {
    const gameList = await SteamApiService.getGames();
    setGames(gameList);

    const activeId = appid === 'all' ? gameList[0].appid : appid;
    const details = await SteamApiService.getGameDetails(activeId);
    setSelectedGame(details.game);
    setRanked(details.ranked);
  };

  useEffect(() => {
    loadData(selectedAppId);
  }, [selectedAppId]);

  const handleTogglePin = async (id: string) => {
    await SteamApiService.togglePin(id);
    await loadData(selectedAppId);
  };

  const handleUnlock = async (appid: number, id: string) => {
    await SteamApiService.unlockAchievement(appid, id);
    await loadData(selectedAppId);
  };

  const handleThemeChange = (theme: ColorThemeId) => {
    setCurrentTheme(theme);
    document.documentElement.setAttribute('data-theme', theme);
    document.body.setAttribute('data-theme', theme);
  };

  if (!selectedGame || !ranked) {
    return (
      <div className="flex items-center justify-center min-h-screen text-xs text-slate-400">
        Loading Desktop Test Harness...
      </div>
    );
  }

  return (
    <div data-theme={currentTheme} className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-main)] font-sans flex flex-col transition-colors duration-200">
      {/* Top Test Harness Control Toolbar */}
      <header className="bg-slate-900/90 border-b border-slate-800 px-4 py-2.5 flex items-center justify-between text-xs sticky top-0 z-50 backdrop-blur-md">
        <div className="flex items-center gap-2 font-bold text-slate-200">
          <Sparkles className="w-4 h-4 text-sky-400" />
          <span>Next Unlock - Zero-Launch Sandbox</span>
          <span className="bg-sky-950 text-sky-300 px-2 py-0.5 rounded text-[10px] font-semibold border border-sky-800">
            Desktop Dev Mode
          </span>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('dashboard')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors border ${
              viewMode === 'dashboard'
                ? 'bg-sky-600 text-white border-sky-500 font-medium'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" /> Full Dashboard
          </button>
          <button
            onClick={() => setViewMode('qam')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors border ${
              viewMode === 'qam'
                ? 'bg-sky-600 text-white border-sky-500 font-medium'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" /> Steam Deck QAM Panel
          </button>

          <button
            onClick={() => loadData(selectedAppId)}
            title="Reload mock state"
            className="p-1 text-slate-400 hover:text-slate-200 bg-slate-800 border border-slate-700 rounded ml-2"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-4 md:p-6 flex items-start justify-center">
        {viewMode === 'dashboard' ? (
          <FullDashboard
            games={games}
            selectedAppId={selectedAppId}
            selectedGame={selectedGame}
            ranked={ranked}
            onSelectGame={(id) => setSelectedAppId(id)}
            onTogglePin={handleTogglePin}
            onUnlockAchievement={handleUnlock}
            currentTheme={currentTheme}
            onThemeChange={handleThemeChange}
          />
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="text-xs text-slate-400 flex items-center gap-1">
              <Smartphone className="w-4 h-4 text-sky-400" /> Simulating Steam Deck Quick Access Drawer Overlay (320px width)
            </div>
            <QuickAccessMenu
              game={selectedGame}
              ranked={ranked}
              onTogglePin={handleTogglePin}
              onOpenFullDashboard={() => setViewMode('dashboard')}
            />
          </div>
        )}
      </main>
    </div>
  );
};

const rootEl = document.getElementById('root');
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <HarnessApp />
    </React.StrictMode>
  );
}
