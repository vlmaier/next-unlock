import { Game, RankedAchievements } from '../types/achievement';
import { MockSteamClientService } from './mockSteamClient';

// Lazy-loaded call function from @decky/api
let _callFn: ((...args: any[]) => Promise<any>) | null = null;

async function getCallFn() {
  if (_callFn) return _callFn;
  try {
    const mod = await import(/* @vite-ignore */ '@decky/api');
    _callFn = mod.call;
    return _callFn;
  } catch {
    return null;
  }
}

// Allow tests to inject a mock call function
export function __setCallFn(fn: ((...args: any[]) => Promise<any>) | null) {
  _callFn = fn;
}

export class SteamApiService {
  static async getGames(): Promise<Game[]> {
    try {
      const callFn = await getCallFn();
      if (!callFn) throw new Error('No Decky API');
      const res = await callFn('get_games');
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
      const callFn = await getCallFn();
      if (!callFn) throw new Error('No Decky API');
      const res = await callFn('get_game_details', appid);
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
      const callFn = await getCallFn();
      if (!callFn) throw new Error('No Decky API');
      const res = await callFn('toggle_pin', achievementId);
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
