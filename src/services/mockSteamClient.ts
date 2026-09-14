import { Game, RankedAchievements } from '../types/achievement';

const INITIAL_MOCK_GAMES: Game[] = [
  {
    appid: 1245620,
    name: 'Elden Ring',
    header_image: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&auto=format&fit=crop&q=80',
    total_achievements: 42,
    unlocked_count: 34,
    completion_percentage: 80.9,
    achievements: [
      {
        id: 'ACH_ELDEN_LORD',
        name: 'Elden Lord',
        description: 'Achieved the "Elden Lord" ending.',
        icon: '',
        unlocked: true,
        unlock_time: 1704067200,
        global_percentage: 24.5,
        rarity_tier: 'common',
        category: 'Story',
        hidden: false,
        progress: { current: 1, max: 1 },
      },
      {
        id: 'ACH_MALENIA',
        name: 'Shardbearer Malenia',
        description: 'Defeated Shardbearer Malenia, Blade of Miquella in Elphael.',
        icon: '',
        unlocked: false,
        unlock_time: null,
        global_percentage: 4.1,
        rarity_tier: 'ultra_rare',
        category: 'Up Next',
        hidden: false,
        progress: { current: 85, max: 100 },
        estimated_minutes: 45,
        hint: 'Reach Elphael, Brace of the Haligtree. Prepare bleed or frost weapons for Phase 2 waterfowl dance.',
        rec_score: 94.5,
      },
      {
        id: 'ACH_LEGENDARY_ARMAMENTS',
        name: 'Legendary Armaments',
        description: 'Acquired all 9 legendary armaments across the Lands Between.',
        icon: '',
        unlocked: false,
        unlock_time: null,
        global_percentage: 9.2,
        rarity_tier: 'rare',
        category: 'Almost There',
        hidden: false,
        progress: { current: 8, max: 9 },
        estimated_minutes: 20,
        hint: 'Bolt of Gransax is missing in Royal Capital Leyndell before Ashen Capital transition.',
        rec_score: 88.2,
      },
      {
        id: 'ACH_GODDEVOURING_SERPENT',
        name: 'Rykard, Lord of Blasphemy',
        description: 'Defeated Rykard, Lord of Blasphemy in Volcano Manor.',
        icon: '',
        unlocked: false,
        unlock_time: null,
        global_percentage: 35.8,
        rarity_tier: 'common',
        category: 'Easy Grabs',
        hidden: false,
        progress: { current: 0, max: 1 },
        estimated_minutes: 15,
        hint: 'Equip the Serpent-Hunter spear found at the entrance of the boss arena.',
        rec_score: 72.1,
      },
      {
        id: 'ACH_AGE_OF_STARS',
        name: 'Age of the Stars',
        description: 'Achieved the "Age of the Stars" ending with Ranni.',
        icon: '',
        unlocked: false,
        unlock_time: null,
        global_percentage: 28.2,
        rarity_tier: 'rare',
        category: 'Missable',
        hidden: true,
        progress: { current: 4, max: 5 },
        estimated_minutes: 30,
        hint: 'Complete Ranni questline and summon her blue sign after final boss.',
        rec_score: 65.0,
      },
    ],
  },
  {
    appid: 1091500,
    name: 'Cyberpunk 2077',
    header_image: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=800&auto=format&fit=crop&q=80',
    total_achievements: 44,
    unlocked_count: 39,
    completion_percentage: 88.6,
    achievements: [
      {
        id: 'ACH_NIGHT_CITY_LEGEND',
        name: 'Night City Legend',
        description: 'Complete all Cyberpunk 2077 achievements.',
        icon: '',
        unlocked: false,
        unlock_time: null,
        global_percentage: 3.8,
        rarity_tier: 'ultra_rare',
        category: 'Up Next',
        hidden: false,
        progress: { current: 39, max: 44 },
        estimated_minutes: 90,
        hint: 'Complete remaining 5 district gigs in Pacifica & Santo Domingo.',
        rec_score: 91.0,
      },
      {
        id: 'ACH_AUTOPILOT',
        name: 'Autorestart',
        description: 'Perform a Quickhack upload on 3 cyberware enemies simultaneously.',
        icon: '',
        unlocked: false,
        unlock_time: null,
        global_percentage: 42.1,
        rarity_tier: 'common',
        category: 'Easy Grabs',
        hidden: false,
        progress: { current: 2, max: 3 },
        estimated_minutes: 5,
        hint: 'Use Contagion daemon quickhack on grouped Tyger Claws.',
        rec_score: 82.0,
      },
    ],
  },
  {
    appid: 1145350,
    name: 'Hades II',
    header_image: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=800&auto=format&fit=crop&q=80',
    total_achievements: 38,
    unlocked_count: 31,
    completion_percentage: 81.5,
    achievements: [
      {
        id: 'ACH_CHRONOS_DOWN',
        name: 'Time Is Up',
        description: 'Vanquish Chronos in the depths of Tartarus.',
        icon: '',
        unlocked: true,
        unlock_time: 1715000000,
        global_percentage: 32.1,
        rarity_tier: 'common',
        category: 'Story',
        hidden: false,
        progress: { current: 1, max: 1 },
      },
      {
        id: 'ACH_ALL_ASPECTS',
        name: 'Master of Arms',
        description: 'Unlock all Nocturnal Arms aspects.',
        icon: '',
        unlocked: false,
        unlock_time: null,
        global_percentage: 6.8,
        rarity_tier: 'rare',
        category: 'Up Next',
        hidden: false,
        progress: { current: 11, max: 12 },
        estimated_minutes: 25,
        hint: 'Gather 2 more Nightmare resources from high-heat Oath runs.',
        rec_score: 89.0,
      },
    ],
  },
  {
    appid: 367520,
    name: 'Hollow Knight',
    header_image: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&auto=format&fit=crop&q=80',
    total_achievements: 63,
    unlocked_count: 55,
    completion_percentage: 87.3,
    achievements: [
      {
        id: 'ACH_PANTHEON_5',
        name: 'Embrace the Void',
        description: 'Conquer the Pantheon of Hallownest and ascend.',
        icon: '',
        unlocked: false,
        unlock_time: null,
        global_percentage: 2.9,
        rarity_tier: 'ultra_rare',
        category: 'Up Next',
        hidden: false,
        progress: { current: 4, max: 5 },
        estimated_minutes: 60,
        hint: 'Practice Absolute Radiance in the Hall of Gods before the final climb.',
        rec_score: 90.0,
      },
    ],
  },
];

let mockGames = JSON.parse(JSON.stringify(INITIAL_MOCK_GAMES));
let pinnedIds = new Set<string>(['ACH_MALENIA']);

export class MockSteamClientService {
  static updatePinnedStateOnGames() {
    mockGames.forEach((game: Game) => {
      game.achievements.forEach((ach) => {
        ach.is_pinned = pinnedIds.has(ach.id);
      });
    });
  }

  static getGames(): Promise<Game[]> {
    this.updatePinnedStateOnGames();
    // Return fresh clone so React detects array & object reference changes
    return Promise.resolve(JSON.parse(JSON.stringify(mockGames)));
  }

  static getGameDetails(appid: number): Promise<{ game: Game; ranked: RankedAchievements }> {
    this.updatePinnedStateOnGames();
    const targetGame = mockGames.find((g: Game) => g.appid === appid) || mockGames[0];
    const game = JSON.parse(JSON.stringify(targetGame));
    const achievements = game.achievements;

    const pinned: any[] = [];
    const up_next: any[] = [];
    const almost_there: any[] = [];
    const easy_grabs: any[] = [];
    const missable: any[] = [];
    const locked: any[] = [];
    const unlocked: any[] = [];

    achievements.forEach((ach: any) => {
      const isPinned = pinnedIds.has(ach.id);
      ach.is_pinned = isPinned;

      if (ach.unlocked) {
        unlocked.push(ach);
        return;
      }

      locked.push(ach);
      if (isPinned) pinned.push(ach);

      const ratio = ach.progress ? ach.progress.current / ach.progress.max : 0;
      if (ratio >= 0.75) almost_there.push(ach);
      if (ach.global_percentage >= 30 || (ach.estimated_minutes && ach.estimated_minutes <= 15)) {
        easy_grabs.push(ach);
      }
      if (ach.hidden || ach.category === 'Missable') missable.push(ach);
    });

    const sortedLocked = [...locked].sort((a, b) => (b.rec_score || 0) - (a.rec_score || 0));

    return Promise.resolve({
      game,
      ranked: {
        pinned,
        up_next: sortedLocked.slice(0, 3),
        almost_there,
        easy_grabs,
        missable,
        locked,
        unlocked,
      },
    });
  }

  static togglePin(achievement_id: string): Promise<{ achievement_id: string; pinned: boolean }> {
    if (pinnedIds.has(achievement_id)) {
      pinnedIds.delete(achievement_id);
    } else {
      pinnedIds.add(achievement_id);
    }
    this.updatePinnedStateOnGames();
    const pinned = pinnedIds.has(achievement_id);
    return Promise.resolve({ achievement_id, pinned });
  }

  static unlockAchievement(appid: number, achievement_id: string): Promise<boolean> {
    const game = mockGames.find((g: Game) => g.appid === appid);
    if (!game) return Promise.resolve(false);

    const ach = game.achievements.find((a: any) => a.id === achievement_id);
    if (ach && !ach.unlocked) {
      ach.unlocked = true;
      ach.unlock_time = Math.floor(Date.now() / 1000);
      game.unlocked_count += 1;
      game.completion_percentage = Math.round((game.unlocked_count / game.total_achievements) * 1000) / 10;
      this.updatePinnedStateOnGames();
      return Promise.resolve(true);
    }
    return Promise.resolve(false);
  }
}
