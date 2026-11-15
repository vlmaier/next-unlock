"""
Next Unlock — Decky Loader Backend Entrypoint (`main.py`).

Exposes RPC methods called via `@decky/api`:
- `get_active_app()`
- `get_games(force_refresh=False)`
- `get_game_details(appid, force_refresh=False)`
- `toggle_pin(achievement_id)`
- `get_pinned()`
- `sync_unlocked_achievements(appid, unlocked_ids)`
"""

from __future__ import annotations

import json
import logging
import os
import sys
from collections.abc import Iterable, Mapping

# Ensure local directory is in sys.path so Decky Loader can import `backend`
plugin_dir = os.path.dirname(os.path.realpath(__file__))
if plugin_dir not in sys.path:
    sys.path.insert(0, plugin_dir)

from backend.achievement_fetcher import fetch_achievements_from_steam  # noqa: E402
from backend.achievement_parser import (  # noqa: E402
    clear_parser_caches,
    get_installed_games,
    get_running_steam_appid,
    parse_local_user_stats,
)
from backend.models import (  # noqa: E402
    AchievementData,
    ActiveAppData,
    GameData,
    GameDetailsResponse,
    SyncUnlockedResponse,
    TogglePinResponse,
)
from backend.recommendation import compute_achievement_sets, rank_achievements  # noqa: E402

try:
    import decky  # type: ignore

    logger: logging.Logger = decky.logger
except ImportError:
    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger("NextUnlock")


def get_settings_path() -> str:
    env_settings = os.environ.get("NEXT_UNLOCK_SETTINGS_PATH")
    if env_settings:
        return env_settings

    settings_dir = os.environ.get(
        "DECKY_PLUGIN_SETTINGS_DIR",
        os.path.expanduser("~/.config/next-unlock"),
    )
    os.makedirs(settings_dir, exist_ok=True)
    return os.path.join(settings_dir, "settings.json")


class Plugin:
    def __init__(self, settings_path: str | None = None) -> None:
        self.settings_path = settings_path or get_settings_path()
        self.pinned_achievements: set[str] = set()
        self.unlocked_overrides: dict[str, list[str]] = {}
        self.last_selected_appid: int | None = None
        self.load_settings()

    def load_settings(self) -> None:
        path = self.settings_path
        if not os.path.exists(path):
            return
        try:
            with open(path, encoding="utf-8") as f:
                data: object = json.load(f)
                if not isinstance(data, Mapping):
                    return
                raw_pinned = data.get("pinned", [])
                if isinstance(raw_pinned, list):
                    self.pinned_achievements = {str(x) for x in raw_pinned if x}
                raw_unlocked = data.get("unlocked_overrides", {})
                if isinstance(raw_unlocked, Mapping):
                    self.unlocked_overrides = {
                        str(k): [str(x) for x in v]
                        for k, v in raw_unlocked.items()
                        if isinstance(v, list)
                    }
                raw_last = data.get("last_selected_appid")
                self.last_selected_appid = int(raw_last) if isinstance(raw_last, int) else None
        except Exception as e:
            logger.error(f"Error loading settings: {e}")

    def save_settings(self) -> None:
        path = self.settings_path
        try:
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, "w", encoding="utf-8") as f:
                json.dump(
                    {
                        "pinned": sorted(self.pinned_achievements),
                        "unlocked_overrides": self.unlocked_overrides,
                        "last_selected_appid": self.last_selected_appid,
                    },
                    f,
                )
        except Exception as e:
            logger.error(f"Error saving settings: {e}")

    async def _main(self) -> None:
        logger.info("Next Unlock Plugin Loaded!")
        self.load_settings()

    async def _unload(self) -> None:
        logger.info("Next Unlock Plugin Unloaded.")
        self.save_settings()

    async def get_active_app(self) -> ActiveAppData | None:
        """Detects currently running game via /proc environ SteamAppId inspection."""
        appid = get_running_steam_appid()
        if not appid:
            return None
        installed = get_installed_games()
        for g in installed:
            if g["appid"] == appid:
                return {"appid": appid, "name": g["name"]}
        return {"appid": appid, "name": f"App {appid}"}

    async def get_games(self, force_refresh: bool = False) -> list[GameData]:
        """Returns list of user's installed games from Steam library with ranked achievements."""
        if force_refresh:
            clear_parser_caches()
        installed = get_installed_games(force_refresh=force_refresh)
        if not installed:
            return []

        result: list[GameData] = []
        for g in installed:
            appid_int = g["appid"]
            appid_str = str(appid_int)
            persisted_unlocked = set(self.unlocked_overrides.get(appid_str, []))
            raw_achs = g["achievements"]

            if raw_achs:
                merged_achs: list[AchievementData] = []
                for a in raw_achs:
                    item = a.copy()
                    if item["id"] in persisted_unlocked:
                        item["unlocked"] = True
                    merged_achs.append(item)
                ranked = rank_achievements(merged_achs, self.pinned_achievements)
                scored_achs = ranked["locked"] + ranked["unlocked"]
                total = len(scored_achs)
                u_count = len(ranked["unlocked"])
                pct = round((u_count / total) * 100.0, 1) if total > 0 else 0.0
                game_copy: GameData = {
                    "appid": appid_int,
                    "name": g["name"],
                    "header_image": g["header_image"],
                    "total_achievements": total,
                    "unlocked_count": u_count,
                    "completion_percentage": pct,
                    "achievements": scored_achs,
                    "achievement_sets": compute_achievement_sets(
                        scored_achs, g.get("achievement_sets")
                    ),
                }
                if "last_played" in g:
                    game_copy["last_played"] = g["last_played"]
                result.append(game_copy)
            else:
                total = g["total_achievements"]
                u_count = g["unlocked_count"]
                if persisted_unlocked and total > 0:
                    u_count = min(total, max(u_count, len(persisted_unlocked)))
                pct = round((u_count / total) * 100.0, 1) if total > 0 else 0.0
                empty_copy: GameData = {
                    "appid": appid_int,
                    "name": g["name"],
                    "header_image": g["header_image"],
                    "total_achievements": total,
                    "unlocked_count": u_count,
                    "completion_percentage": pct,
                    "achievements": [],
                }
                if "last_played" in g:
                    empty_copy["last_played"] = g["last_played"]
                result.append(empty_copy)
        return result

    async def get_game_details(
        self,
        appid: int,
        force_refresh: bool = False,
    ) -> GameDetailsResponse:
        """Returns achievement details and canonical rankings for a specific game."""
        appid_int = int(appid)
        self.last_selected_appid = appid_int

        fetched = fetch_achievements_from_steam(appid_int, force_refresh=force_refresh)
        raw_achievements: list[AchievementData] = list(fetched["achievements"])

        # Read SteamOS local userdata librarycache for offline/non-running unlock & progress state
        local_stats = parse_local_user_stats(appid_int)
        local_unlocked_by_id = local_stats["unlocked_by_id"]
        local_unlocked_by_name = local_stats["unlocked_by_name"]
        local_progress_by_name = local_stats["progress_by_name"]

        # If Steam Community returned nothing (e.g. offline), use SteamOS librarycache achievements directly
        if not raw_achievements and local_stats["achievements"]:
            raw_achievements = list(local_stats["achievements"])

        # Apply persisted unlocked overrides and SteamOS local librarycache state
        persisted_unlocked = set(self.unlocked_overrides.get(str(appid_int), []))
        achievements: list[AchievementData] = []
        for a in raw_achievements:
            item = a.copy()
            ach_id = item["id"]
            ach_name_lower = item["name"].lower()

            if (
                ach_id in persisted_unlocked
                or ach_id in local_unlocked_by_id
                or ach_name_lower in local_unlocked_by_name
            ):
                item["unlocked"] = True
                local_match = local_unlocked_by_id.get(ach_id) or local_unlocked_by_name.get(
                    ach_name_lower
                )
                if local_match and local_match["unlock_time"] and not item["unlock_time"]:
                    item["unlock_time"] = local_match["unlock_time"]

            if not item.get("progress") and ach_name_lower in local_progress_by_name:
                item["progress"] = local_progress_by_name[ach_name_lower]

            achievements.append(item)

        game_title = fetched["game_title"] or f"App {appid_int}"
        installed_header: str | None = None
        for g in get_installed_games():
            if g["appid"] == appid_int:
                if game_title.startswith("App ") and g["name"]:
                    game_title = g["name"]
                installed_header = g["header_image"]
                break

        ranked = rank_achievements(achievements, self.pinned_achievements)
        scored_achievements = ranked["locked"] + ranked["unlocked"]

        unlocked_count = len(ranked["unlocked"])
        total = len(scored_achievements)
        pct = round((unlocked_count / total) * 100.0, 1) if total > 0 else 0.0

        header_img = (
            fetched["header_image"]
            or installed_header
            or f"https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/{appid_int}/header.jpg"
        )

        target_game: GameData = {
            "appid": appid_int,
            "name": game_title,
            "header_image": header_img,
            "total_achievements": total,
            "unlocked_count": unlocked_count,
            "completion_percentage": pct,
            "achievements": scored_achievements,
            "achievement_sets": compute_achievement_sets(
                scored_achievements, fetched.get("achievement_sets")
            ),
        }

        return {"game": target_game, "ranked": ranked}

    async def sync_unlocked_achievements(
        self,
        appid: int,
        unlocked_ids: Iterable[str],
    ) -> SyncUnlockedResponse:
        """
        Persists unlocked achievement IDs discovered via SteamClient.Apps.GetMyAchievementsForApp
        so they remain available even when offline or when the game is no longer running.
        """
        appid_str = str(int(appid))
        self.unlocked_overrides[appid_str] = sorted({str(x) for x in unlocked_ids if x})
        self.save_settings()
        return {"appid": int(appid), "synced_count": len(self.unlocked_overrides[appid_str])}

    async def toggle_pin(self, achievement_id: str) -> TogglePinResponse:
        """Pins or unpins an achievement and persists to disk."""
        ach_id = str(achievement_id)
        if ach_id in self.pinned_achievements:
            self.pinned_achievements.remove(ach_id)
            pinned = False
        else:
            self.pinned_achievements.add(ach_id)
            pinned = True

        self.save_settings()
        return {"achievement_id": ach_id, "pinned": pinned}

    async def get_pinned(self) -> list[str]:
        """Returns list of pinned achievement IDs."""
        return sorted(self.pinned_achievements)
