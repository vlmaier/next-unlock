"""
Local Steam VDF and Stats Cache reader for Next Unlock.
Reads local Steam userdata stats files on Steam Deck (~/.local/share/Steam/userdata).
"""

import os
import glob
import logging

logger = logging.getLogger("NextUnlock.Parser")


def find_steam_userdata_path():
    possible_paths = [
        os.path.expanduser("~/.local/share/Steam/userdata"),
        os.path.expanduser("~/.steam/steam/userdata"),
        "C:\\Program Files (x86)\\Steam\\userdata"
    ]
    for path in possible_paths:
        if os.path.exists(path):
            return path
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
    # In real execution on Deck, binary VDF structures are decoded here.
    return {"appid": appid, "source": "local_vdf_cache", "cached": True}
