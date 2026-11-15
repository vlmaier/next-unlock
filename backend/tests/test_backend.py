import asyncio
import json
import os
import shutil
import tempfile
import unittest
from unittest.mock import MagicMock, patch

from backend.achievement_fetcher import (
    fetch_achievements_from_steam,
    load_cached_achievements,
    parse_steam_community_html,
    save_cached_achievements,
)
from backend.achievement_parser import (
    clear_parser_caches,
    get_installed_games,
    get_library_folders,
    get_running_steam_appid,
    parse_appmanifest,
    parse_local_user_stats,
)
from backend.mock_data import get_mock_game_by_id, get_mock_games
from backend.recommendation import (
    compute_recommendation_score,
    get_progress_ratio,
    rank_achievements,
)
from main import Plugin

SAMPLE_STEAM_HTML = """
<!DOCTYPE html>
<html>
<head>
    <title>Steam Community :: Elden Ring :: Achievements</title>
</head>
<body>
    <div class="achieveRow ">
        <div class="achieveImgHolder">
            <img src="https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/1245620/easy.jpg">
        </div>
        <div class="achieveTxtHolder">
            <div class="achievePercent">64.2%</div>
            <div class="achieveTxt">
                <h3>Margit, the Fell Omen</h3>
                <h5>Defeated Margit, the Fell Omen.</h5>
            </div>
        </div>
        <div style="clear: both;"></div>
    </div>
    <div class="achieveRow">
        <div class="achieveImgHolder">
            <img src="https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/1245620/hard.jpg">
        </div>
        <div class="achieveTxtHolder">
            <div class="achievePercent">1.4%</div>
            <div class="achieveTxt">
                <h3>Elden Ring Master</h3>
                <h5>Obtained all achievements.</h5>
            </div>
        </div>
        <div style="clear: both;"></div>
    </div>
    <div class="achieveRow">
        <div class="achieveImgHolder">
            <img src="https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/1245620/secret.jpg">
        </div>
        <div class="achieveTxtHolder">
            <div class="achievePercent">8.5%</div>
            <div class="achieveTxt achieveHiddenBox">
                <h3>Hidden Trophy</h3>
            </div>
        </div>
        <div style="clear: both;"></div>
    </div>
</body>
</html>
"""


class TestBackendSuite(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = os.path.realpath(tempfile.mkdtemp())
        self.steam_root = os.path.join(self.temp_dir, "steam_root")
        self.steamapps = os.path.join(self.steam_root, "steamapps")
        self.cache_dir = os.path.join(self.temp_dir, "cache")
        self.settings_path = os.path.join(self.temp_dir, "settings.json")
        os.makedirs(self.steamapps, exist_ok=True)
        os.makedirs(self.cache_dir, exist_ok=True)

        self.env_patcher = patch.dict(
            os.environ,
            {
                "NEXT_UNLOCK_STEAM_ROOT": self.steam_root,
                "NEXT_UNLOCK_CACHE_DIR": self.cache_dir,
                "NEXT_UNLOCK_SETTINGS_PATH": self.settings_path,
                "NEXT_UNLOCK_RUNNING_APPID": "none",
            },
        )
        self.env_patcher.start()
        clear_parser_caches()

    def tearDown(self) -> None:
        self.env_patcher.stop()
        clear_parser_caches()
        shutil.rmtree(self.temp_dir)

    def test_recommendation_prioritizes_easy_and_almost_there_over_hard(self) -> None:
        """
        Regression test: Up Next must recommend high-progress and easy-grab achievements
        BEFORE ultra-rare 0.5% endgame grinds (never invert global_percentage).
        """
        achievements = [
            {
                "id": "ach_ultra_hard",
                "name": "Impossible Grind",
                "description": "Win 10,000 ranked matches without taking damage.",
                "unlocked": False,
                "global_percentage": 0.4,
                "rarity_tier": "ultra_rare",
                "hidden": False,
            },
            {
                "id": "ach_easy_story",
                "name": "First Steps",
                "description": "Complete the prologue chapter.",
                "unlocked": False,
                "global_percentage": 78.5,
                "rarity_tier": "common",
                "hidden": False,
            },
            {
                "id": "ach_almost_done",
                "name": "Weapon Collector",
                "description": "Collect 9 legendary weapons.",
                "unlocked": False,
                "global_percentage": 14.0,
                "rarity_tier": "rare",
                "hidden": False,
                "progress": {"current": 8, "max": 9},
            },
            {
                "id": "ach_secret_empty",
                "name": "Secret Ending",
                "description": "",
                "unlocked": False,
                "global_percentage": 2.0,
                "rarity_tier": "ultra_rare",
                "hidden": True,
            },
        ]

        ranked = rank_achievements(achievements, pinned_ids={"ach_almost_done"})
        up_next_ids = [a["id"] for a in ranked["up_next"]]

        # Easy story (78.5%) and Almost Done (8/9 progress) must both rank above Ultra Hard (0.4%)
        self.assertLess(up_next_ids.index("ach_easy_story"), up_next_ids.index("ach_ultra_hard"))
        self.assertLess(up_next_ids.index("ach_almost_done"), up_next_ids.index("ach_ultra_hard"))
        self.assertEqual(ranked["pinned"][0]["id"], "ach_almost_done")
        self.assertEqual(ranked["almost_there"][0]["id"], "ach_almost_done")
        self.assertEqual(ranked["easy_grabs"][0]["id"], "ach_easy_story")
        self.assertGreater(
            compute_recommendation_score(achievements[1]),
            compute_recommendation_score(achievements[0]),
        )
        self.assertAlmostEqual(get_progress_ratio(achievements[2]), 8 / 9, places=2)

    def test_steam_community_html_parser_and_cache_envelope(self) -> None:
        parsed = parse_steam_community_html(SAMPLE_STEAM_HTML)
        self.assertEqual(parsed["game_title"], "Elden Ring")
        self.assertEqual(len(parsed["achievements"]), 3)

        first = parsed["achievements"][0]
        self.assertEqual(first["name"], "Margit, the Fell Omen")
        self.assertEqual(first["global_percentage"], 64.2)
        self.assertEqual(first["rarity_tier"], "common")
        self.assertFalse(first["hidden"])
        self.assertNotIn("hint", first)

        secret = parsed["achievements"][2]
        self.assertTrue(secret["hidden"])
        self.assertEqual(secret["rarity_tier"], "rare")

        # Save to cache and verify canonical dict envelope is preserved
        save_cached_achievements(1245620, parsed["achievements"], game_title=parsed["game_title"])
        loaded = load_cached_achievements(1245620)
        self.assertIsNotNone(loaded)
        assert loaded is not None
        self.assertEqual(loaded["game_title"], "Elden Ring")
        self.assertEqual(len(loaded["achievements"]), 3)

        # Verify legacy list cache format is normalized without double-wrapping
        legacy_path = os.path.join(self.cache_dir, "achievements_999.json")
        with open(legacy_path, "w", encoding="utf-8") as f:
            json.dump(parsed["achievements"], f)
        legacy_loaded = load_cached_achievements(999)
        self.assertIsNotNone(legacy_loaded)
        assert legacy_loaded is not None
        self.assertIsInstance(legacy_loaded["achievements"], list)

    @patch("urllib.request.urlopen")
    def test_fetcher_network_and_fallback_behavior(self, mock_urlopen: MagicMock) -> None:
        mock_resp = MagicMock()
        mock_resp.read.return_value = SAMPLE_STEAM_HTML.encode("utf-8")
        mock_urlopen.return_value = mock_resp

        res = fetch_achievements_from_steam(1245620, force_refresh=True)
        self.assertEqual(res["game_title"], "Elden Ring")
        self.assertEqual(len(res["achievements"]), 3)

        # Now simulate network failure and verify fallback returns valid list (no nested dict bug)
        mock_urlopen.side_effect = OSError("Network unreachable")
        fallback_res = fetch_achievements_from_steam(1245620, force_refresh=True)
        self.assertEqual(fallback_res["game_title"], "Elden Ring")
        self.assertIsInstance(fallback_res["achievements"], list)
        self.assertEqual(len(fallback_res["achievements"]), 3)

    def test_vdf_and_appmanifest_parsing_and_filtering(self) -> None:
        vdf_content = (
            f'"libraryfolders"\n{{\n\t"0"\n\t{{\n\t\t"path"\t\t"{self.steam_root}"\n\t}}\n}}\n'
        )
        with open(os.path.join(self.steamapps, "libraryfolders.vdf"), "w", encoding="utf-8") as f:
            f.write(vdf_content)

        # Valid game 1: Elden Ring
        with open(
            os.path.join(self.steamapps, "appmanifest_1245620.acf"), "w", encoding="utf-8"
        ) as f:
            f.write(
                '"AppState"\n{\n\t"appid"\t\t"1245620"\n\t"name"\t\t"Elden Ring"\n\t"LastPlayed"\t\t"1710000000"\n}\n'
            )

        # Valid game 2 (more recently played): Hades II
        with open(
            os.path.join(self.steamapps, "appmanifest_1145350.acf"), "w", encoding="utf-8"
        ) as f:
            f.write(
                '"AppState"\n{\n\t"appid"\t\t"1145350"\n\t"name"\t\t"Hades II"\n\t"LastPlayed"\t\t"1720000000"\n}\n'
            )

        # Ignored tool: Proton Experimental (1493710)
        with open(
            os.path.join(self.steamapps, "appmanifest_1493710.acf"), "w", encoding="utf-8"
        ) as f:
            f.write(
                '"AppState"\n{\n\t"appid"\t\t"1493710"\n\t"name"\t\t"Proton Experimental"\n\t"LastPlayed"\t\t"1730000000"\n}\n'
            )

        folders = get_library_folders(force_refresh=True)
        self.assertIn(self.steamapps, folders)

        games = get_installed_games(force_refresh=True)
        self.assertEqual(len(games), 2)
        # Hades II has higher LastPlayed so it comes first when no game is running
        self.assertEqual(games[0]["appid"], 1145350)
        self.assertEqual(games[1]["appid"], 1245620)

        # Verify Proton was filtered out
        self.assertIsNone(
            parse_appmanifest(os.path.join(self.steamapps, "appmanifest_1493710.acf"))
        )

    def test_proc_scanning_for_running_steam_app(self) -> None:
        fake_proc = os.path.join(self.temp_dir, "proc")
        pid_ignored = os.path.join(fake_proc, "1001")
        pid_game = os.path.join(fake_proc, "1002")
        os.makedirs(pid_ignored, exist_ok=True)
        os.makedirs(pid_game, exist_ok=True)

        # 228980 is ignored redistributable
        with open(os.path.join(pid_ignored, "environ"), "wb") as f:
            f.write(b"PATH=/usr/bin\x00SteamAppId=228980\x00")
        with open(os.path.join(pid_game, "environ"), "wb") as f:
            f.write(b"HOME=/home/deck\x00SteamAppId=1245620\x00")

        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("NEXT_UNLOCK_RUNNING_APPID", None)
            detected = get_running_steam_appid(force_refresh=True, proc_root=fake_proc)
            self.assertEqual(detected, 1245620)

    def test_plugin_lifecycle_pins_and_unlocked_sync(self) -> None:
        elden = get_mock_game_by_id(1245620)
        save_cached_achievements(1245620, elden["achievements"], game_title="Elden Ring")

        with open(
            os.path.join(self.steamapps, "appmanifest_1245620.acf"), "w", encoding="utf-8"
        ) as f:
            f.write(
                '"AppState"\n{\n\t"appid"\t\t"1245620"\n\t"name"\t\t"Elden Ring"\n\t"LastPlayed"\t\t"1710000000"\n}\n'
            )

        plugin = Plugin(settings_path=self.settings_path)
        asyncio.run(plugin._main())

        # Pin an achievement
        pin_res = asyncio.run(plugin.toggle_pin("ACH_LEGENDARY_ARMAMENTS"))
        self.assertTrue(pin_res["pinned"])
        self.assertIn("ACH_LEGENDARY_ARMAMENTS", asyncio.run(plugin.get_pinned()))

        # Sync unlocked achievements from SteamClient
        sync_res = asyncio.run(
            plugin.sync_unlocked_achievements(
                1245620, ["ACH_ELDEN_LORD", "ACH_GODDEVOURING_SERPENT"]
            )
        )
        self.assertEqual(sync_res["synced_count"], 2)

        # Re-instantiate Plugin to verify persistence on disk
        reloaded = Plugin(settings_path=self.settings_path)
        self.assertIn("ACH_LEGENDARY_ARMAMENTS", asyncio.run(reloaded.get_pinned()))

        details = asyncio.run(reloaded.get_game_details(1245620))
        self.assertEqual(details["game"]["name"], "Elden Ring")
        self.assertEqual(details["game"]["unlocked_count"], 3)
        self.assertEqual(details["ranked"]["pinned"][0]["id"], "ACH_LEGENDARY_ARMAMENTS")

        games_list = asyncio.run(reloaded.get_games(force_refresh=True))
        self.assertEqual(len(games_list), 1)
        self.assertEqual(games_list[0]["unlocked_count"], 3)
        self.assertGreater(len(get_mock_games()), 0)
        asyncio.run(reloaded._unload())

    def test_steamos_local_librarycache_reader(self) -> None:
        libcache = os.path.join(self.steam_root, "userdata", "99999999", "config", "librarycache")
        os.makedirs(libcache, exist_ok=True)
        with open(os.path.join(libcache, "1245620.json"), "w", encoding="utf-8") as f:
            json.dump(
                [
                    [
                        "achievements",
                        {
                            "version": 2,
                            "data": {
                                "vecHighlight": [
                                    {
                                        "strID": "ACH_MARGIT",
                                        "strName": "Margit, the Fell Omen",
                                        "bAchieved": True,
                                        "rtUnlocked": 1700001000,
                                    }
                                ],
                                "vecUnachieved": [
                                    {
                                        "strID": "ACH_MALENIA",
                                        "strName": "Shardbearer Malenia",
                                        "bAchieved": False,
                                    },
                                ],
                                "nTotal": 2,
                                "nAchieved": 1,
                            },
                        },
                    ]
                ],
                f,
            )
        clear_parser_caches()
        stats = parse_local_user_stats(1245620)
        self.assertTrue(stats["cached"])
        self.assertEqual(stats["total"], 2)
        self.assertEqual(stats["unlocked_count"], 1)
        self.assertIn("ACH_MARGIT", stats["unlocked_by_id"])
        self.assertEqual(stats["unlocked_by_id"]["ACH_MARGIT"]["unlock_time"], 1700001000)
        self.assertNotIn("ACH_MALENIA", stats["unlocked_by_id"])

    def test_parse_valve_ssr_data_format(self) -> None:
        query_data = {
            "queries": [
                {
                    "queryKey": ["StoreItem", "app_1245620", "default_info"],
                    "state": {"data": {"appid": 1245620, "name": "ELDEN RING"}},
                },
                {
                    "queryKey": ["StoreItem", "app_1245620", "include_assets_without_overrides"],
                    "state": {
                        "data": {
                            "asset_url_format": "steam/apps/1245620/${FILENAME}?t=123",
                            "header": "header.jpg",
                        }
                    },
                },
                {
                    "queryKey": ["StoreItem", "app_2778580", "default_info"],
                    "state": {
                        "data": {"appid": 2778580, "name": "ELDEN RING Shadow of the Erdtree"}
                    },
                },
                {
                    "queryKey": ["StoreItem", "app_2778580", "include_assets_without_overrides"],
                    "state": {
                        "data": {
                            "asset_url_format": "steam/apps/2778580/${FILENAME}?t=123",
                            "header": "dlc_header.jpg",
                        }
                    },
                },
                {
                    "queryKey": ["achievements", 1245620, "percentages"],
                    "state": {"data": {"percentages": {"257": 23.9, "258": 14.2, "259": 50.0}}},
                },
                {
                    "queryKey": ["achievements", 1245620, "schema_v2"],
                    "state": {
                        "data": {
                            "appid": 1245620,
                            "groups": [
                                {
                                    "id": 0,
                                    "name": "",
                                    "dlcappid": 0,
                                    "archived": False,
                                    "achievements": [
                                        {
                                            "internal_key": 257,
                                            "api_name": "ACH01",
                                            "name": "Elden Lord",
                                            "description": 'Achieved the "Elden Lord" ending',
                                            "hidden": False,
                                            "archived": False,
                                            "icon_achieved": "e50726be4aca4d2b1f5f14d36859fc8e6f710097.jpg",
                                        }
                                    ],
                                },
                                {
                                    "id": 1,
                                    "name": "Shadow of the Erdtree",
                                    "dlcappid": 2778580,
                                    "archived": False,
                                    "achievements": [
                                        {
                                            "internal_key": 258,
                                            "api_name": "ACH_MESSMER",
                                            "name": "Messmer the Impaler",
                                            "description": "Defeated Messmer in the Shadow Keep",
                                            "hidden": False,
                                            "archived": False,
                                            "icon_achieved": "cb0aec39fcc664c4e586750177178b6814a52e0d.jpg",
                                        }
                                    ],
                                },
                                {
                                    "id": 2,
                                    "name": "Legacy Colosseum",
                                    "dlcappid": 0,
                                    "archived": True,
                                    "achievements": [
                                        {
                                            "internal_key": 259,
                                            "api_name": "ACH_RETIRED",
                                            "name": "Retired Arena",
                                            "description": "Retired seasonal achievement",
                                            "hidden": False,
                                            "archived": True,
                                            "icon_achieved": "cb0aec39fcc664c4e586750177178b6814a52e0d.jpg",
                                        }
                                    ],
                                },
                            ],
                        }
                    },
                },
            ]
        }
        ssr_payload = {
            "cdn": "cdn.fastly.steamstatic.com",
            "renderContext": {"queryData": json.dumps(query_data)},
        }
        html_doc = f'<html><head><script type="application/json" id="valve-ssr-data">{json.dumps(ssr_payload)}</script></head></html>'
        parsed = parse_steam_community_html(html_doc)
        # Base game title & header must not be overwritten by the DLC StoreItem
        self.assertEqual(parsed["game_title"], "ELDEN RING")
        self.assertEqual(
            parsed["header_image"],
            "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/1245620/header.jpg",
        )
        self.assertEqual(len(parsed["achievements"]), 3)
        ach = parsed["achievements"][0]
        self.assertEqual(ach["id"], "ACH01")
        self.assertEqual(ach["global_percentage"], 23.9)
        self.assertEqual(ach.get("set_id"), 0)
        self.assertEqual(ach.get("set_name"), "Base Game")
        self.assertEqual(
            ach["icon"],
            "https://cdn.fastly.steamstatic.com/steamcommunity/public/images/apps/1245620/e50726be4aca4d2b1f5f14d36859fc8e6f710097.jpg",
        )

        dlc_ach = parsed["achievements"][1]
        self.assertEqual(dlc_ach["id"], "ACH_MESSMER")
        self.assertEqual(dlc_ach.get("set_id"), 1)
        self.assertEqual(dlc_ach.get("set_name"), "Shadow of the Erdtree")
        self.assertEqual(dlc_ach.get("dlc_appid"), 2778580)

        retired_ach = parsed["achievements"][2]
        self.assertTrue(retired_ach.get("archived"))
        self.assertEqual(retired_ach.get("rec_score"), 0.0)

        sets = parsed.get("achievement_sets", [])
        self.assertEqual(len(sets), 3)
        self.assertEqual(sets[0]["name"], "Base Game")
        self.assertEqual(sets[1]["name"], "Shadow of the Erdtree")
        self.assertEqual(sets[1].get("dlc_appid"), 2778580)
        self.assertTrue(sets[2].get("archived"))


if __name__ == "__main__":
    unittest.main()
