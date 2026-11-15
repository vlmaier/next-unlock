import React, { useState, useEffect } from 'react';
import { Trophy, Award, Star, Shield, Zap, Flame, Crown, Lock, Check } from 'lucide-react';
import { RarityTier } from '../types/achievement';

interface AchievementIconProps {
  src?: string;
  name: string;
  unlocked: boolean;
  rarityTier?: RarityTier;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

export const AchievementIcon: React.FC<AchievementIconProps> = ({
  src,
  name,
  unlocked,
  rarityTier = 'common',
  size = 'md',
}) => {
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImageError(false);
  }, [src]);

  const sizeStyles = {
    xs: { box: 'w-8 h-8', px: 32, icon: 'w-4 h-4', badge: 'w-2 h-2' },
    sm: { box: 'w-10 h-10', px: 40, icon: 'w-5 h-5', badge: 'w-2.5 h-2.5' },
    md: { box: 'w-12 h-12', px: 48, icon: 'w-6 h-6', badge: 'w-2.5 h-2.5' },
    lg: { box: 'w-16 h-16', px: 64, icon: 'w-8 h-8', badge: 'w-3 h-3' },
  }[size];

  const getFallbackIcon = () => {
    const lower = name.toLowerCase();
    if (lower.includes('lord') || lower.includes('crown') || lower.includes('legend') || lower.includes('king')) return Crown;
    if (lower.includes('boss') || lower.includes('dragon') || lower.includes('flame') || lower.includes('fire') || lower.includes('serpent') || lower.includes('rykard')) return Flame;
    if (lower.includes('weapon') || lower.includes('armaments') || lower.includes('arms') || lower.includes('shield') || lower.includes('sword') || lower.includes('malenia')) return Shield;
    if (lower.includes('speed') || lower.includes('quick') || lower.includes('zap') || lower.includes('auto') || lower.includes('time')) return Zap;
    if (rarityTier === 'ultra_rare') return Award;
    if (rarityTier === 'rare') return Star;
    return Trophy;
  };

  const FallbackIcon = getFallbackIcon();

  const getStyleTheme = () => {
    if (unlocked) {
      return 'bg-[#161f2c] border-[#10b981]/60 text-[#10b981]';
    }
    if (rarityTier === 'ultra_rare') {
      return 'bg-[#161f2c] border-amber-500/40 text-amber-400';
    }
    if (rarityTier === 'rare') {
      return 'bg-[#161f2c] border-[#389fff]/40 text-[#389fff]';
    }
    return 'bg-[#161f2c] border-[#2e3d52] text-slate-300';
  };

  return (
    <div
      style={{ width: sizeStyles.px, height: sizeStyles.px }}
      className={`relative flex-shrink-0 rounded-lg overflow-hidden border ${sizeStyles.box} ${getStyleTheme()} flex items-center justify-center transition-all shadow-inner`}
    >
      {src && !imageError ? (
        <img
          src={src}
          alt={name}
          onError={() => setImageError(true)}
          style={{ width: sizeStyles.px, height: sizeStyles.px }}
          className={`w-full h-full object-cover ${
            unlocked ? 'brightness-100 saturate-100' : 'brightness-90 saturate-75'
          }`}
        />
      ) : (
        <FallbackIcon className={`${sizeStyles.icon} opacity-90 drop-shadow-sm`} />
      )}

      {/* Lock or Check status badge */}
      <div
        className={`absolute bottom-0.5 right-0.5 p-0.5 rounded-full ${
          unlocked
            ? 'bg-[#10b981] text-[#0e141b] shadow-sm'
            : 'bg-[#0e141b]/90 text-slate-300 border border-[#2e3d52]'
        }`}
      >
        {unlocked ? (
          <Check className={`${sizeStyles.badge} stroke-[3]`} />
        ) : (
          <Lock className={sizeStyles.badge} />
        )}
      </div>
    </div>
  );
};
