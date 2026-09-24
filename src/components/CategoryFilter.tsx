import React from 'react';
import { CategoryFilterType } from '../types/achievement';
import { Sparkles, Clock, Zap, EyeOff, Pin, CheckCircle2, List } from 'lucide-react';
import { Focusable } from './deckyUi';

interface CategoryFilterProps {
  activeCategory: CategoryFilterType;
  onSelectCategory: (cat: CategoryFilterType) => void;
  counts: {
    all: number;
    up_next: number;
    almost_there: number;
    easy_grabs: number;
    missable: number;
    pinned: number;
    unlocked: number;
  };
}

const CATEGORIES: { id: CategoryFilterType; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'all', label: 'All', icon: List },
  { id: 'up_next', label: 'Up Next', icon: Sparkles },
  { id: 'almost_there', label: 'Almost There', icon: Clock },
  { id: 'easy_grabs', label: 'Easy Grabs', icon: Zap },
  { id: 'pinned', label: 'Pinned', icon: Pin },
  { id: 'missable', label: 'Missable', icon: EyeOff },
  { id: 'unlocked', label: 'Unlocked', icon: CheckCircle2 },
];

export const CategoryFilter: React.FC<CategoryFilterProps> = ({
  activeCategory,
  onSelectCategory,
  counts,
}) => {
  return (
    <Focusable flow-children="row" className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar w-full">
      {CATEGORIES.map((cat) => {
        const Icon = cat.icon;
        const count = counts[cat.id] || 0;
        const isActive = activeCategory === cat.id;

        return (
          <Focusable
            key={cat.id}
            focusable={true}
            onActivate={() => onSelectCategory(cat.id)}
            onClick={() => onSelectCategory(cat.id)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all duration-150 border flex-shrink-0 cursor-pointer focus:ring-2 focus:ring-[var(--focus-ring)] focus:scale-[1.02] focus:outline-none ${
              isActive
                ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)] shadow-sm'
                : 'bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card)] border-[var(--border-color)]'
            }`}
          >
            <Icon className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{cat.label}</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                isActive
                  ? 'bg-white/25 text-white'
                  : 'bg-[var(--bg-card)] text-[var(--text-muted)] border border-[var(--border-color)]'
              }`}
            >
              {count}
            </span>
          </Focusable>
        );
      })}
    </Focusable>
  );
};
