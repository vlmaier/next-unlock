import { Game, RankedAchievements, Achievement, AchievementSet, RarityTier, ProgressInfo } from '../types/achievement';
import { MockSteamClientService } from './mockSteamClient';

declare const process: any;

const STORAGE_KEYS = {
  GAMES_LIST: 'next_unlock_games_list_v2',
  PINS: 'next_unlock_pins_v2',
  LAST_APPID: 'next_unlock_last_appid_v2',
  GAME_PREFIX: 'next_unlock_cache_v2_',
};

export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), timeoutMs)),
  ]);
}

let _callFn: ((...args: any[]) => Promise<any>) | null = null;
let _pinsHydratedFromBackend = false;

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

export function __setCallFn(fn: ((...args: any[]) => Promise<any>) | null) {
  _callFn = fn;
  _pinsHydratedFromBackend = false;
}

let _lastActiveApp: { appid: number; name: string } | null = null;
let _cachedGames: { data: Game[]; timestamp: number } | null = null;
let _lastSelectedAppId: number | 'all' | null = null;

function getStorageSafe(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {}
  return null;
}

export function getActiveApp(): { appid: number; name: string } | null {
  if (typeof window === 'undefined') return _lastActiveApp;
  const w = window as any;
  const router = w.Router || w.DFL?.Router || w.DeckyPluginLoader?.Router;
  const running = router?.MainRunningApp || router?.RunningApps?.[0];
  if (running && running.appid) {
    const id = typeof running.appid === 'number' ? running.appid : parseInt(running.appid, 10);
    if (!isNaN(id) && id > 0) {
      _lastActiveApp = {
        appid: id,
        name: running.display_name || running.name || `App ${id}`,
      };
      return _lastActiveApp;
    }
  }
  return _lastActiveApp;
}

export async function getActiveAppAsync(): Promise<{ appid: number; name: string } | null> {
  const sync = getActiveApp();
  if (sync) return sync;
  try {
    const callFn = await getCallFn();
    if (callFn) {
      const res = await withTimeout(callFn('get_active_app'), 2000, null);
      const data = res && res.result !== undefined ? res.result : res;
      if (data && data.appid) {
        _lastActiveApp = {
          appid: Number(data.appid),
          name: data.name || `App ${data.appid}`,
        };
        return _lastActiveApp;
      }
      if (data === null) {
        _lastActiveApp = null;
        return null;
      }
    }
  } catch {}
  return _lastActiveApp;
}

export function getGameHeaderUrl(appid: number, providedUrl?: string): string {
  if (providedUrl && providedUrl.trim().length > 0) {
    return providedUrl;
  }
  return `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appid}/header.jpg`;
}

export function getAchievementGuideUrl(appid: number | undefined, achievementName: string): string {
  const trimmed = achievementName.trim();
  const query = encodeURIComponent(trimmed);
  // Only force English guide tag when the query itself is ASCII/English;
  // if a local non-English fallback title was used, omit language tag so search still finds guides.
  const hasNonAscii = /[^\x20-\x7E]/.test(trimmed);
  const langParams = hasNonAscii ? '' : '&requiredtags%5B%5D=English&l=english';
  if (appid && appid > 0) {
    return `https://steamcommunity.com/app/${appid}/guides/?searchText=${query}&browsesort=toprated&browsefilter=toprated${langParams}`;
  }
  return `https://steamcommunity.com/workshop/browse/?searchtext=${query}&section=guides${langParams}`;
}

export function openAchievementGuide(appid: number | undefined, achievementName: string): string {
  const url = getAchievementGuideUrl(appid, achievementName);
  if (typeof window !== 'undefined') {
    const w = window as any;
    const nav = w.DFL?.Navigation || w.DeckyPluginLoader?.Navigation;
    if (typeof nav?.NavigateToExternalWeb === 'function') {
      nav.NavigateToExternalWeb(url);
      return url;
    }
    if (typeof w.SteamClient?.System?.OpenInSystemBrowser === 'function') {
      w.SteamClient.System.OpenInSystemBrowser(url);
      return url;
    }
    if (typeof window.open === 'function') {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }
  return url;
}

/**
 * Canonical progress ratio calculation (Spec 03).
 */
export function getProgressRatio(ach: Partial<Achievement>): number {
  if (ach.progress && ach.progress.max > 1 && ach.progress.current > 0) {
    return Math.min(1.0, Math.max(0.0, ach.progress.current / ach.progress.max));
  }
  return 0.0;
}

/**
 * Canonical recommendation score formula (Spec 03 - matches backend/recommendation.py):
 *   rec_score = round((ratio * 60.0) + (global_pct * 0.8) + visibility_bonus, 1)
 * Higher score = closer to completion and easier/more common to unlock next.
 */
export function computeRecommendationScore(ach: Partial<Achievement>): number {
  if (ach.unlocked || ach.archived || ach.is_unobtainable) return 0.0;

  const ratio = getProgressRatio(ach);
  const rawPct = typeof ach.global_percentage === 'number' ? ach.global_percentage : Number(ach.global_percentage) || 0;
  const globalPct = Math.min(100.0, Math.max(0.0, rawPct));
  const isHidden = Boolean(ach.hidden);
  const hasDesc = Boolean(ach.description && ach.description.trim().length > 0);
  const visibilityBonus = !isHidden && hasDesc ? 15.0 : 0.0;

  const score = ratio * 60.0 + globalPct * 0.8 + visibilityBonus;
  return Math.round(score * 10) / 10;
}

/**
 * Computes per-set progress (`total_achievements`, `unlocked_count`, `completion_percentage`)
 * for Steam's Achievement Sets (`schema_v2` `groups`).
 */
export function computeAchievementSets(
  achievements: Achievement[],
  rawSets?: Partial<AchievementSet>[]
): AchievementSet[] {
  const setsById = new Map<number, AchievementSet>();
  const orderedIds: number[] = [];

  if (Array.isArray(rawSets)) {
    rawSets.forEach((rs) => {
      const sid = typeof rs.id === 'number' ? rs.id : 0;
      const sname = (rs.name || '').trim() || 'Base Game';
      const entry: AchievementSet = {
        id: sid,
        name: sname,
        total_achievements: 0,
        unlocked_count: 0,
        completion_percentage: 0,
      };
      if (rs.dlc_appid && rs.dlc_appid > 0) entry.dlc_appid = rs.dlc_appid;
      if (rs.archived) entry.archived = true;
      if (rs.header_image) {
        entry.header_image = rs.header_image;
      } else if (rs.dlc_appid && rs.dlc_appid > 0) {
        entry.header_image = `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${rs.dlc_appid}/header.jpg`;
      }
      setsById.set(sid, entry);
      orderedIds.push(sid);
    });
  }

  achievements.forEach((ach) => {
    const sid = typeof ach.set_id === 'number' ? ach.set_id : 0;
    if (!setsById.has(sid)) {
      const sname = (ach.set_name || '').trim() || 'Base Game';
      const entry: AchievementSet = {
        id: sid,
        name: sname,
        total_achievements: 0,
        unlocked_count: 0,
        completion_percentage: 0,
      };
      if (ach.dlc_appid && ach.dlc_appid > 0) {
        entry.dlc_appid = ach.dlc_appid;
        entry.header_image = `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${ach.dlc_appid}/header.jpg`;
      }
      if (ach.archived) entry.archived = true;
      setsById.set(sid, entry);
      orderedIds.push(sid);
    }
    const sEntry = setsById.get(sid)!;
    sEntry.total_achievements += 1;
    if (ach.unlocked) sEntry.unlocked_count += 1;
  });

  const result: AchievementSet[] = [];
  orderedIds.forEach((sid) => {
    const sEntry = setsById.get(sid)!;
    if (sEntry.total_achievements === 0) return;
    sEntry.completion_percentage =
      Math.round((sEntry.unlocked_count / sEntry.total_achievements) * 1000) / 10;
    result.push(sEntry);
  });
  return result;
}

/**
 * Canonical achievement ranking into categories (Spec 03 - matches backend/recommendation.py).
 */
export function rankAchievements(achievements: Achievement[], pinnedSet: Set<string>): RankedAchievements {
  const pinned: Achievement[] = [];
  const almost_there: Achievement[] = [];
  const easy_grabs: Achievement[] = [];
  const missable: Achievement[] = [];
  const locked: Achievement[] = [];
  const unlocked: Achievement[] = [];
  const seenIds = new Set<string>();

  achievements.forEach((rawAch) => {
    const achId = rawAch.id || '';
    if (achId && seenIds.has(achId)) return;
    if (achId) seenIds.add(achId);
    const ach: Achievement = { ...rawAch };
    const isPinned = pinnedSet.has(ach.id);
    ach.is_pinned = isPinned;

    if (ach.unlocked) {
      ach.rec_score = 0.0;
      unlocked.push(ach);
      return;
    }

    const score = computeRecommendationScore(ach);
    ach.rec_score = score;
    if (ach.category === 'Missable') {
      ach.is_missable = true;
    }
    const ratio = getProgressRatio(ach);
    const globalPct = ach.global_percentage || 0;
    const isArchived = Boolean(ach.archived || ach.is_unobtainable);

    locked.push(ach);
    if (isPinned) pinned.push(ach);
    if (!isArchived && ratio >= 0.5) almost_there.push(ach);
    if (!isArchived && globalPct >= 25.0 && (!ach.hidden || ratio > 0)) easy_grabs.push(ach);
    if (ach.is_missable || ach.category === 'Missable' || ach.hidden || globalPct <= 10.0) {
      missable.push(ach);
    }
  });

  const lockedSort = (a: Achievement, b: Achievement) => {
    const scoreDiff = (b.rec_score || 0) - (a.rec_score || 0);
    if (scoreDiff !== 0) return scoreDiff;
    const pctDiff = (b.global_percentage || 0) - (a.global_percentage || 0);
    if (pctDiff !== 0) return pctDiff;
    return (a.name || '').localeCompare(b.name || '');
  };

  const missableSort = (a: Achievement, b: Achievement) => {
    const aExp = a.is_missable || a.category === 'Missable' ? 0 : 1;
    const bExp = b.is_missable || b.category === 'Missable' ? 0 : 1;
    if (aExp !== bExp) return aExp - bExp;
    return lockedSort(a, b);
  };

  locked.sort(lockedSort);
  pinned.sort(lockedSort);
  almost_there.sort((a, b) => getProgressRatio(b) - getProgressRatio(a) || lockedSort(a, b));
  easy_grabs.sort((a, b) => (b.global_percentage || 0) - (a.global_percentage || 0) || (a.name || '').localeCompare(b.name || ''));
  missable.sort(missableSort);
  unlocked.sort((a, b) => (b.unlock_time || 0) - (a.unlock_time || 0) || (a.global_percentage || 0) - (b.global_percentage || 0));

  const nonArchivedLocked = locked.filter((a) => !a.archived && !a.is_unobtainable);
  const actionableLocked = nonArchivedLocked.filter(
    (a) => !a.hidden || getProgressRatio(a) > 0
  );
  const upNextSource = actionableLocked.length > 0 ? actionableLocked : nonArchivedLocked;

  return {
    pinned,
    up_next: upNextSource.slice(0, 5),
    almost_there,
    easy_grabs,
    missable,
    locked,
    unlocked,
  };
}

function formatSteamAchievement(ach: any, appid: number): Achievement {
  const flAchieved =
    typeof ach.flAchieved === 'number'
      ? ach.flAchieved
      : parseFloat(ach.flAchieved) || 0;
  const isUnlocked = !!(ach.bAchieved || ach.unlocked);
  const pct = Math.round(flAchieved * 10) / 10;
  const rarity: RarityTier = pct <= 5.0 ? 'ultra_rare' : pct <= 15.0 ? 'rare' : 'common';

  let iconUrl = ach.strImage || ach.icon || '';
  if (iconUrl && !iconUrl.startsWith('http://') && !iconUrl.startsWith('https://')) {
    iconUrl = `https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/${appid}/${iconUrl}`;
  }

  let progress: ProgressInfo | undefined = undefined;
  if (ach.flMaxProgress && ach.flMaxProgress > 1) {
    progress = {
      current: ach.flCurrentProgress || 0,
      max: ach.flMaxProgress,
    };
  }

  const name = ach.strName || ach.name || 'Achievement';
  const desc = ach.strDescription || ach.description || '';

  const formatted: Achievement = {
    id: ach.strID || ach.id || `ach_${name.toLowerCase().replace(/[^a-z0-9_]+/g, '_')}`,
    name,
    description: desc,
    icon: iconUrl,
    unlocked: isUnlocked,
    unlock_time: ach.rtUnlocked || ach.unlock_time || null,
    global_percentage: pct,
    rarity_tier: rarity,
    hidden: !!ach.bHidden,
    progress,
  };
  formatted.rec_score = computeRecommendationScore(formatted);
  return formatted;
}

const IGNORED_STEAM_APP_IDS = new Set<number>([
  228980, 1070560, 1391110, 1628350, 1493710, 1580130, 1161040, 1826330, 2180100, 2348590, 2805730,
  1887720, 1420170, 250820,
]);

const IGNORED_STEAM_NAME_SUBSTRINGS = [
  'proton ',
  'steam linux runtime',
  'steamworks common',
  'steam controller',
  'steamvr',
  'soundtrack',
];

function getNativeSteamLibraryApps(): Game[] {
  if (typeof window === 'undefined') return [];
  try {
    const w = window as any;
    let rawApps: any[] = [];
    if (Array.isArray(w.collectionStore?.allAppsCollection?.allApps)) {
      rawApps = w.collectionStore.allAppsCollection.allApps;
    } else if (w.appStore?.m_mapApps && typeof w.appStore.m_mapApps.values === 'function') {
      rawApps = Array.from(w.appStore.m_mapApps.values());
    }
    if (!rawApps.length) return [];

    const filtered: Array<{ game: Game; installed: boolean; lastPlayed: number }> = [];
    const seen = new Set<number>();
    for (const app of rawApps) {
      const appid = Number(app?.appid);
      const name = typeof app?.display_name === 'string' ? app.display_name.trim() : '';
      if (!appid || appid <= 0 || !name || seen.has(appid)) continue;
      // EAppType.Game === 1 (skip tools, Proton, DLCs, demos, videos when app_type is known)
      if (app.app_type !== undefined && app.app_type !== 1) continue;
      if (IGNORED_STEAM_APP_IDS.has(appid)) continue;
      const lower = name.toLowerCase();
      if (IGNORED_STEAM_NAME_SUBSTRINGS.some((sub) => lower.includes(sub))) continue;
      seen.add(appid);
      filtered.push({
        game: {
          appid,
          name,
          header_image: getGameHeaderUrl(appid),
          total_achievements: 0,
          unlocked_count: 0,
          completion_percentage: 0,
          achievements: [],
        },
        installed: Boolean(app.installed),
        lastPlayed: Number(app.rt_last_time_played) || 0,
      });
    }

    filtered.sort((a, b) => {
      if (a.installed !== b.installed) return a.installed ? -1 : 1;
      if (b.lastPlayed !== a.lastPlayed) return b.lastPlayed - a.lastPlayed;
      return a.game.name.localeCompare(b.game.name);
    });
    return filtered.map((entry) => entry.game);
  } catch {
    return [];
  }
}

export class SteamApiService {
  private static pinnedIds = new Set<string>();
  private static detailsCache = new Map<number, { game: Game; ranked: RankedAchievements; ts: number }>();

  private static loadPinsFromStorage() {
    const storage = getStorageSafe();
    if (!storage) return;
    try {
      const raw = storage.getItem(STORAGE_KEYS.PINS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsed.forEach((id) => {
            if (typeof id === 'string') this.pinnedIds.add(id);
          });
        }
      }
    } catch {}
  }

  private static savePinsToStorage() {
    const storage = getStorageSafe();
    if (!storage) return;
    try {
      storage.setItem(STORAGE_KEYS.PINS, JSON.stringify(Array.from(this.pinnedIds)));
    } catch {}
  }

  private static async ensurePinsHydrated() {
    this.loadPinsFromStorage();
    if (_pinsHydratedFromBackend) return;
    try {
      const callFn = await getCallFn();
      if (callFn) {
        const res = await withTimeout(callFn('get_pinned'), 1500, null);
        const data = res && res.result !== undefined ? res.result : res;
        if (Array.isArray(data)) {
          data.forEach((id: any) => {
            if (typeof id === 'string') this.pinnedIds.add(id);
          });
          this.savePinsToStorage();
          _pinsHydratedFromBackend = true;
          return;
        }
      }
    } catch {}

    const isTestOrHarness =
      (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') ||
      (typeof window !== 'undefined' && (window as any).__NEXT_UNLOCK_TEST_HARNESS__);
    if (isTestOrHarness) {
      MockSteamClientService.getPinned().forEach((id) => this.pinnedIds.add(id));
      this.savePinsToStorage();
      _pinsHydratedFromBackend = true;
    }
  }

  /**
   * Synchronous access to last selected AppID so UI restores user's selection immediately on mount.
   */
  static getLastSelectedAppId(): number | 'all' | null {
    if (_lastSelectedAppId !== null) return _lastSelectedAppId;
    const storage = getStorageSafe();
    if (storage) {
      try {
        const raw = storage.getItem(STORAGE_KEYS.LAST_APPID);
        if (raw === 'all') {
          _lastSelectedAppId = 'all';
          return 'all';
        }
        if (raw) {
          const num = parseInt(raw, 10);
          if (!isNaN(num) && num > 0) {
            _lastSelectedAppId = num;
            return num;
          }
        }
      } catch {}
    }
    return null;
  }

  static setLastSelectedAppId(appid: number | 'all') {
    _lastSelectedAppId = appid;
    const storage = getStorageSafe();
    if (storage) {
      try {
        storage.setItem(STORAGE_KEYS.LAST_APPID, String(appid));
      } catch {}
    }
  }

  /**
   * Synchronous access to cached games list for 0ms mount without spinner flash.
   */
  static getCachedGamesSync(): Game[] {
    if (_cachedGames && _cachedGames.data.length > 0) {
      return _cachedGames.data;
    }
    const storage = getStorageSafe();
    if (storage) {
      try {
        const raw = storage.getItem(STORAGE_KEYS.GAMES_LIST);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            _cachedGames = { data: parsed, timestamp: Date.now() - 15000 };
            return parsed;
          }
        }
      } catch {}
    }
    return [];
  }

  /**
   * Synchronous access to cached game details for 0ms mount without spinner flash.
   */
  static getCachedGameDetailsSync(appid: number): { game: Game; ranked: RankedAchievements } | null {
    this.loadPinsFromStorage();
    if (this.detailsCache.has(appid)) {
      const cached = this.detailsCache.get(appid)!;
      return { game: cached.game, ranked: cached.ranked };
    }
    const storage = getStorageSafe();
    if (storage) {
      try {
        const item = storage.getItem(`${STORAGE_KEYS.GAME_PREFIX}${appid}`);
        if (item) {
          const parsed = JSON.parse(item);
          if (parsed && parsed.game && parsed.ranked) {
            const ranked = rankAchievements(parsed.game.achievements || [], this.pinnedIds);
            const entry = {
              game: { ...parsed.game, achievements: [...ranked.locked, ...ranked.unlocked] },
              ranked,
              ts: parsed.ts || Date.now(),
            };
            this.detailsCache.set(appid, entry);
            return { game: entry.game, ranked: entry.ranked };
          }
        }
      } catch {}
    }
    return null;
  }

  static async getGames(forceRefresh = false): Promise<Game[]> {
    const now = Date.now();
    if (!forceRefresh && _cachedGames && now - _cachedGames.timestamp < 30000) {
      return _cachedGames.data;
    }

    await this.ensurePinsHydrated();
    const nativeLibrary = getNativeSteamLibraryApps();

    try {
      const callFn = await getCallFn();
      if (callFn) {
        const res = await withTimeout(
          forceRefresh ? callFn('get_games', true) : callFn('get_games'),
          15000,
          null
        );
        const data = res && res.result !== undefined ? res.result : res;
        if (Array.isArray(data) && (data.length > 0 || nativeLibrary.length > 0)) {
          const active = await getActiveAppAsync();
          const merged: Game[] = [...data];
          const seenIds = new Set<number>(merged.map((g) => g.appid));
          if (active && !seenIds.has(active.appid)) {
            seenIds.add(active.appid);
            merged.unshift({
              appid: active.appid,
              name: active.name,
              header_image: getGameHeaderUrl(active.appid),
              total_achievements: 0,
              unlocked_count: 0,
              completion_percentage: 0,
              achievements: [],
            });
          }
          for (const owned of nativeLibrary) {
            if (!seenIds.has(owned.appid)) {
              seenIds.add(owned.appid);
              merged.push(owned);
            }
          }
          // Enrich any game whose details are already in memory cache
          const enriched = merged.map((g: Game) => {
            const cachedDetail = this.detailsCache.get(g.appid);
            if (cachedDetail && cachedDetail.game.total_achievements > 0) {
              return {
                ...g,
                header_image: cachedDetail.game.header_image || g.header_image,
                total_achievements: cachedDetail.game.total_achievements,
                unlocked_count: cachedDetail.game.unlocked_count,
                completion_percentage: cachedDetail.game.completion_percentage,
                achievements: cachedDetail.game.achievements,
                achievement_sets: cachedDetail.game.achievement_sets || g.achievement_sets,
              };
            }
            return g;
          });
          this.saveGamesCache(enriched, now);
          return enriched;
        }
      }
    } catch (e) {
      console.warn('[Next Unlock] RPC get_games error:', e);
    }

    const active = await getActiveAppAsync();
    if (active || nativeLibrary.length > 0) {
      const mergedFallback: Game[] = [];
      const seenFallback = new Set<number>();
      if (active) {
        seenFallback.add(active.appid);
        mergedFallback.push({
          appid: active.appid,
          name: active.name,
          header_image: getGameHeaderUrl(active.appid),
          total_achievements: 0,
          unlocked_count: 0,
          completion_percentage: 0,
          achievements: [],
        });
      }
      for (const owned of nativeLibrary) {
        if (!seenFallback.has(owned.appid)) {
          seenFallback.add(owned.appid);
          mergedFallback.push(owned);
        }
      }
      this.saveGamesCache(mergedFallback, now);
      return mergedFallback;
    }

    const isTestOrHarness =
      (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') ||
      (typeof window !== 'undefined' && (window as any).__NEXT_UNLOCK_TEST_HARNESS__);

    if (isTestOrHarness) {
      const mockList = await MockSteamClientService.getGames();
      this.saveGamesCache(mockList, now);
      return mockList;
    }

    const previouslyCached = this.getCachedGamesSync();
    if (previouslyCached.length > 0) {
      return previouslyCached;
    }

    return [];
  }

  private static saveGamesCache(data: Game[], timestamp: number) {
    _cachedGames = { data, timestamp };
    const storage = getStorageSafe();
    if (storage) {
      try {
        storage.setItem(STORAGE_KEYS.GAMES_LIST, JSON.stringify(data));
      } catch {}
    }
  }

  static async getGameDetails(
    appid: number,
    forceRefresh = false
  ): Promise<{ game: Game; ranked: RankedAchievements }> {
    const now = Date.now();
    await this.ensurePinsHydrated();

    // 1. Check in-memory cache first when not force-refreshing
    if (!forceRefresh && this.detailsCache.has(appid)) {
      const cached = this.detailsCache.get(appid)!;
      if (now - cached.ts > 45000) {
        this.fetchAndCacheGameDetails(appid, false).catch(() => {});
      }
      return { game: cached.game, ranked: cached.ranked };
    }

    // 2. Check localStorage cache when not force-refreshing
    if (!forceRefresh) {
      const syncCached = this.getCachedGameDetailsSync(appid);
      if (syncCached) {
        this.fetchAndCacheGameDetails(appid, false).catch(() => {});
        return syncCached;
      }
    }

    return this.fetchAndCacheGameDetails(appid, forceRefresh);
  }

  /**
   * Loads details for all games in the list (used by "All Games Overview" mode)
   * so cross-library filtering works across the user's installed games.
   */
  static async getAllGamesDetails(
    games: Game[],
    forceRefresh = false,
    onProgress?: (completed: number, total: number) => void
  ): Promise<Game[]> {
    const total = games.length;
    if (total === 0) return games;

    const resultsByAppId = new Map<number, Game>();
    let completed = 0;
    const batchSize = 4;

    for (let i = 0; i < games.length; i += batchSize) {
      const batch = games.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (g) => {
          try {
            const det = await this.getGameDetails(g.appid, forceRefresh);
            resultsByAppId.set(g.appid, det.game);
          } catch {
            resultsByAppId.set(g.appid, g);
          } finally {
            completed += 1;
            onProgress?.(completed, total);
          }
        })
      );
    }

    return games.map((g) => resultsByAppId.get(g.appid) || g);
  }

  private static async queryNativeSteamClient(
    appid: number
  ): Promise<{
    nativeAchievements: any[] | null;
    userUnlockMap: Record<string, { unlocked: boolean; unlock_time?: number | null; progress?: ProgressInfo }>;
  }> {
    let nativeAchievements: any[] | null = null;
    const userUnlockMap: Record<
      string,
      { unlocked: boolean; unlock_time?: number | null; progress?: ProgressInfo }
    > = {};

    if (typeof window === 'undefined') {
      return { nativeAchievements, userUnlockMap };
    }

    const w = window as any;
    const seenNativeKeys = new Set<string>();
    const ingestList = (rawList: any[]) => {
      if (!Array.isArray(rawList) || rawList.length === 0) return;
      if (!nativeAchievements) nativeAchievements = [];
      rawList.forEach((a: any) => {
        if (!a || typeof a !== 'object') return;
        const dedupeKey = String(a.strID || a.id || a.strName || '').trim().toLowerCase();
        if (dedupeKey) {
          if (seenNativeKeys.has(dedupeKey)) return;
          seenNativeKeys.add(dedupeKey);
        }
        nativeAchievements!.push(a);
        const isAchieved = !!(a.bAchieved || a.unlocked);
        const progress: ProgressInfo | undefined =
          a.flMaxProgress && a.flMaxProgress > 1
            ? { current: a.flCurrentProgress || 0, max: a.flMaxProgress }
            : undefined;
        const entry = {
          unlocked: isAchieved,
          unlock_time: a.rtUnlocked || a.unlock_time || null,
          progress,
        };
        if (a.strID) userUnlockMap[a.strID] = entry;
        if (a.id) userUnlockMap[a.id] = entry;
        if (a.strName) {
          const norm = `ach_${a.strName.toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_|_$/g, '')}`;
          userUnlockMap[norm] = entry;
        }
      });
    };

    // 1a. Check SteamOS Gaming Mode in-memory appDetailsStore (instantaneous, works without running game)
    try {
      const storeAch =
        w.appDetailsStore?.GetAchievements?.(appid) ||
        w.appDetailsStore?.GetAppDetails?.(appid)?.achievements;
      if (storeAch) {
        const inner = storeAch.data || storeAch;
        if (Array.isArray(inner.rgAchievements)) ingestList(inner.rgAchievements);
        if (Array.isArray(inner.vecHighlight)) {
          ingestList(inner.vecHighlight.map((x: any) => ({ ...x, bAchieved: true })));
        }
        if (Array.isArray(inner.vecAchievedHidden)) {
          ingestList(inner.vecAchievedHidden.map((x: any) => ({ ...x, bAchieved: true })));
        }
        if (Array.isArray(inner.vecUnachieved)) {
          ingestList(inner.vecUnachieved.map((x: any) => ({ ...x, bAchieved: false })));
        }
      }
    } catch {}

    // 1b. Query SteamClient.Apps.GetMyAchievementsForApp (try numeric appid then string appid)
    if (typeof w.SteamClient?.Apps?.GetMyAchievementsForApp === 'function') {
      try {
        let res = await withTimeout(
          Promise.resolve(w.SteamClient.Apps.GetMyAchievementsForApp(appid)),
          1800,
          null
        );
        let rawList = res?.data?.rgAchievements || res?.rgAchievements;
        if (!Array.isArray(rawList) || rawList.length === 0) {
          res = await withTimeout(
            Promise.resolve(w.SteamClient.Apps.GetMyAchievementsForApp(String(appid))),
            1800,
            null
          );
          rawList = res?.data?.rgAchievements || res?.rgAchievements;
        }
        if (Array.isArray(rawList) && rawList.length > 0) {
          ingestList(rawList);
        }
      } catch (clientErr) {
        console.warn('[Next Unlock] SteamClient.Apps.GetMyAchievementsForApp error:', clientErr);
      }
    }

    return { nativeAchievements, userUnlockMap };
  }

  private static async fetchAndCacheGameDetails(
    appid: number,
    forceRefresh = false
  ): Promise<{ game: Game; ranked: RankedAchievements }> {
    const now = Date.now();
    const callFn = await getCallFn();

    // Run native SteamClient/appDetailsStore query and Decky RPC backend query IN PARALLEL
    const [nativeRes, backendDetails] = await Promise.all([
      this.queryNativeSteamClient(appid),
      (async (): Promise<{ game: Game; ranked: RankedAchievements } | null> => {
        if (!callFn) return null;
        try {
          const res = await withTimeout(
            forceRefresh ? callFn('get_game_details', appid, true) : callFn('get_game_details', appid),
            12000,
            null
          );
          const data = res && res.result !== undefined ? res.result : res;
          if (data && data.game) {
            return data;
          }
        } catch (e) {
          console.warn('[Next Unlock] RPC get_game_details error:', e);
        }
        return null;
      })(),
    ]);

    const { nativeAchievements, userUnlockMap } = nativeRes;

    // 3. Merge live native user unlock state with backend data
    if (backendDetails && backendDetails.game && backendDetails.game.achievements.length > 0) {
      const unlockedIdsToSync: string[] = [];
      const achievements: Achievement[] = backendDetails.game.achievements.map((a) => {
        let isUnlocked = a.unlocked;
        let unlockTime = a.unlock_time;
        let progress = a.progress;

        const norm = a.name
          ? `ach_${a.name.toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_|_$/g, '')}`
          : '';
        const match = userUnlockMap[a.id] || (norm ? userUnlockMap[norm] : undefined);

        if (match !== undefined) {
          isUnlocked = match.unlocked;
          if (match.unlock_time) unlockTime = match.unlock_time;
          if (match.progress) progress = match.progress;
        }

        if (isUnlocked) unlockedIdsToSync.push(a.id);

        const merged: Achievement = {
          ...a,
          unlocked: isUnlocked,
          unlock_time: unlockTime,
          progress,
        };
        merged.rec_score = computeRecommendationScore(merged);
        return merged;
      });

      // Persist discovered native unlocks to backend so they are remembered when game is closed
      if (nativeAchievements && callFn && unlockedIdsToSync.length > 0) {
        callFn('sync_unlocked_achievements', appid, unlockedIdsToSync).catch(() => {});
      }

      const ranked = rankAchievements(achievements, this.pinnedIds);
      const allSorted = [...ranked.locked, ...ranked.unlocked];
      const total = allSorted.length;
      const unlockedCount = ranked.unlocked.length;
      const pct = total > 0 ? Math.round((unlockedCount / total) * 1000) / 10 : 0;

      const mergedGame: Game = {
        ...backendDetails.game,
        header_image: getGameHeaderUrl(appid, backendDetails.game.header_image),
        total_achievements: total,
        unlocked_count: unlockedCount,
        completion_percentage: pct,
        achievements: allSorted,
        achievement_sets: computeAchievementSets(allSorted, backendDetails.game.achievement_sets),
      };

      const result = { game: mergedGame, ranked };
      this.cacheResult(appid, result, now);
      return result;
    }

    // 4. If only native SteamClient was available, build directly from it
    if (nativeAchievements && nativeAchievements.length > 0) {
      const achievements = nativeAchievements.map((a: any) => formatSteamAchievement(a, appid));
      const ranked = rankAchievements(achievements, this.pinnedIds);
      const allSorted = [...ranked.locked, ...ranked.unlocked];
      const total = allSorted.length;
      const unlockedCount = ranked.unlocked.length;
      const pct = total > 0 ? Math.round((unlockedCount / total) * 1000) / 10 : 0;
      const active = await getActiveAppAsync();
      const knownGame = _cachedGames?.data.find((g) => g.appid === appid);
      const gameName = knownGame?.name || (active && active.appid === appid ? active.name : `App ${appid}`);

      const game: Game = {
        appid,
        name: gameName,
        header_image: getGameHeaderUrl(appid),
        total_achievements: total,
        unlocked_count: unlockedCount,
        completion_percentage: pct,
        achievements: allSorted,
      };

      const result = { game, ranked };
      this.cacheResult(appid, result, now);
      return result;
    }

    // 5. In test environment or test harness, fallback to MockSteamClientService if backend returned nothing
    const isTestMode =
      (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') ||
      (typeof window !== 'undefined' && (window as any).__NEXT_UNLOCK_TEST_HARNESS__);

    if (isTestMode && !backendDetails) {
      const mockDetails = await MockSteamClientService.getGameDetails(appid);
      if (mockDetails && mockDetails.game) {
        const ranked = rankAchievements(mockDetails.game.achievements, this.pinnedIds);
        const allSorted = [...ranked.locked, ...ranked.unlocked];
        const result = {
          game: {
            ...mockDetails.game,
            achievements: allSorted,
            achievement_sets: computeAchievementSets(allSorted, mockDetails.game.achievement_sets),
          },
          ranked,
        };
        this.cacheResult(appid, result, now);
        return result;
      }
    }

    // 6. Clean empty state for a game with 0 achievements (still returns the game metadata!)
    const active = await getActiveAppAsync();
    const knownGame = _cachedGames?.data.find((g) => g.appid === appid);
    const gameName =
      backendDetails?.game?.name ||
      knownGame?.name ||
      (active && active.appid === appid ? active.name : `App ${appid}`);

    const emptyResult: { game: Game; ranked: RankedAchievements } = {
      game: {
        appid,
        name: gameName,
        header_image: getGameHeaderUrl(appid, backendDetails?.game?.header_image),
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
    };
    this.cacheResult(appid, emptyResult, now);
    return emptyResult;
  }

  private static cacheResult(appid: number, result: { game: Game; ranked: RankedAchievements }, ts: number) {
    const safeGame: Game = { ...result.game, appid };
    const safeResult = { game: safeGame, ranked: result.ranked };
    this.detailsCache.set(appid, { ...safeResult, ts });
    if (_cachedGames) {
      const idx = _cachedGames.data.findIndex((g) => g.appid === appid);
      if (idx >= 0) {
        _cachedGames.data[idx] = {
          ..._cachedGames.data[idx],
          ...safeGame,
          appid,
        };
        this.saveGamesCache(_cachedGames.data, _cachedGames.timestamp);
      }
    }
    const storage = getStorageSafe();
    if (storage) {
      try {
        storage.setItem(`${STORAGE_KEYS.GAME_PREFIX}${appid}`, JSON.stringify({ ...safeResult, ts }));
      } catch {}
    }
  }

  /**
   * Re-computes `is_pinned` and `ranked` across all in-memory and localStorage cached games
   * immediately when a pin is toggled so UI updates in 0ms without stale cache bugs.
   */
  private static recomputeAllCachedPins() {
    const now = Date.now();
    for (const [appid, entry] of this.detailsCache.entries()) {
      const allAch = [...entry.ranked.locked, ...entry.ranked.unlocked];
      const ranked = rankAchievements(allAch, this.pinnedIds);
      const updatedGame: Game = {
        ...entry.game,
        achievements: [...ranked.locked, ...ranked.unlocked],
      };
      this.cacheResult(appid, { game: updatedGame, ranked }, now);
    }
    if (_cachedGames) {
      _cachedGames.data = _cachedGames.data.map((g) => {
        if (!g.achievements || g.achievements.length === 0) return g;
        const ranked = rankAchievements(g.achievements, this.pinnedIds);
        return {
          ...g,
          achievements: [...ranked.locked, ...ranked.unlocked],
        };
      });
      this.saveGamesCache(_cachedGames.data, _cachedGames.timestamp);
    }
  }

  static clearCache() {
    this.detailsCache.clear();
    this.pinnedIds.clear();
    _cachedGames = null;
    _lastActiveApp = null;
    _lastSelectedAppId = null;
    _pinsHydratedFromBackend = false;
    const storage = getStorageSafe();
    if (storage) {
      try {
        storage.clear();
      } catch {}
    }
  }

  static async togglePin(achievementId: string): Promise<{ achievement_id: string; pinned: boolean }> {
    this.loadPinsFromStorage();

    // Optimistically update local pin state and re-rank all cached games immediately
    const optimisticPinned = !this.pinnedIds.has(achievementId);
    if (optimisticPinned) {
      this.pinnedIds.add(achievementId);
    } else {
      this.pinnedIds.delete(achievementId);
    }
    this.savePinsToStorage();
    this.recomputeAllCachedPins();

    try {
      const callFn = await getCallFn();
      if (callFn) {
        const res = await callFn('toggle_pin', achievementId);
        const data = res && res.result !== undefined ? res.result : res;
        if (data && data.achievement_id) {
          if (data.pinned) {
            this.pinnedIds.add(achievementId);
          } else {
            this.pinnedIds.delete(achievementId);
          }
          this.savePinsToStorage();
          this.recomputeAllCachedPins();
          return data;
        }
      }
    } catch (e) {
      console.warn('[Next Unlock] RPC toggle_pin error, using local state:', e);
    }

    await MockSteamClientService.togglePin(achievementId).catch(() => {});
    return { achievement_id: achievementId, pinned: optimisticPinned };
  }

  static async unlockAchievement(appid: number, achievementId: string): Promise<boolean> {
    const res = await MockSteamClientService.unlockAchievement(appid, achievementId);
    this.detailsCache.delete(appid);
    return res;
  }
}

export function clearApiCache() {
  SteamApiService.clearCache();
}
