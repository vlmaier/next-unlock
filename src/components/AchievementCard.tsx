import React, { useState } from 'react';
import { Achievement } from '../types/achievement';
import { AchievementIcon } from './AchievementIcon';
import { Pin, CheckCircle2, Eye } from 'lucide-react';
import { Focusable } from './deckyUi';

interface AchievementCardProps {
  achievement: Achievement & { gameName?: string; appid?: number };
  onTogglePin: (id: string) => void;
}

export const AchievementCard: React.FC<AchievementCardProps> = ({
  achievement,
  onTogglePin,
}) => {
  const [revealHidden, setRevealHidden] = useState(false);

  const pct = Math.round((achievement.global_percentage || 0) * 10) / 10;
  const getRarityBadge = () => {
    if (pct <= 5.0) {
      return {
        label: `${pct}% Ultra Rare`,
        badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
      };
    }
    if (pct <= 15.0) {
      return {
        label: `${pct}% Rare`,
        badgeClass: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
      };
    }
    if (pct >= 25.0) {
      return {
        label: `${pct}% Easy Grab`,
        badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
      };
    }
    return {
      label: `${pct}% Common`,
      badgeClass: 'bg-[#161f2c] text-slate-300 border-[#2e3d52]',
    };
  };

  const rarity = getRarityBadge();
  const hasProgress = Boolean(
    !achievement.unlocked &&
      achievement.progress &&
      achievement.progress.max > 1
  );
  const progressRatio = hasProgress
    ? Math.min(100, Math.max(0, (achievement.progress!.current / achievement.progress!.max) * 100))
    : 0;

  const isMaskedSecret = Boolean(achievement.hidden && !achievement.unlocked && !revealHidden);

  const handleCardActivate = () => {
    if (!achievement.unlocked) {
      onTogglePin(achievement.id);
    }
  };

  return (
    <Focusable
      focusable={true}
      onActivate={handleCardActivate}
      onClick={handleCardActivate}
      data-testid={`achievement-card-${achievement.id}`}
      className={`next-card p-3.5 flex flex-col justify-between gap-3 relative focus:ring-2 focus:ring-[#389fff] focus:outline-none ${
        achievement.is_pinned
          ? 'border-[#eab308]/80 bg-[#1e293b]'
          : achievement.unlocked
          ? 'border-[#10b981]/30 bg-[#182232]/90 opacity-90'
          : ''
      }`}
    >
      {/* Top Row: Icon + Title + Badges + Pin Status */}
      <div className="flex items-start gap-3">
        <AchievementIcon
          src={achievement.icon}
          name={achievement.name}
          unlocked={achievement.unlocked}
          rarityTier={achievement.rarity_tier}
          size="md"
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              {achievement.gameName && (
                <div className="text-[10px] font-bold text-[#389fff] uppercase tracking-wider truncate mb-0.5">
                  {achievement.gameName}
                </div>
              )}
              <h4 className="text-sm font-bold text-slate-100 leading-snug truncate">
                {isMaskedSecret ? 'Secret Achievement' : achievement.name}
              </h4>
            </div>

            {!achievement.unlocked ? (
              <span
                title={achievement.is_pinned ? 'Click or press A to unpin' : 'Click or press A to pin to Quick Access'}
                className={`px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 border flex-shrink-0 transition-colors ${
                  achievement.is_pinned
                    ? 'bg-[#eab308] text-[#0e141b] border-[#eab308]'
                    : 'bg-[#161f2c] text-slate-300 border-[#2e3d52] hover:border-[#389fff]'
                }`}
              >
                <Pin className={`w-3 h-3 ${achievement.is_pinned ? 'fill-current' : ''}`} />
                <span>{achievement.is_pinned ? 'Pinned' : 'Pin'}</span>
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex-shrink-0">
                <CheckCircle2 className="w-3 h-3" />
                <span>Unlocked</span>
              </span>
            )}
          </div>

          {/* Badges Row */}
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${rarity.badgeClass}`}>
              {rarity.label}
            </span>
            {achievement.set_name && (achievement.dlc_appid || achievement.set_name !== 'Base Game') && (
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold ${
                  achievement.dlc_appid
                    ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                    : 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                }`}
              >
                {achievement.dlc_appid ? `DLC · ${achievement.set_name}` : achievement.set_name}
              </span>
            )}
            {achievement.archived && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-400 border border-slate-600/50 font-semibold">
                Archived
              </span>
            )}
            {achievement.hidden && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-medium">
                Secret
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Description Row */}
      <div className="text-xs text-slate-300/90 leading-relaxed min-h-[2.25rem] flex items-center justify-between gap-2">
        {isMaskedSecret ? (
          <div className="flex items-center justify-between w-full gap-2">
            <span className="text-slate-400 italic text-[11px]">
              Hidden objective — reveal to view details.
            </span>
            {achievement.description && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setRevealHidden(true);
                }}
                className="px-2 py-0.5 rounded bg-[#161f2c] hover:bg-[#263449] text-[#389fff] border border-[#2e3d52] text-[10px] font-bold flex items-center gap-1 flex-shrink-0"
              >
                <Eye className="w-3 h-3" /> Reveal
              </button>
            )}
          </div>
        ) : (
          <p className="line-clamp-2 text-xs text-slate-300">
            {achievement.description || `Unlocked by ${pct}% of players on Steam.`}
          </p>
        )}
      </div>

      {/* Progress Bar (Only shown when multi-step progress is tracked) */}
      {hasProgress && (
        <div className="flex flex-col gap-1 pt-1 border-t border-[#2e3d52]/60">
          <div className="flex items-center justify-between text-[11px] font-semibold">
            <span className="text-slate-300">Progress</span>
            <span className="text-[#389fff] font-bold">
              {achievement.progress!.current} / {achievement.progress!.max} ({Math.round(progressRatio)}%)
            </span>
          </div>
          <div className="w-full bg-[#0e141b] rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-[#389fff] h-full rounded-full transition-all duration-300"
              style={{ width: `${progressRatio}%` }}
            />
          </div>
        </div>
      )}
    </Focusable>
  );
};
