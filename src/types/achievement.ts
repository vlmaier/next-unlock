export type RarityTier = 'common' | 'rare' | 'ultra_rare';

export type CategoryFilterType =
  | 'all'
  | 'up_next'
  | 'easy_grabs'
  | 'almost_there'
  | 'pinned'
  | 'missable'
  | 'unlocked';

export type ColorThemeId = 'steam_slate';

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
  last_played?: number;
  total_achievements: number;
  unlocked_count: number;
  completion_percentage: number;
  achievements: Achievement[];
}
