"""
Next Unlock - Main Decky Loader Plugin Backend Entrypoint
Handles Decky RPC calls, pins management, and recommendation ranking.
"""

import os
import json
import logging
from backend.mock_data import get_mock_games, get_mock_game_by_id
from backend.recommendation import rank_achievements
from backend.achievement_parser import parse_local_user_stats

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

    async def get_games(self):
        """Returns list of user's active games with achievement progress."""
        return get_mock_games()

    async def get_game_details(self, appid: int):
        """Returns full achievement details for a specific game."""
        game = get_mock_game_by_id(appid)
        ranked = rank_achievements(game["achievements"], self.pinned_achievements)
        return {
            "game": game,
            "ranked": ranked
        }

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
