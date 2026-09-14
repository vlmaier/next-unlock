import React from 'react';
import { ColorThemeId } from '../types/achievement';
import { Palette } from 'lucide-react';

interface ThemeSwitcherProps {
  currentTheme: ColorThemeId;
  onThemeChange: (theme: ColorThemeId) => void;
}

const THEMES: { id: ColorThemeId; name: string; desc: string }[] = [
  {
    id: 'steam_slate',
    name: 'Valve DeckOS (Steam Slate)',
    desc: 'Official SteamOS Gaming Mode UI theme',
  },
  {
    id: 'aether_gold',
    name: 'PlayStation Platinum (Trophy Dark)',
    desc: 'Soft cobalt & matte trophy gold',
  },
  {
    id: 'obsidian_matte',
    name: 'GOG Galaxy Midnight',
    desc: 'Minimalist European dark graphite',
  },
  {
    id: 'emerald_tactical',
    name: 'Nordic Espresso (Cozy Dark)',
    desc: 'Warm dark timber & terracotta stone',
  },
  {
    id: 'nordic_frost',
    name: 'Stealth Monochrome (OLED)',
    desc: 'Pure OLED black & titanium white',
  },
];

export const ThemeSwitcher: React.FC<ThemeSwitcherProps> = ({ currentTheme, onThemeChange }) => {
  return (
    <div className="flex items-center gap-2">
      <Palette className="w-4 h-4 text-[var(--text-muted)]" />
      <select
        value={currentTheme}
        onChange={(e) => onThemeChange(e.target.value as ColorThemeId)}
        className="bg-[var(--bg-surface)] text-[var(--text-main)] border border-[var(--border-color)] text-xs font-semibold rounded-lg px-2.5 py-1.5 focus:outline-none cursor-pointer hover:border-[var(--text-muted)] transition-colors"
      >
        {THEMES.map((theme) => (
          <option key={theme.id} value={theme.id}>
            {theme.name}
          </option>
        ))}
      </select>
    </div>
  );
};
