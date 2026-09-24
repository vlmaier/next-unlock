"""
Local Steam VDF and Stats Cache reader for Next Unlock.
Scans local Steam library folders and app manifests on Steam Deck to find installed games.
"""

import os
import re
import glob
import logging

logger = logging.getLogger("NextUnlock.Parser")

STEAM_PATHS = [
    os.path.expanduser("~/.local/share/Steam"),
    os.path.expanduser("~/.steam/steam"),
    os.path.expanduser("~/.steam/root"),
    "/home/deck/.local/share/Steam",
]

# Known non-game runtime / tool IDs to filter out
IGNORED_APP_IDS = {
    228980,   # Steamworks Common Redistributables
    1070560,  # Steam Linux Runtime - Soldier
    1391110,  # Steam Linux Runtime - Sniper
    1628350,  # Steam Linux Runtime - Medic
    1493710,  # Proton Experimental
    1887720,  # Proton 7.0
    2348590,  # Proton 8.0
    2805730,  # Proton 9.0
    2180100,  # Proton Hotfix
    896660,   # Proton 4.11
    1054830,  # Proton 5.0
    1245040,  # Proton 5.13
    1580130,  # Proton 6.3
}


def find_steam_root():
    for p in STEAM_PATHS:
        if os.path.isdir(p):
            return p
    return None


def get_library_folders():
    """Returns list of all steamapps directories across internal storage and SD cards."""
    folders = set()
    steam_root = find_steam_root()
    if not steam_root:
        return []

    default_steamapps = os.path.join(steam_root, "steamapps")
    if os.path.isdir(default_steamapps):
        folders.add(default_steamapps)

    vdf_path = os.path.join(default_steamapps, "libraryfolders.vdf")
    if os.path.isfile(vdf_path):
        try:
            with open(vdf_path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
            # Match "path" "\t\t/path/to/folder"
            matches = re.findall(r'"path"\s+"([^"]+)"', content)
            for m in matches:
                candidate = os.path.join(m, "steamapps")
                if os.path.isdir(candidate):
                    folders.add(candidate)
        except Exception as e:
            logger.warning(f"Error parsing libraryfolders.vdf: {e}")

    # Also check typical SD card mount paths on Steam Deck
    for sd_path in glob.glob("/run/media/*/steamapps"):
        if os.path.isdir(sd_path):
            folders.add(sd_path)

    return list(folders)


def parse_appmanifest(filepath):
    """Parses appmanifest_<appid>.acf file and returns game metadata or None."""
    try:
        with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()

        appid_m = re.search(r'"appid"\s+"(\d+)"', content)
        name_m = re.search(r'"name"\s+"([^"]+)"', content)
        last_played_m = re.search(r'"LastPlayed"\s+"(\d+)"', content)

        if not appid_m or not name_m:
            return None

        appid = int(appid_m.group(1))
        name = name_m.group(1).strip()
        last_played = int(last_played_m.group(1)) if last_played_m else 0

        # Filter out runtimes, tools, redistributables, soundtracks
        if appid in IGNORED_APP_IDS:
            return None
        lower_name = name.lower()
        if any(ign in lower_name for ign in ["proton", "steam linux runtime", "steamworks common", "soundtrack"]):
            return None

        return {
            "appid": appid,
            "name": name,
            "header_image": f"https://cdn.cloudflare.steamstatic.com/steam/apps/{appid}/header.jpg",
            "last_played": last_played,
            "total_achievements": 0,
            "unlocked_count": 0,
            "completion_percentage": 0.0,
            "achievements": [],
        }
    except Exception as e:
        logger.debug(f"Failed parsing manifest {filepath}: {e}")
        return None


def get_installed_games():
    """Scans all Steam library folders and returns installed games sorted by most recently played."""
    library_folders = get_library_folders()
    games_by_id = {}

    for folder in library_folders:
        for manifest in glob.glob(os.path.join(folder, "appmanifest_*.acf")):
            game = parse_appmanifest(manifest)
            if game:
                # Keep the entry with the highest last_played if duplicated across drives
                if game["appid"] not in games_by_id or game["last_played"] > games_by_id[game["appid"]]["last_played"]:
                    games_by_id[game["appid"]] = game

    games = list(games_by_id.values())
    games.sort(key=lambda g: g["last_played"], reverse=True)
    return games


def find_steam_userdata_path():
    steam_root = find_steam_root()
    if steam_root:
        userdata = os.path.join(steam_root, "userdata")
        if os.path.isdir(userdata):
            return userdata
    return None


def parse_local_user_stats(appid):
    """
    Attempts to read cached stats files for the given AppID.
    Returns parsed dict or None if offline/not cached.
    """
    userdata = find_steam_userdata_path()
    if not userdata:
        return None

    stats_files = glob.glob(f"{userdata}/*/{appid}/stats/UserGameStats_*.bin")
    if not stats_files:
        return None

    logger.info(f"Found local stats binary: {stats_files[0]}")
    return {"appid": appid, "source": "local_vdf_cache", "cached": True}
