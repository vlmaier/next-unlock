import { Game, RankedAchievements, Achievement, RarityTier, ProgressInfo } from '../types/achievement';
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

/**
 * Returns currently active / running Steam game if running inside SteamOS / Decky.
 */
export function getActiveApp(): { appid: number; name: string } | null {
  if (typeof window === 'undefined') return null;
  const w = window as any;
  const router = w.DFL?.Router || w.Router || w.DeckyPluginLoader?.Router;
  const running = router?.MainRunningApp || router?.RunningApps?.[0];
  if (running && running.appid) {
    const id = typeof running.appid === 'number' ? running.appid : parseInt(running.appid, 10);
    if (!isNaN(id) && id > 0) {
      return {
        appid: id,
        name: running.display_name || running.name || `App ${id}`,
      };
    }
  }
  return null;
}

function formatSteamAchievement(ach: any, appid: number): Achievement {
  const flAchieved =
    typeof ach.flAchieved === 'number'
      ? ach.flAchieved
      : parseFloat(ach.flAchieved) || 0;
  const isUnlocked = !!ach.bAchieved;
  const pct = Math.round(flAchieved * 10) / 10;
  const rarity: RarityTier = pct <= 5.0 ? 'ultra_rare' : pct <= 15.0 ? 'rare' : 'common';

  let iconUrl = ach.strImage || ach.icon || '';
  if (iconUrl && !iconUrl.startsWith('http://') && !iconUrl.startsWith('https://')) {
    iconUrl = `https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/${appid}/${iconUrl}`;
  }

  let progress: ProgressInfo | undefined = undefined;
  if (ach.flMaxProgress && ach.flMaxProgress > 0) {
    progress = {
      current: ach.flCurrentProgress || 0,
      max: ach.flMaxProgress,
    };
  }

  return {
    id: ach.strID || ach.id || `ach_${Math.random()}`,
    name: ach.strName || ach.name || 'Achievement',
    description: ach.strDescription || ach.description || '',
    icon: iconUrl,
    unlocked: isUnlocked,
    unlock_time: ach.rtUnlocked || ach.unlock_time || null,
    global_percentage: pct,
    rarity_tier: rarity,
    hidden: !!ach.bHidden,
    progress,
    hint: ach.strDescription || ach.description || '',
    rec_score: (100 - pct) + (isUnlocked ? 0 : 50),
  };
}

function rankAchievementsLocally(achievements: Achievement[], pinnedSet: Set<string>): RankedAchievements {
  const pinned: Achievement[] = [];
  const up_next: Achievement[] = [];
  const almost_there: Achievement[] = [];
  const easy_grabs: Achievement[] = [];
  const missable: Achievement[] = [];
  const locked: Achievement[] = [];
  const unlocked: Achievement[] = [];

  achievements.forEach((ach) => {
    const isPinned = pinnedSet.has(ach.id);
    ach.is_pinned = isPinned;

    if (ach.unlocked) {
      unlocked.push(ach);
      return;
    }

    locked.push(ach);
    if (isPinned) pinned.push(ach);

    const ratio = ach.progress && ach.progress.max > 0 ? ach.progress.current / ach.progress.max : 0;
    if (ratio >= 0.75) almost_there.push(ach);
    if (ach.global_percentage >= 30 || (ach.estimated_minutes && ach.estimated_minutes <= 15)) {
      easy_grabs.push(ach);
    }
    if (ach.hidden || ach.category === 'Missable') missable.push(ach);
  });

  const sortedLocked = [...locked].sort((a, b) => (b.rec_score || 0) - (a.rec_score || 0));

  return {
    pinned,
    up_next: sortedLocked.slice(0, 3),
    almost_there,
    easy_grabs,
    missable,
    locked,
    unlocked,
  };
}

export class SteamApiService {
  private static pinnedIds = new Set<string>();

  static async getGames(): Promise<Game[]> {
    try {
      const callFn = await getCallFn();
      if (callFn) {
        const res = await callFn('get_games');
        const data = res && res.result ? res.result : res;
        if (Array.isArray(data) && data.length > 0) {
          const active = getActiveApp();
          if (active) {
            const exists = data.find((g: any) => g.appid === active.appid);
            if (!exists) {
              data.unshift({
                appid: active.appid,
                name: active.name,
                header_image: `https://cdn.cloudflare.steamstatic.com/steam/apps/${active.appid}/header.jpg`,
                total_achievements: 0,
                unlocked_count: 0,
                completion_percentage: 0,
                achievements: [],
              });
            }
          }
          return data;
        }
      }
    } catch (e) {
      console.warn('[Next Unlock] RPC get_games error, using fallback:', e);
    }

    const active = getActiveApp();
    if (active) {
      return [
        {
          appid: active.appid,
          name: active.name,
          header_image: `https://cdn.cloudflare.steamstatic.com/steam/apps/${active.appid}/header.jpg`,
          total_achievements: 0,
          unlocked_count: 0,
          completion_percentage: 0,
          achievements: [],
        },
        ...MockSteamClientService.getGamesSync(),
      ];
    }

    return MockSteamClientService.getGames();
  }

  static async getGameDetails(appid: number): Promise<{ game: Game; ranked: RankedAchievements }> {
    // 1. Try querying SteamClient.Apps directly (native SteamOS Client)
    if (typeof window !== 'undefined') {
      const w = window as any;
      const getAchFn = w.SteamClient?.Apps?.GetMyAchievementsForApp;
      if (typeof getAchFn === 'function') {
        try {
          const res = await getAchFn(appid.toString());
          const rawList = res?.data?.rgAchievements || res?.rgAchievements;
          if (Array.isArray(rawList)) {
            const achievements = rawList.map((a: any) => formatSteamAchievement(a, appid));
            const total = achievements.length;
            const unlocked = achievements.filter((a) => a.unlocked).length;
            const completion_percentage = total > 0 ? Math.round((unlocked / total) * 1000) / 10 : 0;
            const active = getActiveApp();
            const gameName = (active && active.appid === appid) ? active.name : `App ${appid}`;

            const game: Game = {
              appid,
              name: gameName,
              header_image: `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg`,
              total_achievements: total,
              unlocked_count: unlocked,
              completion_percentage,
              achievements,
            };

            const ranked = rankAchievementsLocally(achievements, this.pinnedIds);
            return { game, ranked };
          }
        } catch (clientErr) {
          console.warn('[Next Unlock] SteamClient.Apps.GetMyAchievementsForApp error:', clientErr);
        }
      }
    }

    // 2. Try Decky RPC backend
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

    // 3. Fallback to MockSteamClientService
    return MockSteamClientService.getGameDetails(appid);
  }

  static async togglePin(achievementId: string): Promise<{ achievement_id: string; pinned: boolean }> {
    if (this.pinnedIds.has(achievementId)) {
      this.pinnedIds.delete(achievementId);
    } else {
      this.pinnedIds.add(achievementId);
    }

    try {
      const callFn = await getCallFn();
      if (callFn) {
        const res = await callFn('toggle_pin', achievementId);
        const data = res && res.result ? res.result : res;
        if (data && data.achievement_id) {
          return data;
        }
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
