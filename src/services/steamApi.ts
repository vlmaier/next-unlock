import { Game, RankedAchievements } from '../types/achievement';
import { MockSteamClientService } from './mockSteamClient';

declare global {
  interface Window {
    DeckyPluginLoader?: any;
    SteamClient?: any;
  }
}

export class SteamApiService {
  static isDecky(): boolean {
    return typeof window.DeckyPluginLoader !== 'undefined';
  }

  static async getGames(): Promise<Game[]> {
    if (this.isDecky()) {
      try {
        return await window.DeckyPluginLoader.callServerMethod('get_games', {});
      } catch (e) {
        console.warn('Decky RPC error, falling back to mock:', e);
      }
    }
    return MockSteamClientService.getGames();
  }

  static async getGameDetails(appid: number): Promise<{ game: Game; ranked: RankedAchievements }> {
    if (this.isDecky()) {
      try {
        return await window.DeckyPluginLoader.callServerMethod('get_game_details', { appid });
      } catch (e) {
        console.warn('Decky RPC error, falling back to mock:', e);
      }
    }
    return MockSteamClientService.getGameDetails(appid);
  }

  static async togglePin(achievementId: string): Promise<{ achievement_id: string; pinned: boolean }> {
    if (this.isDecky()) {
      try {
        return await window.DeckyPluginLoader.callServerMethod('toggle_pin', { achievement_id: achievementId });
      } catch (e) {
        console.warn('Decky RPC error, falling back to mock:', e);
      }
    }
    return MockSteamClientService.togglePin(achievementId);
  }

  static async unlockAchievement(appid: number, achievementId: string): Promise<boolean> {
    return MockSteamClientService.unlockAchievement(appid, achievementId);
  }
}
