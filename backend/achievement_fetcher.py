"""
Steam Achievement Fetcher for Next Unlock.
Fetches real achievement data directly from Steam Community and caches it locally.
Supports family shared games and any installed/running game.
"""

import os
import re
import json
import html
import ssl
import urllib.request
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger("NextUnlock.Fetcher")

CACHE_DIR = os.path.expanduser("~/.config/next-unlock/cache")


def get_cache_path(appid: int) -> str:
    return os.path.join(CACHE_DIR, f"achievements_{appid}.json")


def load_cached_achievements(appid: int) -> Optional[Dict[str, Any]]:
    # User persistent runtime cache
    try:
        path = get_cache_path(appid)
        if os.path.isfile(path):
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, dict) and data.get("achievements"):
                    return data
                elif isinstance(data, list) and len(data) > 0:
                    return {"game_title": None, "achievements": data}
    except Exception as e:
        logger.debug(f"Failed loading cache for appid {appid}: {e}")
    return None


def save_cached_achievements(appid: int, data: Dict[str, Any]) -> None:
    try:
        os.makedirs(CACHE_DIR, exist_ok=True)
        path = get_cache_path(appid)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f)
    except Exception as e:
        logger.debug(f"Failed saving cache for appid {appid}: {e}")


def fetch_achievements_from_steam(appid: int) -> Dict[str, Any]:
    """
    Fetches public achievement list, names, descriptions, icons, and unlock percentages
    from Steam Community. Works for any Steam game including Family Shared games.
    """
    # Check cache first for instant response
    cached = load_cached_achievements(appid)
    if cached and cached.get("achievements"):
        return cached

    url = f"https://steamcommunity.com/stats/{appid}/achievements/"
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9",
        },
    )

    try:
        # Create SSL context that does not fail on Linux/SteamOS missing root CA bundles
        ssl_ctx = ssl.create_default_context()
        ssl_ctx.check_hostname = False
        ssl_ctx.verify_mode = ssl.CERT_NONE
    except Exception:
        ssl_ctx = None

    try:
        if ssl_ctx:
            response = urllib.request.urlopen(req, timeout=8, context=ssl_ctx)
        else:
            response = urllib.request.urlopen(req, timeout=8)
        html_bytes = response.read()
        content = html_bytes.decode("utf-8", errors="ignore")

        rows = re.findall(r'<div class="achieveRow ">(.*?)<div style="clear: both;">', content, re.DOTALL)
        if not rows:
            # Try matching without trailing space in class
            rows = re.findall(r'<div class="achieveRow.*?">(.*?)<div style="clear: both;">', content, re.DOTALL)

        title_m = re.search(r'<title>Steam Community :: (.*?) :: Achievements</title>', content)
        game_title = html.unescape(title_m.group(1).strip()) if title_m else None

        achievements = []
        for idx, r in enumerate(rows):
            icon_m = re.search(r'<img src="([^"]+)"', r)
            name_m = re.search(r'<h3>(.*?)</h3>', r)
            desc_m = re.search(r'<h5>(.*?)</h5>', r)
            pct_m = re.search(r'<div class="achievePercent">([0-9.]+)%</div>', r)

            name = html.unescape(name_m.group(1).strip()) if name_m else f"Achievement {idx + 1}"
            desc = html.unescape(desc_m.group(1).strip()) if desc_m else ""
            icon = icon_m.group(1).strip() if icon_m else ""
            pct = float(pct_m.group(1)) if pct_m else 0.0

            clean_id = re.sub(r"[^a-zA-Z0-9_]", "_", name.lower())
            ach_id = f"ach_{clean_id}"

            rarity = "ultra_rare" if pct <= 5.0 else "rare" if pct <= 15.0 else "common"
            rec_score = (100.0 - pct) + 50.0

            achievements.append({
                "id": ach_id,
                "name": name,
                "description": desc,
                "icon": icon,
                "unlocked": False,
                "unlock_time": None,
                "global_percentage": pct,
                "rarity_tier": rarity,
                "hidden": False,
                "hint": desc if desc else f"Unlocked by {pct}% of players",
                "rec_score": rec_score,
            })

        if achievements:
            save_cached_achievements(appid, achievements)
            return {"game_title": game_title, "achievements": achievements}

    except Exception as e:
        logger.warning(f"Error fetching achievements from steamcommunity for {appid}: {e}")

    # Fallback to local cache if network fails
    cached = load_cached_achievements(appid)
    if cached:
        return {"game_title": None, "achievements": cached}

    return {"game_title": None, "achievements": []}
