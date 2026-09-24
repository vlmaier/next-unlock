import React, { useState } from 'react';
import { Game } from '../types/achievement';
import { Layers, Gamepad2 } from 'lucide-react';
import { Focusable } from './deckyUi';
import { getGameHeaderUrl } from '../services/steamApi';

interface GameSelectorProps {
  games: Game[];
  selectedAppId: number | 'all';
  onSelectGame: (appid: number | 'all') => void;
}

export const GameSelector: React.FC<GameSelectorProps> = ({
  games,
  selectedAppId,
  onSelectGame,
}) => {
  const [failedImages, setFailedImages] = useState<Record<number, boolean>>({});
  const isAllSelected = selectedAppId === 'all';

  return (
    <Focusable flow-children="row" className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar w-full">
      {/* "All Games Overview" Tab Button */}
      <Focusable
        focusable={true}
        onActivate={() => onSelectGame('all')}
        onClick={() => onSelectGame('all')}
        className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all border cursor-pointer focus:ring-2 focus:ring-[var(--focus-ring)] focus:scale-[1.02] focus:outline-none ${
          isAllSelected
            ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)] shadow-sm'
            : 'bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--border-color)] hover:text-[var(--text-main)] hover:border-[var(--text-muted)]'
        }`}
      >
        <Layers className="w-4 h-4 flex-shrink-0" />
        <span>All Games Overview</span>
      </Focusable>

      {/* Individual Game Pills */}
      {games.map((game) => {
        const isSelected = selectedAppId === game.appid;
        const isFailed = failedImages[game.appid];
        const imgSrc = game.header_image || getGameHeaderUrl(game.appid);

        return (
          <Focusable
            key={game.appid}
            focusable={true}
            onActivate={() => onSelectGame(game.appid)}
            onClick={() => onSelectGame(game.appid)}
            className={`flex items-center gap-2.5 px-3.5 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all border cursor-pointer focus:ring-2 focus:ring-[var(--focus-ring)] focus:scale-[1.02] focus:outline-none ${
              isSelected
                ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)] shadow-sm'
                : 'bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--border-color)] hover:text-[var(--text-main)] hover:border-[var(--text-muted)]'
            }`}
          >
            {!isFailed && imgSrc ? (
              <img
                src={imgSrc}
                alt={game.name}
                onError={() => setFailedImages((prev) => ({ ...prev, [game.appid]: true }))}
                className="w-5 h-5 rounded object-cover border border-slate-700/60 flex-shrink-0"
              />
            ) : (
              <Gamepad2 className="w-4 h-4 flex-shrink-0" />
            )}
            <span>{game.name}</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                isSelected
                  ? 'bg-white/25 text-white'
                  : 'bg-[var(--bg-card)] text-[var(--text-muted)] border border-[var(--border-color)]'
              }`}
            >
              {Math.round(game.completion_percentage)}%
            </span>
          </Focusable>
        );
      })}
    </Focusable>
  );
};
