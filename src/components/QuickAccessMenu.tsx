import React from 'react';
import { Game, RankedAchievements } from '../types/achievement';
import { ProgressRing } from './ProgressRing';
import { AchievementIcon } from './AchievementIcon';
import { Sparkles, Pin, Trophy } from 'lucide-react';

interface QuickAccessMenuProps {
  game: Game;
  ranked: RankedAchievements;
  onTogglePin: (id: string) => void;
  onOpenFullDashboard?: () => void;
}

export const QuickAccessMenu: React.FC<QuickAccessMenuProps> = ({
  game,
  ranked,
  onTogglePin,
  onOpenFullDashboard,
}) => {
  const topUpNext = ranked.up_next.slice(0, 3);
  const pinnedList = ranked.pinned;

  return (
    <div className="w-[320px] bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl p-3 flex flex-col gap-3 shadow-2xl">
      {/* Header Game Snapshot */}
      <div className="flex items-center justify-between gap-2.5 bg-[var(--bg-surface)] p-2.5 rounded-lg border border-[var(--border-color)]">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-md bg-slate-800 border border-slate-700 flex items-center justify-center font-black text-slate-300 text-[11px] text-center overflow-hidden flex-shrink-0">
            {game.name.substring(0, 4)}
          </div>
          <div className="min-w-0">
            <h3 className="text-xs font-bold text-[var(--text-main)] truncate">{game.name}</h3>
            <p className="text-[10px] text-[var(--text-muted)] flex items-center gap-1 mt-0.5 font-medium">
              <Trophy className="w-3 h-3 text-[var(--accent-gold)] flex-shrink-0" />
              <span>{game.unlocked_count} / {game.total_achievements} Unlocked</span>
            </p>
          </div>
        </div>

        {/* Progress Ring with proper scaled sizing */}
        <ProgressRing
          percentage={game.completion_percentage}
          unlockedCount={game.unlocked_count}
          totalCount={game.total_achievements}
          size={52}
          strokeWidth={5}
        />
      </div>

      {/* Pinned Achievements Section */}
      {pinnedList.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1 text-[10px] font-bold text-[var(--accent-gold)] uppercase tracking-wider">
            <Pin className="w-3 h-3 fill-current" /> Pinned ({pinnedList.length})
          </div>
          {pinnedList.map((ach) => (
            <div
              key={ach.id}
              className="bg-[var(--bg-card)] border border-[var(--border-color)] p-2 rounded-lg flex items-center gap-2"
            >
              <AchievementIcon
                src={ach.icon}
                name={ach.name}
                unlocked={ach.unlocked}
                rarityTier={ach.rarity_tier}
                size="sm"
              />
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-bold text-[var(--text-main)] truncate">{ach.name}</div>
                <div className="text-[9px] text-[var(--text-muted)] truncate">{ach.hint || ach.description}</div>
              </div>
              <button
                onClick={() => onTogglePin(ach.id)}
                className="text-[var(--accent-gold)] p-1 hover:opacity-80 flex-shrink-0"
              >
                <Pin className="w-3.5 h-3.5 fill-current" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Up Next Recommendations */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-1 text-[10px] font-bold text-[var(--accent-primary)] uppercase tracking-wider">
          <Sparkles className="w-3 h-3" /> Up Next Recommendations
        </div>
        {topUpNext.map((ach) => (
          <div
            key={ach.id}
            className="bg-[var(--bg-card)] border border-[var(--border-color)] p-2 rounded-lg flex items-center gap-2 hover:bg-[var(--bg-card-hover)] transition-colors"
          >
            <AchievementIcon
              src={ach.icon}
              name={ach.name}
              unlocked={ach.unlocked}
              rarityTier={ach.rarity_tier}
              size="sm"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[11px] font-bold text-[var(--text-main)] truncate">{ach.name}</span>
                <span className="text-[9px] font-bold text-[var(--accent-primary)] flex-shrink-0">{ach.global_percentage}%</span>
              </div>
              {ach.progress && ach.progress.max > 1 ? (
                <div className="w-full bg-[var(--bg-surface)] h-1.5 rounded-full overflow-hidden mt-1 border border-slate-700/50">
                  <div
                    className="bg-[var(--accent-primary)] h-full rounded-full"
                    style={{ width: `${(ach.progress.current / ach.progress.max) * 100}%` }}
                  />
                </div>
              ) : (
                <span className="text-[9px] text-[var(--text-muted)] block truncate mt-0.5">{ach.hint || ach.description}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {onOpenFullDashboard && (
        <button
          onClick={onOpenFullDashboard}
          className="w-full mt-1 py-1.5 bg-[var(--bg-surface)] hover:bg-[var(--bg-card-hover)] text-[var(--text-main)] border border-[var(--border-color)] rounded-lg text-xs font-bold text-center transition-colors shadow-sm"
        >
          Open Full Dashboard
        </button>
      )}
    </div>
  );
};
