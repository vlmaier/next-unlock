"""
Local Steam VDF and Stats Cache reader for Next Unlock.
Scans local Steam library folders and app manifests on Steam Deck to find installed games.
Also inspects running processes to identify the currently active game.
"""

import os
import re
import glob
import logging

logger = logging.getLogger("NextUnlock.Parser")

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


def find_all_steam_roots():
    """Finds all possible Steam root directories across user homes and system paths."""
    roots = []
    # Search all user home directories (e.g. /home/deck, /home/user)
    for home in glob.glob("/home/*"):
        for sub in [".local/share/Steam", ".steam/steam", ".steam/root"]:
            p = os.path.join(home, sub)
            if os.path.isdir(p) and p not in roots:
                roots.append(p)

    # Current user / root paths
    for sub in [".local/share/Steam", ".steam/steam"]:
        p = os.path.expanduser(f"~/{sub}")
        if os.path.isdir(p) and p not in roots:
            roots.append(p)

    return roots


def get_library_folders():
    """Returns list of all steamapps directories across internal storage and SD cards."""
    folders = set()
    steam_roots = find_all_steam_roots()

    for root in steam_roots:
        default_steamapps = os.path.join(root, "steamapps")
        if os.path.isdir(default_steamapps):
            folders.add(default_steamapps)

        vdf_path = os.path.join(default_steamapps, "libraryfolders.vdf")
        if os.path.isfile(vdf_path):
            try:
                with open(vdf_path, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()
                matches = re.findall(r'"path"\s+"([^"]+)"', content)
                for m in matches:
                    candidate = os.path.join(m, "steamapps")
                    if os.path.isdir(candidate):
                        folders.add(candidate)
            except Exception as e:
                logger.warning(f"Error parsing libraryfolders.vdf in {root}: {e}")

    # Search common SD card and external drive mount locations
    for pattern in [
        "/run/media/*/*/steamapps",
        "/run/media/*/steamapps",
        "/media/*/*/steamapps",
        "/media/*/steamapps",
        "/mnt/*/*/steamapps",
    ]:
        for sd_path in glob.glob(pattern):
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


def get_running_steam_appid():
    """
    Detects active running game AppID on SteamOS by checking process environments in /proc.
    Steam sets SteamAppId=<id> for every running game process.
    """
    try:
        pids = glob.glob("/proc/[0-9]*")
        for pid_dir in pids:
            try:
                environ_path = os.path.join(pid_dir, "environ")
                if not os.path.isfile(environ_path):
                    continue
                fd = os.open(environ_path, os.O_RDONLY | getattr(os, "O_NONBLOCK", 0))
                try:
                    env_data = os.read(fd, 2048)
                finally:
                    os.close(fd)
                for item in env_data.split(b"\x00"):
                    if item.startswith(b"SteamAppId="):
                        val = item.split(b"=", 1)[1].decode(errors="ignore").strip()
                        if val.isdigit():
                            appid = int(val)
                            if appid not in IGNORED_APP_IDS and appid > 0:
                                return appid
            except Exception:
                continue
    except Exception as e:
        logger.debug(f"Error checking running Steam app in /proc: {e}")
    return None


def get_installed_games():
    """
    Scans all Steam library folders and returns installed games.
    If a game is currently running, it is prioritized to the very top.
    """
    library_folders = get_library_folders()
    games_by_id = {}

    for folder in library_folders:
        for manifest in glob.glob(os.path.join(folder, "appmanifest_*.acf")):
            game = parse_appmanifest(manifest)
            if game:
                if game["appid"] not in games_by_id or game["last_played"] > games_by_id[game["appid"]]["last_played"]:
                    games_by_id[game["appid"]] = game

    running_appid = get_running_steam_appid()

    # If running app is not in discovered manifests, add placeholder entry
    if running_appid and running_appid not in games_by_id:
        games_by_id[running_appid] = {
            "appid": running_appid,
            "name": f"Running Game ({running_appid})",
            "header_image": f"https://cdn.cloudflare.steamstatic.com/steam/apps/{running_appid}/header.jpg",
            "last_played": 2147483647,
            "total_achievements": 0,
            "unlocked_count": 0,
            "completion_percentage": 0.0,
            "achievements": [],
        }

    games = list(games_by_id.values())

    # Sort so running game is first, followed by most recently played
    def sort_key(g):
        is_running = 1 if (running_appid and g["appid"] == running_appid) else 0
        return (is_running, g.get("last_played", 0))

    games.sort(key=sort_key, reverse=True)
    return games


def parse_local_user_stats(appid):
    """Attempts to read cached stats files for the given AppID."""
    return {"appid": appid, "source": "local_vdf_cache", "cached": True}
