import { Game, RankedAchievements } from '../types/achievement';
import { MockSteamClientService } from './mockSteamClient';

export class SteamApiService {
  static async getGames(): Promise<Game[]> {
    try {
      const { call } = await import('@decky/api');
      const res = await call<[], any>('get_games');
      const data = res && res.result ? res.result : res;
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    } catch (e) {
      console.warn('[Next Unlock] RPC get_games error, using fallback:', e);
    }
    return MockSteamClientService.getGames();
  }

  static async getGameDetails(appid: number): Promise<{ game: Game; ranked: RankedAchievements }> {
    try {
      const { call } = await import('@decky/api');
      const res = await call<[number], any>('get_game_details', appid);
      const data = res && res.result ? res.result : res;
      if (data && data.game && data.ranked) {
        return data;
      }
    } catch (e) {
      console.warn('[Next Unlock] RPC get_game_details error, using fallback:', e);
    }
    return MockSteamClientService.getGameDetails(appid);
  }

  static async togglePin(achievementId: string): Promise<{ achievement_id: string; pinned: boolean }> {
    try {
      const { call } = await import('@decky/api');
      const res = await call<[string], any>('toggle_pin', achievementId);
      const data = res && res.result ? res.result : res;
      if (data && data.achievement_id) {
        return data;
      }
    } catch (e) {
      console.warn('[Next Unlock] RPC toggle_pin error, using fallback:', e);
    }
    return MockSteamClientService.togglePin(achievementId);
  }

  static async unlockAchievement(appid: number, achievementId: string): Promise<boolean> {
    return MockSteamClientService.unlockAchievement(appid, achievementId);
  }
}
