#!/usr/bin/env python3
"""
CLI RPC Bridge for Next Unlock local full-stack development and integration testing.
Executes `main.py` Plugin methods against a real or fixture Steam environment and outputs JSON.
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
from collections.abc import Mapping

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from backend.achievement_fetcher import save_cached_achievements  # noqa: E402
from backend.mock_data import get_mock_games  # noqa: E402
from main import Plugin  # noqa: E402


def ensure_dev_sandbox_fixtures(sandbox_dir: str) -> None:
    """Seeds a realistic local Steam root (libraryfolders.vdf + .acf files + achievement cache)."""
    steam_root = os.path.join(sandbox_dir, "steam_root")
    steamapps = os.path.join(steam_root, "steamapps")
    cache_dir = os.path.join(sandbox_dir, "cache")
    settings_path = os.path.join(sandbox_dir, "settings.json")
    os.makedirs(steamapps, exist_ok=True)
    os.makedirs(cache_dir, exist_ok=True)

    os.environ.setdefault("NEXT_UNLOCK_STEAM_ROOT", steam_root)
    os.environ.setdefault("NEXT_UNLOCK_CACHE_DIR", cache_dir)
    os.environ.setdefault("NEXT_UNLOCK_SETTINGS_PATH", settings_path)
    os.environ.setdefault("NEXT_UNLOCK_OFFLINE_SANDBOX", "1")

    if not os.path.exists(settings_path):
        with open(settings_path, "w", encoding="utf-8") as f:
            json.dump(
                {
                    "pinned": ["ACH_LEGENDARY_ARMAMENTS"],
                    "unlocked_overrides": {},
                    "last_selected_appid": None,
                },
                f,
            )

    vdf_path = os.path.join(steamapps, "libraryfolders.vdf")
    if not os.path.exists(vdf_path):
        with open(vdf_path, "w", encoding="utf-8") as f:
            f.write(f'"libraryfolders"\n{{\n\t"0"\n\t{{\n\t\t"path"\t\t"{steam_root}"\n\t}}\n}}\n')

    mock_games = get_mock_games()
    for idx, g in enumerate(mock_games):
        appid = g["appid"]
        acf_path = os.path.join(steamapps, f"appmanifest_{appid}.acf")
        if not os.path.exists(acf_path):
            last_played = 1720000000 - (idx * 86400)
            with open(acf_path, "w", encoding="utf-8") as f:
                f.write(
                    f'"AppState"\n{{\n\t"appid"\t\t"{appid}"\n'
                    f'\t"name"\t\t"{g["name"]}"\n'
                    f'\t"LastPlayed"\t\t"{last_played}"\n}}\n'
                )
        cache_file = os.path.join(cache_dir, f"achievements_{appid}.json")
        if not os.path.exists(cache_file):
            save_cached_achievements(
                appid,
                g["achievements"],
                game_title=g["name"],
                header_image=g["header_image"],
                achievement_sets=g.get("achievement_sets"),
            )

    # Also include an installed game with 0 achievements to test the 0-achievement state
    zero_acf = os.path.join(steamapps, "appmanifest_999999.acf")
    if not os.path.exists(zero_acf):
        with open(zero_acf, "w", encoding="utf-8") as f:
            f.write(
                '"AppState"\n{\n\t"appid"\t\t"999999"\n'
                '\t"name"\t\t"Untracked Indie Prototype"\n'
                '\t"LastPlayed"\t\t"1700000000"\n}\n'
            )
    zero_cache = os.path.join(cache_dir, "achievements_999999.json")
    if not os.path.exists(zero_cache):
        save_cached_achievements(
            999999,
            [],
            game_title="Untracked Indie Prototype",
            header_image="https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/340/header.jpg",
        )


async def dispatch_rpc(payload: Mapping[str, object]) -> dict[str, object]:
    sandbox_dir = os.environ.get(
        "NEXT_UNLOCK_SANDBOX_DIR",
        os.path.join(ROOT_DIR, ".dev_sandbox"),
    )
    if not os.environ.get("NEXT_UNLOCK_STEAM_ROOT"):
        ensure_dev_sandbox_fixtures(sandbox_dir)

    plugin = Plugin()
    method_name = str(payload.get("method", ""))
    raw_args = payload.get("args", [])
    args: list[object] = list(raw_args) if isinstance(raw_args, list) else [raw_args]

    if method_name == "get_active_app":
        return {"success": True, "result": await plugin.get_active_app()}
    if method_name == "get_games":
        force = bool(args[0]) if len(args) > 0 else False
        return {"success": True, "result": await plugin.get_games(force_refresh=force)}
    if method_name == "get_game_details":
        raw_id = args[0] if len(args) > 0 else 0
        appid = int(raw_id) if isinstance(raw_id, (int, float, str)) else 0
        force = bool(args[1]) if len(args) > 1 else False
        return {
            "success": True,
            "result": await plugin.get_game_details(appid, force_refresh=force),
        }
    if method_name == "toggle_pin":
        ach_id = str(args[0]) if len(args) > 0 else ""
        return {"success": True, "result": await plugin.toggle_pin(ach_id)}
    if method_name == "get_pinned":
        return {"success": True, "result": await plugin.get_pinned()}
    if method_name == "sync_unlocked_achievements":
        raw_id = args[0] if len(args) > 0 else 0
        appid = int(raw_id) if isinstance(raw_id, (int, float, str)) else 0
        raw_ids = args[1] if len(args) > 1 and isinstance(args[1], list) else []
        unlocked_ids = [str(x) for x in raw_ids]
        return {
            "success": True,
            "result": await plugin.sync_unlocked_achievements(appid, unlocked_ids),
        }

    raise ValueError(f"Unsupported RPC method: {method_name}")


def main() -> None:
    raw = sys.argv[1] if len(sys.argv) > 1 else sys.stdin.read()
    parsed: object = json.loads(raw) if raw.strip() else {}
    payload = parsed if isinstance(parsed, Mapping) else {}
    res = asyncio.run(dispatch_rpc(payload))
    print(json.dumps(res))


if __name__ == "__main__":
    main()
