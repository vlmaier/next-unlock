import sys
import os
import unittest
import tempfile
import shutil
import asyncio

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from backend.mock_data import get_mock_games, get_mock_game_by_id
from backend.recommendation import rank_achievements
from main import Plugin


class TestBackend(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.settings_path = os.path.join(self.temp_dir, "settings.json")

    def tearDown(self):
        shutil.rmtree(self.temp_dir)

    def test_mock_data_retrieval(self):
        games = get_mock_games()
        self.assertGreater(len(games), 0)
        self.assertEqual(games[0]["name"], "Elden Ring")

        elden = get_mock_game_by_id(1245620)
        self.assertEqual(elden["appid"], 1245620)
        self.assertGreater(len(elden["achievements"]), 0)

    def test_recommendation_ranking_scoring(self):
        elden = get_mock_game_by_id(1245620)
        achievements = elden["achievements"]
        pinned_set = {"ACH_LEGENDARY_ARMAMENTS"}

        ranked = rank_achievements(achievements, pinned_set)

        self.assertIn("up_next", ranked)
        self.assertIn("almost_there", ranked)
        self.assertIn("easy_grabs", ranked)
        self.assertIn("missable", ranked)
        self.assertIn("pinned", ranked)
        self.assertIn("unlocked", ranked)
        self.assertIn("locked", ranked)

        # Check pinned achievement assignment
        pinned_ids = [a["id"] for a in ranked["pinned"]]
        self.assertIn("ACH_LEGENDARY_ARMAMENTS", pinned_ids)

        # Up Next recommendations should be sorted by rec_score descending
        up_next = ranked["up_next"]
        for i in range(len(up_next) - 1):
            self.assertGreaterEqual(up_next[i]["rec_score"], up_next[i + 1]["rec_score"])

    def test_main_plugin_lifecycle_and_settings(self):
        plugin = Plugin()
        plugin.settings_path = self.settings_path

        # Test toggle_pin
        res1 = asyncio.run(plugin.toggle_pin("test_ach_1"))
        self.assertTrue(res1["pinned"])
        self.assertIn("test_ach_1", plugin.pinned_achievements)

        # Test persistence
        plugin.save_settings()
        self.assertTrue(os.path.exists(self.settings_path))

        # Test reload settings
        new_plugin = Plugin()
        new_plugin.settings_path = self.settings_path
        new_plugin.load_settings()
        self.assertIn("test_ach_1", new_plugin.pinned_achievements)

        # Toggle unpin
        res2 = asyncio.run(plugin.toggle_pin("test_ach_1"))
        self.assertFalse(res2["pinned"])


if __name__ == "__main__":
    unittest.main()
