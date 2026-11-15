import React from 'react';
import { Search, X } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  placeholder = 'Filter achievements...',
}) => {
  return (
    <div className="relative w-full sm:w-64 md:w-72 flex-shrink-0">
      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label="Filter achievements"
        className="w-full bg-[#161f2c] text-slate-100 placeholder-slate-400 border border-[#2e3d52] rounded-lg pl-8 pr-8 py-1.5 text-xs font-medium focus:outline-none focus:border-[#389fff] focus:ring-1 focus:ring-[#389fff] transition-colors"
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange('')}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5 rounded-full hover:bg-[#1e293b] transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
