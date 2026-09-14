import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SteamApiService, __setCallFn } from '../services/steamApi';

describe('SteamApiService Test Suite - 100% Execution Path Coverage', () => {
  const mockCall = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    __setCallFn(mockCall);
  });

  describe('getGames() Paths', () => {
    it('should return live games list when Decky RPC call succeeds', async () => {
      const mockResult = [{ appid: 12345, name: 'Test Game', completion_percentage: 50, unlocked_count: 5, total_achievements: 10, achievements: [] }];
      mockCall.mockResolvedValueOnce({ success: true, result: mockResult });

      const games = await SteamApiService.getGames();
      expect(games).toEqual(mockResult);
    });

    it('should fallback to MockSteamClientService when Decky RPC throws an error', async () => {
      mockCall.mockRejectedValueOnce(new Error('RPC Connection Error'));

      const games = await SteamApiService.getGames();
      expect(games.length).toBeGreaterThan(0);
      expect(games[0].name).toBe('Elden Ring');
    });

    it('should fallback to MockSteamClientService when Decky RPC returns empty/invalid result', async () => {
      mockCall.mockResolvedValueOnce({ success: false, result: null });

      const games = await SteamApiService.getGames();
      expect(games.length).toBeGreaterThan(0);
    });
  });

  describe('getGameDetails() Paths', () => {
    it('should return game details when Decky RPC call succeeds', async () => {
      const mockDetails = {
        game: { appid: 1245620, name: 'Elden Ring', completion_percentage: 80, unlocked_count: 8, total_achievements: 10, achievements: [] },
        ranked: { all: [], up_next: [], almost_there: [], easy_grabs: [], missable: [], pinned: [], unlocked: [], locked: [] },
      };
      mockCall.mockResolvedValueOnce({ success: true, result: mockDetails });

      const details = await SteamApiService.getGameDetails(1245620);
      expect(details.game.name).toBe('Elden Ring');
      expect(details.ranked).toBeDefined();
    });

    it('should fallback to MockSteamClientService when Decky RPC fails for details', async () => {
      mockCall.mockRejectedValueOnce(new Error('Backend Offline'));

      const details = await SteamApiService.getGameDetails(1245620);
      expect(details.game.appid).toBe(1245620);
      expect(details.ranked.locked.length).toBeGreaterThan(0);
    });
  });

  describe('togglePin() & unlockAchievement() Paths', () => {
    it('should handle togglePin via RPC when available', async () => {
      mockCall.mockResolvedValueOnce({ success: true, result: { achievement_id: 'ACH_MALENIA', pinned: true } });

      const res = await SteamApiService.togglePin('ACH_MALENIA');
      expect(res.pinned).toBe(true);
    });

    it('should fallback togglePin to MockSteamClientService when RPC throws', async () => {
      mockCall.mockRejectedValueOnce(new Error('RPC Error'));

      const res = await SteamApiService.togglePin('ACH_MALENIA');
      expect(res.achievement_id).toBe('ACH_MALENIA');
    });

    it('should unlock achievement locally in MockSteamClientService', async () => {
      const res = await SteamApiService.unlockAchievement(1245620, 'ACH_LEGENDARY_ARMAMENTS');
      expect(res).toBe(true);
    });

    it('should fallback to MockSteamClientService when callFn is null', async () => {
      __setCallFn(null);
      const games = await SteamApiService.getGames();
      expect(games.length).toBeGreaterThan(0);
      expect(games[0].name).toBe('Elden Ring');
    });
  });
});
