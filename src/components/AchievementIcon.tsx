import React, { useState } from 'react';
import { Trophy, Award, Star, Shield, Zap, Flame, Crown, Lock, Check } from 'lucide-react';
import { RarityTier } from '../types/achievement';

interface AchievementIconProps {
  src?: string;
  name: string;
  unlocked: boolean;
  rarityTier?: RarityTier;
  size?: 'sm' | 'md' | 'lg';
}

export const AchievementIcon: React.FC<AchievementIconProps> = ({
  src,
  name,
  unlocked,
  rarityTier = 'common',
  size = 'md',
}) => {
  const [imageError, setImageError] = useState(false);

  const sizeStyles = {
    sm: { box: 'w-10 h-10', icon: 'w-5 h-5' },
    md: { box: 'w-12 h-12', icon: 'w-6 h-6' },
    lg: { box: 'w-16 h-16', icon: 'w-8 h-8' },
  }[size];

  const getFallbackIcon = () => {
    const lower = name.toLowerCase();
    if (lower.includes('lord') || lower.includes('crown') || lower.includes('legend') || lower.includes('king')) return Crown;
    if (lower.includes('boss') || lower.includes('dragon') || lower.includes('flame') || lower.includes('fire')) return Flame;
    if (lower.includes('weapon') || lower.includes('armaments') || lower.includes('shield') || lower.includes('sword')) return Shield;
    if (lower.includes('speed') || lower.includes('quick') || lower.includes('zap') || lower.includes('auto')) return Zap;
    if (rarityTier === 'ultra_rare') return Award;
    if (rarityTier === 'rare') return Star;
    return Trophy;
  };

  const FallbackIcon = getFallbackIcon();

  const getStyleTheme = () => {
    if (!unlocked) {
      return 'bg-[var(--bg-surface)] border-[var(--border-color)] text-[var(--text-muted)]';
    }
    if (rarityTier === 'ultra_rare') {
      return 'bg-[var(--bg-surface)] border-[var(--accent-gold)] text-[var(--accent-gold)]';
    }
    if (rarityTier === 'rare') {
      return 'bg-[var(--bg-surface)] border-[var(--accent-primary)] text-[var(--accent-primary)]';
    }
    return 'bg-[var(--bg-surface)] border-[var(--accent-emerald)] text-[var(--accent-emerald)]';
  };

  return (
    <div
      className={`relative flex-shrink-0 rounded-lg overflow-hidden border ${sizeStyles.box} ${getStyleTheme()} flex items-center justify-center transition-all`}
    >
      {src && !imageError ? (
        <img
          src={src}
          alt={name}
          onError={() => setImageError(true)}
          className={`w-full h-full object-cover ${
            unlocked ? 'grayscale-0 brightness-100' : 'grayscale opacity-40'
          }`}
        />
      ) : (
        <FallbackIcon className={`${sizeStyles.icon} ${unlocked ? 'opacity-100 drop-shadow' : 'opacity-40'}`} />
      )}

      {/* Lock or Check status badge (Theme Adaptive) */}
      <div
        className={`absolute bottom-0.5 right-0.5 p-0.5 rounded-full ${
          unlocked
            ? 'bg-[var(--accent-emerald)] text-[var(--bg-primary)] shadow-sm'
            : 'bg-[var(--bg-primary)] text-[var(--text-muted)] border border-[var(--border-color)]'
        }`}
      >
        {unlocked ? <Check className="w-2.5 h-2.5 stroke-[3]" /> : <Lock className="w-2.5 h-2.5" />}
      </div>
    </div>
  );
};
