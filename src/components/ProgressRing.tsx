import React from 'react';

interface ProgressRingProps {
  percentage: number;
  unlockedCount: number;
  totalCount: number;
  size?: number;
  strokeWidth?: number;
}

export const ProgressRing: React.FC<ProgressRingProps> = ({
  percentage,
  unlockedCount,
  totalCount,
  size = 110,
  strokeWidth = 9,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  // Scale inner font sizes dynamically based on SVG ring container size
  const isCompact = size <= 54;
  const pctFontClass = isCompact ? 'text-[11px] font-extrabold leading-none' : 'text-lg font-bold leading-tight';
  const countFontClass = isCompact ? 'text-[8px] font-semibold text-[var(--text-muted)] leading-none mt-0.5' : 'text-xs text-[var(--text-muted)] font-medium';

  return (
    <div className="relative inline-flex items-center justify-center flex-shrink-0">
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background Track Circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="var(--bg-surface)"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* Active Progress Circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="var(--accent-primary)"
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-1">
        <span className={`${pctFontClass} text-[var(--text-main)]`}>
          {Math.round(percentage)}%
        </span>
        <span className={countFontClass}>
          {unlockedCount}/{totalCount}
        </span>
      </div>
    </div>
  );
};
