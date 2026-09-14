import React, { useState, useEffect } from 'react';
import { SteamApiService } from './services/steamApi';
import { Game, RankedAchievements, ColorThemeId } from './types/achievement';
import { FullDashboard } from './components/FullDashboard';
import { QuickAccessMenu } from './components/QuickAccessMenu';
import './index.css';

export const DeckyContent: React.FC<{ isQAM?: boolean }> = ({ isQAM = false }) => {
  const [games, setGames] = useState<Game[]>([]);
  const [selectedAppId, setSelectedAppId] = useState<number | 'all'>(1245620);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [ranked, setRanked] = useState<RankedAchievements | null>(null);
  const [currentTheme, setCurrentTheme] = useState<ColorThemeId>('steam_slate');

  const loadData = async () => {
    const gameList = await SteamApiService.getGames();
    setGames(gameList);

    const activeId = selectedAppId === 'all' ? gameList[0].appid : selectedAppId;
    const details = await SteamApiService.getGameDetails(activeId);
    setSelectedGame(details.game);
    setRanked(details.ranked);
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
    return <div className="p-4 text-xs text-slate-400">Loading Next Unlock...</div>;
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

export default DeckyContent;
