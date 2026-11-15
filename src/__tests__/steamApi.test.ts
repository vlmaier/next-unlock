import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  SteamApiService,
  __setCallFn,
  clearApiCache,
  computeRecommendationScore,
  rankAchievements,
} from '../services/steamApi';
import { MockSteamClientService } from '../services/mockSteamClient';
import { Achievement } from '../types/achievement';

describe('SteamApiService & Canonical Recommendation Engine', () => {
  const mockCall = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    clearApiCache();
    MockSteamClientService.reset();
    __setCallFn(mockCall);
  });

  describe('Canonical Recommendation Formula (Spec 03)', () => {
    it('prioritizes high-progress and easy-grab achievements above ultra-rare grinds', () => {
      const sample: Achievement[] = [
        {
          id: 'hard_grind',
          name: 'Ultra Hard 0.2%',
          description: 'Beat the game blindfolded.',
          icon: '',
          unlocked: false,
          global_percentage: 0.2,
          rarity_tier: 'ultra_rare',
          hidden: false,
        },
        {
          id: 'easy_prologue',
          name: 'Welcome to the Lands Between',
          description: 'Open the first door.',
          icon: '',
          unlocked: false,
          global_percentage: 82.0,
          rarity_tier: 'common',
          hidden: false,
        },
        {
          id: 'almost_done',
          name: 'Collect 10 Talismans',
          description: 'Find all 10 talismans.',
          icon: '',
          unlocked: false,
          global_percentage: 12.0,
          rarity_tier: 'rare',
          hidden: false,
          progress: { current: 9, max: 10 },
        },
      ];

      const ranked = rankAchievements(sample, new Set(['almost_done']));

      // Easy Prologue (82%) and Almost Done (9/10) must rank above Hard Grind (0.2%)
      expect(ranked.up_next[0].id).toBe('easy_prologue');
      expect(ranked.up_next[1].id).toBe('almost_done');
      expect(ranked.up_next[2].id).toBe('hard_grind');

      expect(computeRecommendationScore(sample[1])).toBeGreaterThan(
        computeRecommendationScore(sample[0])
      );
      expect(computeRecommendationScore(sample[2])).toBeGreaterThan(
        computeRecommendationScore(sample[0])
      );

      expect(ranked.pinned.map((a) => a.id)).toEqual(['almost_done']);
      expect(ranked.almost_there.map((a) => a.id)).toEqual(['almost_done']);
      expect(ranked.easy_grabs.map((a) => a.id)).toEqual(['easy_prologue']);
    });
  });

  describe('getGames() & Synchronous Cache Recall', () => {
    it('returns live games list when Decky RPC succeeds and populates synchronous cache', async () => {
      const mockResult = [
        {
          appid: 1245620,
          name: 'Elden Ring',
          header_image: '',
          completion_percentage: 50,
          unlocked_count: 5,
          total_achievements: 10,
          achievements: [],
        },
      ];
      mockCall.mockImplementation(async (method: string) => {
        if (method === 'get_pinned') return [];
        if (method === 'get_games') return { result: mockResult };
        return null;
      });

      const games = await SteamApiService.getGames();
      expect(games).toEqual(mockResult);
      // Synchronous getter must now return the loaded games in 0ms
      expect(SteamApiService.getCachedGamesSync()).toEqual(mockResult);
    });

    it('passes forceRefresh=true to backend RPC when requested', async () => {
      mockCall.mockResolvedValue({ result: [] });
      await SteamApiService.getGames(true);
      expect(mockCall).toHaveBeenCalledWith('get_games', true);
    });

    it('falls back to MockSteamClientService in test mode when RPC throws', async () => {
      mockCall.mockRejectedValue(new Error('RPC Connection Error'));

      const games = await SteamApiService.getGames();
      expect(games.length).toBeGreaterThan(0);
      expect(games[0].name).toBe('Elden Ring');
    });
  });

  describe('getGameDetails(), Zero-Achievement Games & Pin Cache Invalidation', () => {
    it('immediately updates cached game details when togglePin is called (no stale cache)', async () => {
      mockCall.mockRejectedValue(new Error('Offline'));

      const initial = await SteamApiService.getGameDetails(1245620);
      expect(initial.ranked.pinned.some((a) => a.id === 'ACH_MALENIA')).toBe(false);

      // Pin ACH_MALENIA
      const pinRes = await SteamApiService.togglePin('ACH_MALENIA');
      expect(pinRes.pinned).toBe(true);

      // Calling getGameDetails WITHOUT forceRefresh must immediately reflect the new pin!
      const afterPin = await SteamApiService.getGameDetails(1245620, false);
      expect(afterPin.ranked.pinned.some((a) => a.id === 'ACH_MALENIA')).toBe(true);
      expect(
        afterPin.game.achievements.find((a) => a.id === 'ACH_MALENIA')?.is_pinned
      ).toBe(true);

      // Unpin ACH_MALENIA
      const unpinRes = await SteamApiService.togglePin('ACH_MALENIA');
      expect(unpinRes.pinned).toBe(false);
      const afterUnpin = await SteamApiService.getGameDetails(1245620, false);
      expect(afterUnpin.ranked.pinned.some((a) => a.id === 'ACH_MALENIA')).toBe(false);
    });

    it('preserves game metadata when a game has 0 achievements', async () => {
      mockCall.mockImplementation(async (method: string) => {
        if (method === 'get_pinned') return [];
        if (method === 'get_game_details') {
          return {
            result: {
              game: {
                appid: 999999,
                name: 'Zero Achievement Game',
                header_image: '',
                total_achievements: 0,
                unlocked_count: 0,
                completion_percentage: 0,
                achievements: [],
              },
              ranked: {
                pinned: [],
                up_next: [],
                almost_there: [],
                easy_grabs: [],
                missable: [],
                locked: [],
                unlocked: [],
              },
            },
          };
        }
        return null;
      });

      const details = await SteamApiService.getGameDetails(999999);
      expect(details.game.appid).toBe(999999);
      expect(details.game.name).toBe('Zero Achievement Game');
      expect(details.game.total_achievements).toBe(0);
    });

    it('merges SteamOS collectionStore owned library games alongside installed games', async () => {
      (window as any).collectionStore = {
        allAppsCollection: {
          allApps: [
            { appid: 2062430, display_name: 'BALL x PIT', app_type: 1, installed: true, rt_last_time_played: 200 },
            { appid: 1245620, display_name: 'Elden Ring', app_type: 1, installed: false, rt_last_time_played: 150 },
            { appid: 1091500, display_name: 'Cyberpunk 2077', app_type: 1, installed: false, rt_last_time_played: 100 },
            { appid: 1493710, display_name: 'Proton Experimental', app_type: 1, installed: true },
            { appid: 555555, display_name: 'Game Soundtrack', app_type: 1, installed: false },
            { appid: 666666, display_name: 'Some DLC Pack', app_type: 4, installed: false },
          ],
        },
      };

      try {
        __setCallFn(async (method) => {
          if (method === 'get_games') {
            return [
              {
                appid: 2062430,
                name: 'BALL x PIT',
                header_image: '',
                total_achievements: 82,
                unlocked_count: 67,
                completion_percentage: 81.7,
                achievements: [],
              },
            ];
          }
          if (method === 'get_active_app') return null;
          if (method === 'get_pinned') return [];
          return null;
        });

        const games = await SteamApiService.getGames(true);
        const appIds = games.map((g) => g.appid);
        expect(appIds).toEqual([2062430, 1245620, 1091500]);
      } finally {
        delete (window as any).collectionStore;
      }
    });

    it('preserves native nTotal/nAchieved when SteamOS only caches partial vecHighlight (e.g. 25/27 instead of 12/12)', async () => {
      const twelveHighlights = Array.from({ length: 12 }, (_, idx) => ({
        strID: `HS_ACH_${idx}`,
        strName: `Highlight ${idx}`,
        strDescription: 'Unlocked highlight',
        bAchieved: true,
        flAchieved: 40.0,
      }));
      (window as any).appDetailsStore = {
        GetAchievements: () => ({
          data: {
            nTotal: 27,
            nAchieved: 25,
            vecHighlight: twelveHighlights,
            vecUnachieved: [],
          },
        }),
      };

      try {
        __setCallFn(async () => null);
        const details = await SteamApiService.getGameDetails(1161580, true);
        expect(details.game.total_achievements).toBe(27);
        expect(details.game.unlocked_count).toBe(25);
        expect(details.game.completion_percentage).toBe(92.6);
      } finally {
        delete (window as any).appDetailsStore;
      }
    });
  });
});
