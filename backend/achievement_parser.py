"""
Steam Library Manifest Scanner, Active Game Detector & Local SteamOS Userdata Reader (Spec 01 & 02).

- Discovers all Steam installation roots (`~/.steam/steam`, `~/.local/share/Steam`, Flatpak, SD card mounts).
- Parses `libraryfolders.vdf` and `appmanifest_<appid>.acf` files.
- Filters out non-game runtimes (Proton, Steam Linux Runtime, Steamworks Common Redistributables, Decky).
- Reads local SteamOS `userdata/<userid>/config/librarycache/<appid>.json` for offline/non-running unlock & progress stats.
- Detects the currently running game via `/proc/<pid>/environ` `SteamAppId=` inspection.
"""

from __future__ import annotations

import glob
import json
import logging
import os
import re
import time
from collections.abc import Mapping

from backend.achievement_fetcher import load_cached_achievements
from backend.models import (
    AchievementData,
    AchievementProgress,
    GameData,
    LocalUserStatsEnvelope,
)
from backend.recommendation import compute_achievement_sets, compute_recommendation_score

logger = logging.getLogger("next_unlock.parser")

IGNORED_APP_IDS: set[int] = {
    228980,  # Steamworks Common Redistributables
    1070560,  # Steam Linux Runtime
    1391110,  # Steam Linux Runtime - Soldier
    1628350,  # Steam Linux Runtime - Sniper
    1493710,  # Proton Experimental
    1580130,  # Proton EasyAntiCheat Runtime
    1161040,  # Proton BattlEye Runtime
    1826330,  # Steam Linux Runtime - Medic
    2180100,  # Proton Hotfix
    2348590,  # Proton 8.0
    2805730,  # Proton 9.0
    1887720,  # Proton 7.0
    1420170,  # Proton 5.13
    250820,  # SteamVR
}

IGNORED_NAME_SUBSTRINGS: tuple[str, ...] = (
    "proton ",
    "steam linux runtime",
    "steamworks common",
    "steam controller",
    "steamvr",
    "soundtrack",
)


class _RunningAppCache:
    def __init__(self) -> None:
        self.val: int | None = None
        self.ts: float = 0.0


class _LibraryFoldersCache:
    def __init__(self) -> None:
        self.val: list[str] | None = None
        self.ts: float = 0.0


class _InstalledGamesCache:
    def __init__(self) -> None:
        self.val: list[GameData] | None = None
        self.ts: float = 0.0


_cached_running_app = _RunningAppCache()
_cached_library_folders = _LibraryFoldersCache()
_cached_installed_games = _InstalledGamesCache()


def clear_parser_caches() -> None:
    """Resets all in-memory parser caches for testing and explicit force refreshes."""
    _cached_running_app.val = None
    _cached_running_app.ts = 0.0
    _cached_library_folders.val = None
    _cached_library_folders.ts = 0.0
    _cached_installed_games.val = None
    _cached_installed_games.ts = 0.0


def find_all_steam_roots() -> list[str]:
    """Returns all existing Steam root directories on the system or test fixture override."""
    env_root = os.environ.get("NEXT_UNLOCK_STEAM_ROOT")
    if env_root:
        if os.path.isdir(env_root):
            return [os.path.realpath(env_root)]
        return []

    candidates = [
        os.path.expanduser("~/.steam/steam"),
        os.path.expanduser("~/.local/share/Steam"),
        "/home/deck/.steam/steam",
        "/home/deck/.local/share/Steam",
        os.path.expanduser("~/.var/app/com.valvesoftware.Steam/.local/share/Steam"),
        "/home/deck/.var/app/com.valvesoftware.Steam/.local/share/Steam",
    ]
    found: list[str] = []
    seen_real: set[str] = set()
    for path in candidates:
        if os.path.isdir(path):
            real = os.path.realpath(path)
            if real not in seen_real:
                seen_real.add(real)
                found.append(real)
    return found


def find_steam_path() -> str | None:
    roots = find_all_steam_roots()
    return roots[0] if roots else None


def parse_vdf_library_paths(content: str) -> list[str]:
    """Extracts all `"path"` values from a `libraryfolders.vdf` file content."""
    matches = re.findall(r'"path"\s+"([^"]+)"', content, re.IGNORECASE)
    return [m.replace("\\\\", "\\") for m in matches if m.strip()]


def get_library_folders(force_refresh: bool = False) -> list[str]:
    """Discovers all `steamapps` directories across internal storage and mounted SD cards."""
    now = time.time()
    if (
        not force_refresh
        and _cached_library_folders.val is not None
        and (now - _cached_library_folders.ts < 60)
    ):
        return list(_cached_library_folders.val)

    roots = find_all_steam_roots()
    folders: list[str] = []
    seen: set[str] = set()

    def add_folder(p: str) -> None:
        if os.path.isdir(p):
            real = os.path.realpath(p)
            if real not in seen:
                seen.add(real)
                folders.append(real)

    for root in roots:
        primary_steamapps = os.path.join(root, "steamapps")
        add_folder(primary_steamapps)

        vdf_candidates = [
            os.path.join(primary_steamapps, "libraryfolders.vdf"),
            os.path.join(root, "config", "libraryfolders.vdf"),
        ]
        for vdf_path in vdf_candidates:
            if os.path.isfile(vdf_path):
                try:
                    with open(vdf_path, encoding="utf-8", errors="ignore") as f:
                        paths = parse_vdf_library_paths(f.read())
                        for p in paths:
                            add_folder(os.path.join(p, "steamapps"))
                except Exception as e:
                    logger.debug(f"Failed reading {vdf_path}: {e}")

    if not os.environ.get("NEXT_UNLOCK_STEAM_ROOT"):
        for sd_steamapps in glob.glob("/run/media/**/steamapps", recursive=True):
            add_folder(sd_steamapps)

    _cached_library_folders.val = folders
    _cached_library_folders.ts = now
    return folders


def _extract_achievements_section(raw_data: object) -> Mapping[str, object] | None:
    """
    Extracts the `achievements` data payload from a SteamOS `librarycache/<appid>.json` file.
    SteamOS stores either:
      - A list of `[key, {"version": ..., "data": {...}}]` pairs, or
      - A dict with `"achievements": {"data": {...}}` or direct `{"vecHighlight": ...}`.
    """
    if isinstance(raw_data, list):
        for entry in raw_data:
            if (
                isinstance(entry, (list, tuple))
                and len(entry) >= 2
                and entry[0] == "achievements"
                and isinstance(entry[1], Mapping)
            ):
                inner = entry[1].get("data", entry[1])
                if isinstance(inner, Mapping):
                    return inner
    elif isinstance(raw_data, Mapping):
        if "achievements" in raw_data and isinstance(raw_data["achievements"], Mapping):
            ach_obj = raw_data["achievements"]
            inner = ach_obj.get("data", ach_obj)
            if isinstance(inner, Mapping):
                return inner
        if any(k in raw_data for k in ("vecHighlight", "vecUnachieved", "vecAchieved", "nTotal")):
            return raw_data
    return None


def _format_librarycache_ach(
    item: Mapping[str, object],
    appid: int,
    unlocked_default: bool,
) -> AchievementData:
    name = str(item.get("strName") or item.get("name") or "Achievement").strip()
    desc = str(item.get("strDescription") or item.get("description") or "").strip()
    raw_id = str(item.get("strID") or item.get("id") or "").strip()
    if not raw_id:
        slug = re.sub(r"[^a-z0-9_]+", "_", name.lower()).strip("_") or "item"
        raw_id = f"ach_{slug}"

    raw_pct = item.get("flAchieved", item.get("global_percentage", 0.0))
    try:
        pct = round(float(raw_pct), 1) if isinstance(raw_pct, (int, float, str)) else 0.0
    except (TypeError, ValueError):
        pct = 0.0

    is_unlocked = bool(item.get("bAchieved", unlocked_default))
    icon = str(item.get("strImage") or item.get("icon") or "").strip()
    if icon and not icon.startswith("http"):
        icon = (
            f"https://cdn.fastly.steamstatic.com/steamcommunity/public/images/apps/{appid}/{icon}"
        )

    raw_ut = item.get("rtUnlocked") or item.get("unlock_time")
    unlock_time = int(raw_ut) if isinstance(raw_ut, (int, float)) and int(raw_ut) > 0 else None

    rarity = "ultra_rare" if pct <= 5.0 else "rare" if pct <= 15.0 else "common"
    ach: AchievementData = {
        "id": raw_id,
        "name": name,
        "description": desc,
        "icon": icon,
        "unlocked": is_unlocked,
        "unlock_time": unlock_time,
        "global_percentage": pct,
        "rarity_tier": rarity,
        "hidden": bool(item.get("bHidden", False)),
    }

    raw_max = item.get("flMaxProgress", 0)
    raw_cur = item.get("flCurrentProgress", 0)
    max_prog = float(raw_max) if isinstance(raw_max, (int, float, str)) else 0.0
    cur_prog = float(raw_cur) if isinstance(raw_cur, (int, float, str)) else 0.0
    if max_prog > 1:
        ach["progress"] = {"current": cur_prog, "max": max_prog}

    ach["rec_score"] = compute_recommendation_score(ach)
    return ach


def parse_local_user_stats(appid: int) -> LocalUserStatsEnvelope:
    """
    Reads SteamOS local `userdata/<userid>/config/librarycache/<appid>.json` files.
    """
    appid_int = int(appid)
    roots = find_all_steam_roots()

    best_data: Mapping[str, object] | None = None
    best_mtime = -1.0

    for root in roots:
        pattern = os.path.join(root, "userdata", "*", "config", "librarycache", f"{appid_int}.json")
        for candidate in glob.glob(pattern):
            try:
                mtime = os.path.getmtime(candidate)
                with open(candidate, encoding="utf-8", errors="ignore") as f:
                    raw: object = json.load(f)
                section = _extract_achievements_section(raw)
                if section and mtime >= best_mtime:
                    best_data = section
                    best_mtime = mtime
            except Exception:
                continue

    if not best_data:
        return {
            "appid": appid_int,
            "cached": False,
            "total": 0,
            "unlocked_count": 0,
            "achievements": [],
            "unlocked_by_id": {},
            "unlocked_by_name": {},
            "progress_by_name": {},
        }

    unlocked_by_id: dict[str, AchievementData] = {}
    unlocked_by_name: dict[str, AchievementData] = {}
    progress_by_name: dict[str, AchievementProgress] = {}
    achievements_by_key: dict[str, AchievementData] = {}

    for key_name in ("vecAchieved", "vecHighlight"):
        arr = best_data.get(key_name)
        if isinstance(arr, list):
            for raw_item in arr:
                if not isinstance(raw_item, Mapping):
                    continue
                ach = _format_librarycache_ach(raw_item, appid_int, unlocked_default=True)
                if ach["unlocked"]:
                    unlocked_by_id[ach["id"]] = ach
                    unlocked_by_name[ach["name"].lower()] = ach
                achievements_by_key[ach["name"].lower() or ach["id"]] = ach

    unachieved_arr = best_data.get("vecUnachieved")
    if isinstance(unachieved_arr, list):
        for raw_item in unachieved_arr:
            if not isinstance(raw_item, Mapping):
                continue
            ach = _format_librarycache_ach(raw_item, appid_int, unlocked_default=False)
            prog = ach.get("progress")
            if prog:
                progress_by_name[ach["name"].lower()] = prog
            k = ach["name"].lower() or ach["id"]
            if k not in achievements_by_key:
                achievements_by_key[k] = ach

    ach_list = list(achievements_by_key.values())
    raw_ntotal = best_data.get("nTotal", 0)
    raw_nach = best_data.get("nAchieved", 0)
    n_total = int(raw_ntotal) if isinstance(raw_ntotal, (int, float, str)) else 0
    n_achieved = int(raw_nach) if isinstance(raw_nach, (int, float, str)) else 0

    total = max(n_total, len(ach_list))
    unlocked_count = max(n_achieved, len(unlocked_by_id), len(unlocked_by_name))
    if total > 0:
        unlocked_count = min(total, unlocked_count)

    return {
        "appid": appid_int,
        "cached": True,
        "total": total,
        "unlocked_count": unlocked_count,
        "achievements": ach_list,
        "unlocked_by_id": unlocked_by_id,
        "unlocked_by_name": unlocked_by_name,
        "progress_by_name": progress_by_name,
    }


def parse_appmanifest(filepath: str) -> GameData | None:
    """
    Parses a Steam `appmanifest_<appid>.acf` file and enriches achievement counts
    from both SteamOS local `librarycache` and Next Unlock's achievement disk cache.
    """
    try:
        with open(filepath, encoding="utf-8", errors="ignore") as f:
            content = f.read()

        appid_m = re.search(r'"appid"\s+"(\d+)"', content)
        name_m = re.search(r'"name"\s+"([^"]+)"', content)
        last_played_m = re.search(r'"LastPlayed"\s+"(\d+)"', content)

        if not appid_m or not name_m:
            return None

        appid = int(appid_m.group(1))
        name = name_m.group(1).strip()
        last_played = int(last_played_m.group(1)) if last_played_m else 0

        if appid in IGNORED_APP_IDS or appid <= 0:
            return None
        lower_name = name.lower()
        if any(ign in lower_name for ign in IGNORED_NAME_SUBSTRINGS):
            return None

        # 1. Check SteamOS local librarycache first (instantaneous local stats)
        local_stats = parse_local_user_stats(appid)
        total_ach = local_stats["total"]
        unlocked_count = local_stats["unlocked_count"]
        ach_list: list[AchievementData] = list(local_stats["achievements"])

        # 2. Enrich from Next Unlock disk achievement cache if available
        cached_ach = load_cached_achievements(appid)
        if cached_ach is not None:
            cached_list = cached_ach["achievements"]
            if cached_list:
                ach_list = cached_list
            total_ach = max(total_ach, len(ach_list))
            cached_unlocked = sum(1 for a in ach_list if a["unlocked"])
            unlocked_count = max(unlocked_count, cached_unlocked)

        pct = round((unlocked_count / total_ach) * 100.0, 1) if total_ach > 0 else 0.0
        header_image = (
            (cached_ach["header_image"] if cached_ach else None)
            or f"https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/{appid}/header.jpg"
        )
        raw_sets = cached_ach.get("achievement_sets") if cached_ach else None

        return {
            "appid": appid,
            "name": name,
            "header_image": header_image,
            "last_played": last_played,
            "total_achievements": total_ach,
            "unlocked_count": unlocked_count,
            "completion_percentage": pct,
            "achievements": ach_list,
            "achievement_sets": compute_achievement_sets(ach_list, raw_sets),
        }
    except Exception as e:
        logger.debug(f"Failed parsing manifest {filepath}: {e}")
        return None


def get_running_steam_appid(force_refresh: bool = False, proc_root: str = "/proc") -> int | None:
    """
    Detects active running game AppID on SteamOS by checking process environments in /proc.
    Honors NEXT_UNLOCK_RUNNING_APPID environment variable for deterministic testing/simulation.
    """
    env_running = os.environ.get("NEXT_UNLOCK_RUNNING_APPID")
    if env_running is not None:
        val = env_running.strip().lower()
        if val in ("", "none", "0", "null", "false"):
            return None
        if val.isdigit():
            appid = int(val)
            return appid if appid not in IGNORED_APP_IDS and appid > 0 else None

    now = time.time()
    if not force_refresh and (now - _cached_running_app.ts < 5):
        return _cached_running_app.val

    try:
        pids = glob.glob(os.path.join(proc_root, "[0-9]*"))
        for pid_dir in pids:
            try:
                environ_path = os.path.join(pid_dir, "environ")
                if not os.path.isfile(environ_path):
                    continue
                fd = os.open(environ_path, os.O_RDONLY | getattr(os, "O_NONBLOCK", 0))
                try:
                    env_data = os.read(fd, 4096)
                finally:
                    os.close(fd)
                for item in env_data.split(b"\x00"):
                    if item.startswith(b"SteamAppId="):
                        raw_val = item.split(b"=", 1)[1].decode(errors="ignore").strip()
                        if raw_val.isdigit():
                            appid = int(raw_val)
                            if appid not in IGNORED_APP_IDS and appid > 0:
                                _cached_running_app.val = appid
                                _cached_running_app.ts = now
                                return appid
            except Exception:
                continue
    except Exception as e:
        logger.debug(f"Error checking running Steam app in {proc_root}: {e}")

    _cached_running_app.val = None
    _cached_running_app.ts = now
    return None


def get_installed_games(force_refresh: bool = False) -> list[GameData]:
    """
    Scans all Steam library folders and returns installed games.
    If a game is currently running, it is prioritized to the very top, followed by LastPlayed desc.
    """
    now = time.time()
    if (
        not force_refresh
        and _cached_installed_games.val is not None
        and (now - _cached_installed_games.ts < 20)
    ):
        return list(_cached_installed_games.val)

    library_folders = get_library_folders(force_refresh=force_refresh)
    games_by_id: dict[int, GameData] = {}

    for folder in library_folders:
        for manifest in glob.glob(os.path.join(folder, "appmanifest_*.acf")):
            game = parse_appmanifest(manifest)
            if game:
                appid = game["appid"]
                if appid not in games_by_id or game.get("last_played", 0) > games_by_id[appid].get(
                    "last_played", 0
                ):
                    games_by_id[appid] = game

    running_appid = get_running_steam_appid(force_refresh=force_refresh)

    if running_appid and running_appid not in games_by_id:
        cached_ach = load_cached_achievements(running_appid)
        cached_title = cached_ach["game_title"] if cached_ach else None
        local_stats = parse_local_user_stats(running_appid)
        ach_list = (
            cached_ach["achievements"]
            if cached_ach and cached_ach["achievements"]
            else local_stats["achievements"]
        )
        total_ach = max(local_stats["total"], len(ach_list))
        u_count = max(
            local_stats["unlocked_count"],
            sum(1 for a in ach_list if a["unlocked"]),
        )
        games_by_id[running_appid] = {
            "appid": running_appid,
            "name": cached_title or f"App {running_appid}",
            "header_image": (
                (cached_ach["header_image"] if cached_ach else None)
                or f"https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/{running_appid}/header.jpg"
            ),
            "last_played": 2147483647,
            "total_achievements": total_ach,
            "unlocked_count": u_count,
            "completion_percentage": round((u_count / total_ach) * 100.0, 1)
            if total_ach > 0
            else 0.0,
            "achievements": ach_list,
        }

    games = list(games_by_id.values())

    def sort_key(g: GameData) -> tuple[int, int, str]:
        is_running = 1 if (running_appid and g["appid"] == running_appid) else 0
        return (-is_running, -int(g.get("last_played", 0)), g["name"].lower())

    games.sort(key=sort_key)
    _cached_installed_games.val = games
    _cached_installed_games.ts = now
    return games
