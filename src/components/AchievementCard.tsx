import React, { useState } from 'react';
import { Achievement } from '../types/achievement';
import { AchievementIcon } from './AchievementIcon';
import { Pin, Info, Clock, CheckCircle2, Sparkles, ChevronDown, ChevronUp, Lightbulb } from 'lucide-react';

interface AchievementCardProps {
  achievement: Achievement;
  onTogglePin: (id: string) => void;
  onUnlock?: (id: string) => void;
  showUnlockButton?: boolean;
}

export const AchievementCard: React.FC<AchievementCardProps> = ({
  achievement,
  onTogglePin,
  onUnlock,
  showUnlockButton = false,
}) => {
  const [showHint, setShowHint] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);

  const handleUnlockClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onUnlock && !achievement.unlocked) {
      setIsUnlocking(true);
      onUnlock(achievement.id);
      setTimeout(() => setIsUnlocking(false), 500);
    }
  };

  const handlePinClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onTogglePin(achievement.id);
  };

  // Subtle, Elegant Rarity Badge Styling (No loud backgrounds or harsh borders)
  const getRarityBadge = () => {
    const pct = achievement.global_percentage;
    if (pct <= 5.0) {
      return {
        label: `${pct}% Ultra Rare`,
        badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/30 font-semibold',
      };
    }
    if (pct <= 15.0) {
      return {
        label: `${pct}% Rare`,
        badgeClass: 'bg-sky-500/10 text-sky-400 border-sky-500/30 font-semibold',
      };
    }
    return {
      label: `${pct}% Common`,
      badgeClass: 'bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--border-color)] font-medium',
    };
  };

  const rarity = getRarityBadge();
  const progressRatio = achievement.progress
    ? (achievement.progress.current / achievement.progress.max) * 100
    : 0;

  return (
    <div
      className={`next-card p-4 flex flex-col justify-between h-[195px] relative transition-all duration-200 ${
        achievement.is_pinned
          ? 'border-[var(--accent-gold)] bg-[var(--bg-card)]'
          : achievement.unlocked
          ? 'border-[var(--border-color)] bg-[var(--bg-card)]'
          : 'hover:border-[var(--text-muted)]'
      } ${isUnlocking ? 'ring-2 ring-[var(--accent-emerald)] scale-[1.01]' : ''}`}
    >
      {/* Top Header Row & Fixed Description Box */}
      <div className="flex flex-col gap-2">
        <div className="flex items-start gap-3.5">
          <AchievementIcon
            src={achievement.icon}
            name={achievement.name}
            unlocked={achievement.unlocked}
            rarityTier={achievement.rarity_tier}
            size="md"
          />

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="text-sm font-bold text-[var(--text-main)] tracking-tight leading-snug truncate">
                  {achievement.hidden && !achievement.unlocked ? 'Secret Achievement' : achievement.name}
                </h4>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className={`text-[10px] px-2 py-0.5 rounded-md border ${rarity.badgeClass}`}>
                    {rarity.label}
                  </span>
                  {achievement.is_pinned && (
                    <span className="text-[9px] px-1.5 py-0.2 bg-[var(--accent-gold)] text-[var(--bg-primary)] font-bold rounded uppercase tracking-wider">
                      Pinned
                    </span>
                  )}
                  {achievement.category && (
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-[var(--bg-surface)] text-[var(--text-muted)] border border-[var(--border-color)] font-medium">
                      {achievement.category}
                    </span>
                  )}
                </div>
              </div>

              {/* Theme-Adaptive Pin Button */}
              <button
                onClick={handlePinClick}
                title={achievement.is_pinned ? 'Unpin achievement' : 'Pin to Quick Access drawer'}
                className={`p-1.5 rounded-md transition-all border flex-shrink-0 flex items-center gap-1 ${
                  achievement.is_pinned
                    ? 'bg-[var(--accent-gold)] text-[var(--bg-primary)] border-[var(--accent-gold)] font-bold shadow-sm'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)] bg-[var(--bg-surface)] border-[var(--border-color)] hover:border-[var(--text-muted)]'
                }`}
              >
                <Pin className={`w-3.5 h-3.5 ${achievement.is_pinned ? 'fill-current' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Fixed Height Description Box */}
        <div className="h-[2.5rem] flex items-center">
          <p className="text-xs text-[var(--text-muted)] leading-relaxed line-clamp-2">
            {achievement.hidden && !achievement.unlocked
              ? 'Hidden achievement details. Expand strategy guide below for hints.'
              : achievement.description}
          </p>
        </div>
      </div>

      {/* Footer & Controls - Locked at bottom */}
      <div className="flex flex-col gap-2 mt-auto">
        {/* Progress Bar (Fixed Height Reservation) */}
        <div className="h-4 flex items-center">
          {!achievement.unlocked && achievement.progress && achievement.progress.max > 1 ? (
            <div className="w-full bg-[var(--bg-surface)] rounded-full h-2 overflow-hidden border border-[var(--border-color)]">
              <div
                className="bg-[var(--accent-primary)] h-full rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(0, progressRatio))}%` }}
              />
            </div>
          ) : (
            <div className="w-full h-2" />
          )}
        </div>

        {/* Action Controls Footer (Theme Adaptive Colors) */}
        <div className="flex items-center justify-between text-[11px] border-t border-[var(--border-color)] pt-2">
          <div className="flex items-center gap-3">
            {achievement.estimated_minutes && !achievement.unlocked && (
              <span className="flex items-center gap-1 text-[var(--text-muted)] font-medium">
                <Clock className="w-3.5 h-3.5 text-[var(--accent-primary)]" /> ~{achievement.estimated_minutes} min
              </span>
            )}
            {achievement.unlocked && (
              <span className="text-[var(--accent-emerald)] font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-[var(--accent-emerald)]" /> Unlocked
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {achievement.hint && (
              <button
                onClick={() => setShowHint(!showHint)}
                className="text-[11px] font-semibold text-[var(--accent-primary)] hover:underline flex items-center gap-1"
              >
                <Info className="w-3.5 h-3.5" />
                <span>{showHint ? 'Hide Strategy' : 'Strategy'}</span>
                {showHint ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            )}

            {showUnlockButton && !achievement.unlocked && onUnlock && (
              <button
                onClick={handleUnlockClick}
                className="px-2.5 py-0.5 bg-[var(--accent-emerald)] hover:brightness-110 text-[var(--bg-primary)] font-bold text-[10px] rounded-md transition-all flex items-center gap-1 shadow-sm"
              >
                <Sparkles className="w-3 h-3" /> Unlock
              </button>
            )}
          </div>
        </div>

        {/* Strategy Hint Dropdown */}
        {showHint && achievement.hint && (
          <div className="absolute left-0 right-0 top-full mt-1 bg-[var(--bg-surface)] border border-[var(--border-color)] p-3 rounded-lg text-xs text-[var(--text-main)] z-20 shadow-xl animate-fadeIn leading-relaxed">
            <span className="font-bold text-[var(--accent-gold)] flex items-center gap-1.5 mb-1">
              <Lightbulb className="w-4 h-4 text-[var(--accent-gold)]" /> Strategy & Tips:
            </span>
            {achievement.hint}
          </div>
        )}
      </div>
    </div>
  );
};
