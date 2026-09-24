import React from 'react';
import { Game, RankedAchievements } from '../types/achievement';
import { ProgressRing } from './ProgressRing';
import { AchievementIcon } from './AchievementIcon';
import { Sparkles, Pin, Trophy, Gamepad2, ChevronDown } from 'lucide-react';

interface QuickAccessMenuProps {
  game: Game;
  ranked: RankedAchievements;
  games?: Game[];
  isRunningGame?: boolean;
  onSelectGame?: (appid: number) => void;
  onTogglePin: (id: string) => void;
  onOpenFullDashboard?: () => void;
}

export const QuickAccessMenu: React.FC<QuickAccessMenuProps> = ({
  game,
  ranked,
  games = [],
  isRunningGame = false,
  onSelectGame,
  onTogglePin,
  onOpenFullDashboard,
}) => {
  const topUpNext = ranked.up_next.slice(0, 3);
  const pinnedList = ranked.pinned;
  const hasAchievements = game.total_achievements > 0;

  return (
    <div className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl p-3 flex flex-col gap-3 shadow-2xl box-border">
      {/* Game Selector Dropdown if multiple games exist */}
      {games.length > 1 && onSelectGame && (
        <div className="relative" style={{ position: 'relative', width: '100%' }}>
          <select
            value={game.appid}
            onChange={(e) => onSelectGame(Number(e.target.value))}
            style={{
              backgroundColor: 'var(--bg-surface, #181f2a)',
              color: 'var(--text-main, #e2e8f0)',
              border: '1px solid var(--border-color, #344359)',
              borderRadius: '8px',
              padding: '6px 28px 6px 10px',
              width: '100%',
              fontSize: '12px',
              fontWeight: 600,
              appearance: 'none',
              WebkitAppearance: 'none',
              outline: 'none',
            }}
            className="w-full bg-[var(--bg-surface)] text-[var(--text-main)] text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-[var(--border-color)] focus:outline-none focus:border-[var(--accent-primary)] appearance-none cursor-pointer pr-7"
          >
            {games.map((g) => (
              <option key={g.appid} value={g.appid} style={{ background: '#181f2a', color: '#e2e8f0' }}>
                {g.name}
              </option>
            ))}
          </select>
          <ChevronDown
            className="w-3.5 h-3.5 text-[var(--text-muted)] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', width: 14, height: 14 }}
          />
        </div>
      )}

      {/* Header Game Snapshot */}
      <div
        className="flex items-center justify-between gap-2.5 bg-[var(--bg-surface)] p-2.5 rounded-lg border border-[var(--border-color)]"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px', borderRadius: '8px', background: 'var(--bg-surface, #181f2a)', border: '1px solid var(--border-color, #344359)' }}
      >
        <div className="flex items-center gap-2.5 min-w-0" style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
          <div
            className="w-11 h-11 rounded-lg bg-slate-800 border border-slate-700/80 flex items-center justify-center font-bold text-slate-300 text-xs overflow-hidden flex-shrink-0 shadow-sm"
            style={{ width: 44, height: 44, minWidth: 44, maxWidth: 44, minHeight: 44, maxHeight: 44, overflow: 'hidden', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >
            {game.header_image ? (
              <img
                src={game.header_image}
                alt={game.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                className="w-full h-full object-cover rounded-lg"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            ) : (
              <Gamepad2 className="w-5 h-5 text-[var(--text-muted)]" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs font-bold text-[var(--text-main)] truncate">{game.name}</h3>
              {isRunningGame && (
                <span className="flex-shrink-0 px-1.5 py-0.2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] font-semibold rounded-full">
                  Playing
                </span>
              )}
            </div>
            <p className="text-[10px] text-[var(--text-muted)] flex items-center gap-1 mt-0.5 font-medium">
              <Trophy className="w-3 h-3 text-[var(--accent-gold)] flex-shrink-0" />
              <span>
                {hasAchievements
                  ? `${game.unlocked_count} / ${game.total_achievements} Unlocked`
                  : 'Scanning achievements...'}
              </span>
            </p>
          </div>
        </div>

        {/* Progress Ring with proper scaled sizing */}
        {hasAchievements ? (
          <ProgressRing
            percentage={game.completion_percentage}
            unlockedCount={game.unlocked_count}
            totalCount={game.total_achievements}
            size={52}
            strokeWidth={5}
          />
        ) : (
          <div className="w-12 h-12 flex items-center justify-center text-[var(--text-muted)] opacity-50">
            <Trophy className="w-6 h-6" />
          </div>
        )}
      </div>

      {!hasAchievements && (
        <div className="bg-[var(--bg-surface)] p-3 rounded-lg border border-[var(--border-color)] text-center flex flex-col items-center gap-1.5 my-1">
          <Gamepad2 className="w-6 h-6 text-slate-500 opacity-60" />
          <span className="text-[11px] font-semibold text-[var(--text-main)]">No Achievements Recorded</span>
          <span className="text-[9px] text-[var(--text-muted)] leading-tight">
            Launch a game on Steam or select an installed title to view your achievement tracker.
          </span>
        </div>
      )}

      {/* Pinned Achievements Section */}
      {hasAchievements && pinnedList.length > 0 && (
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
      {hasAchievements && topUpNext.length > 0 && (
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
                  <span className="text-[9px] font-bold text-[var(--accent-primary)] flex-shrink-0">
                    {ach.global_percentage}%
                  </span>
                </div>
                {ach.progress && ach.progress.max > 1 ? (
                  <div className="w-full bg-[var(--bg-surface)] h-1.5 rounded-full overflow-hidden mt-1 border border-slate-700/50">
                    <div
                      className="bg-[var(--accent-primary)] h-full rounded-full"
                      style={{ width: `${(ach.progress.current / ach.progress.max) * 100}%` }}
                    />
                  </div>
                ) : (
                  <span className="text-[9px] text-[var(--text-muted)] block truncate mt-0.5">
                    {ach.hint || ach.description}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {onOpenFullDashboard && (
        <button
          onClick={onOpenFullDashboard}
          className="w-full mt-1 py-1.5 bg-[var(--bg-surface)] hover:bg-[var(--bg-card-hover)] text-[var(--text-main)] border border-[var(--border-color)] rounded-lg text-xs font-bold text-center transition-colors shadow-sm cursor-pointer"
        >
          Open Full Dashboard
        </button>
      )}
    </div>
  );
};
