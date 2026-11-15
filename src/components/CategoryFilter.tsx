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
  { id: 'up_next', label: 'Up Next', icon: Sparkles },
  { id: 'easy_grabs', label: 'Easy Grabs', icon: Zap },
  { id: 'almost_there', label: 'Almost There', icon: Clock },
  { id: 'pinned', label: 'Pinned', icon: Pin },
  { id: 'all', label: 'All', icon: List },
  { id: 'missable', label: 'Secret / Rare', icon: EyeOff },
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
            data-testid={`category-tab-${cat.id}`}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all duration-150 border flex-shrink-0 cursor-pointer focus:ring-2 focus:ring-[#389fff] focus:outline-none ${
              isActive
                ? 'bg-[#389fff] text-white border-[#389fff] shadow-sm'
                : 'bg-[#161f2c] text-slate-300 hover:text-white hover:bg-[#1e293b] border-[#2e3d52]'
            }`}
          >
            <Icon className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{cat.label}</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                isActive
                  ? 'bg-black/25 text-white'
                  : 'bg-[#0e141b] text-slate-400 border border-[#2e3d52]'
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
