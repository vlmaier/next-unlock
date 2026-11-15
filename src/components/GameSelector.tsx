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
  const [failedUrls, setFailedUrls] = useState<Record<string, boolean>>({});
  const isAllSelected = selectedAppId === 'all';

  return (
    <Focusable flow-children="row" className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar w-full">
      {/* "All Games Overview" Tab Button */}
      <Focusable
        focusable={true}
        onActivate={() => onSelectGame('all')}
        onClick={() => onSelectGame('all')}
        data-testid="game-pill-all"
        className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all border cursor-pointer focus:outline-none ${
          isAllSelected
            ? 'bg-[#389fff] text-white border-[#389fff] shadow-sm'
            : 'bg-[#161f2c] text-slate-300 border-[#2e3d52] hover:text-white hover:bg-[#1e293b]'
        }`}
      >
        <Layers className="w-4 h-4 flex-shrink-0" />
        <span>All Games ({games.length})</span>
      </Focusable>

      {/* Individual Game Pills */}
      {games.map((game) => {
        const isSelected = selectedAppId === game.appid;
        const imgSrc = game.header_image || getGameHeaderUrl(game.appid);
        const isFailed = imgSrc ? Boolean(failedUrls[imgSrc]) : true;

        return (
          <Focusable
            key={game.appid}
            focusable={true}
            onActivate={() => onSelectGame(game.appid)}
            onClick={() => onSelectGame(game.appid)}
            data-testid={`game-pill-${game.appid}`}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all border cursor-pointer focus:outline-none ${
              isSelected
                ? 'bg-[#389fff] text-white border-[#389fff] shadow-sm'
                : 'bg-[#161f2c] text-slate-300 border-[#2e3d52] hover:text-white hover:bg-[#1e293b]'
            }`}
          >
            {!isFailed && imgSrc ? (
              <img
                src={imgSrc}
                alt=""
                onError={() => setFailedUrls((prev) => ({ ...prev, [imgSrc]: true }))}
                style={{ width: 38, height: 18 }}
                className="rounded object-cover border border-slate-700/60 flex-shrink-0"
              />
            ) : (
              <Gamepad2 className="w-4 h-4 flex-shrink-0" />
            )}
            <span>{game.name}</span>
            {game.total_achievements > 0 && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                  isSelected
                    ? 'bg-black/25 text-white'
                    : 'bg-[#0e141b] text-slate-400 border border-[#2e3d52]'
                }`}
              >
                {Math.round(game.completion_percentage)}%
              </span>
            )}
          </Focusable>
        );
      })}
    </Focusable>
  );
};
