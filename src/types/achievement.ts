export type RarityTier = 'common' | 'rare' | 'ultra_rare';

export type CategoryFilterType = 
  | 'all' 
  | 'up_next' 
  | 'almost_there' 
  | 'easy_grabs' 
  | 'missable' 
  | 'pinned' 
  | 'unlocked';

export type ColorThemeId = 
  | 'steam_slate'    // Official SteamOS Dark Slate (Default - Matte, native, clean)
  | 'aether_gold'     // Matte Trophy Gold & Charcoal
  | 'obsidian_matte'  // Stealth Matte Black
  | 'emerald_tactical'// Tactical Matte Mint/Teal
  | 'nordic_frost';   // Ice Slate & Cobalt

export interface ProgressInfo {
  current: number;
  max: number;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlocked: boolean;
  unlock_time?: number | null;
  global_percentage: number;
  rarity_tier: RarityTier;
  category?: string;
  hidden?: boolean;
  progress?: ProgressInfo;
  estimated_minutes?: number;
  hint?: string;
  is_pinned?: boolean;
  rec_score?: number;
}

export interface RankedAchievements {
  pinned: Achievement[];
  up_next: Achievement[];
  almost_there: Achievement[];
  easy_grabs: Achievement[];
  missable: Achievement[];
  locked: Achievement[];
  unlocked: Achievement[];
}

export interface Game {
  appid: number;
  name: string;
  header_image: string;
  total_achievements: number;
  unlocked_count: number;
  completion_percentage: number;
  achievements: Achievement[];
}
