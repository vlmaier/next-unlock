"""
Next Unlock - Main Decky Loader Plugin Backend Entrypoint
Handles Decky RPC calls, pins management, and recommendation ranking.
"""

import os
import json
import logging
from backend.mock_data import get_mock_games, get_mock_game_by_id
from backend.recommendation import rank_achievements
from backend.achievement_parser import get_installed_games, parse_local_user_stats
from backend.achievement_fetcher import fetch_achievements_from_steam

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("NextUnlock")


class Plugin:
    def __init__(self):
        self.pinned_achievements = set()
        self.settings_path = os.path.expanduser("~/.config/next-unlock/settings.json")
        self.load_settings()

    def load_settings(self):
        try:
            if os.path.exists(self.settings_path):
                with open(self.settings_path, "r") as f:
                    data = json.load(f)
                    self.pinned_achievements = set(data.get("pinned", []))
        except Exception as e:
            logger.error(f"Failed to load settings: {e}")

    def save_settings(self):
        try:
            os.makedirs(os.path.dirname(self.settings_path), exist_ok=True)
            with open(self.settings_path, "w") as f:
                json.dump({"pinned": list(self.pinned_achievements)}, f)
        except Exception as e:
            logger.error(f"Failed to save settings: {e}")

    # --- Decky RPC Methods ---

    async def _main(self):
        logger.info("Next Unlock Plugin initialized successfully.")

    async def _unload(self):
        logger.info("Next Unlock Plugin unloading.")

    async def get_active_app(self):
        """Detects currently running game via /proc environ SteamAppId inspection."""
        from backend.achievement_parser import get_running_steam_appid
        appid = get_running_steam_appid()
        if not appid:
            return None
        installed = get_installed_games()
        for g in installed:
            if g["appid"] == appid:
                return {"appid": appid, "name": g["name"]}
        return {"appid": appid, "name": f"App {appid}"}

    async def get_games(self):
        """Returns list of user's installed games from Steam library."""
        installed = get_installed_games()
        return installed if installed else []

    async def get_game_details(self, appid: int):
        """Returns achievement details for a specific game, fetching from Steam/cache if needed."""
        appid_int = int(appid)
        fetched = fetch_achievements_from_steam(appid_int)
        achievements = fetched.get("achievements", [])
        game_title = fetched.get("game_title") or f"App {appid_int}"

        # If name is unknown, try quick check in installed games
        if game_title.startswith("App "):
            for g in get_installed_games():
                if g["appid"] == appid_int and g.get("name"):
                    game_title = g["name"]
                    break

        unlocked_count = sum(1 for a in achievements if a.get("unlocked"))
        total = len(achievements)
        pct = round((unlocked_count / total) * 100, 1) if total > 0 else 0.0

        header_img = fetched.get("header_image") or f"https://cdn.cloudflare.steamstatic.com/steam/apps/{appid_int}/header.jpg"

        target_game = {
            "appid": appid_int,
            "name": game_title,
            "header_image": header_img,
            "total_achievements": total,
            "unlocked_count": unlocked_count,
            "completion_percentage": pct,
            "achievements": achievements,
        }

        ranked = rank_achievements(achievements, self.pinned_achievements)
        return {"game": target_game, "ranked": ranked}

    async def toggle_pin(self, achievement_id: str):
        """Pins or unpins an achievement."""
        if achievement_id in self.pinned_achievements:
            self.pinned_achievements.remove(achievement_id)
            pinned = False
        else:
            self.pinned_achievements.add(achievement_id)
            pinned = True
        self.save_settings()
        return {"achievement_id": achievement_id, "pinned": pinned}

    async def get_pinned(self):
        """Returns all currently pinned achievement IDs."""
        return list(self.pinned_achievements)


if __name__ == "__main__":
    plugin = Plugin()
    print("Plugin initialized in test mode.")
