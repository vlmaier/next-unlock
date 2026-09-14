import React, { useState, useEffect } from 'react';
import { Trophy } from 'lucide-react';
import { FaTrophy } from 'react-icons/fa';
import { SteamApiService } from './services/steamApi';
import { Game, RankedAchievements, ColorThemeId } from './types/achievement';
import { FullDashboard } from './components/FullDashboard';
import { QuickAccessMenu } from './components/QuickAccessMenu';
import './index.css';

export const DeckyContent: React.FC<{ isQAM?: boolean; serverApi?: any }> = ({ isQAM = false, serverApi }) => {
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

// Decky Loader Plugin Contract Function
export const definePlugin = (serverApi?: any) => {
  return {
    title: <div className="font-bold text-sm flex items-center gap-2">Next Unlock</div>,
    content: <DeckyContent isQAM={true} serverApi={serverApi} />,
    icon: <FaTrophy />,
    onDismount() {},
  };
};

export default definePlugin;
