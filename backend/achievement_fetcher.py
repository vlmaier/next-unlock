"""
Steam Community Achievement Scraper & Disk Cache Manager (Spec 02).

Fetches public achievement metadata (names, descriptions, icons, global unlock percentages)
from Steam Community HTML (both modern Valve React SSR and legacy HTML), scores each
achievement with the canonical recommendation formula, and persists a structured envelope
to disk cache for offline/fast recall.
"""

from __future__ import annotations

import contextlib
import gzip
import html
import json
import logging
import os
import re
import ssl
import urllib.request
from collections.abc import Iterable, Mapping

from backend.models import (
    AchievementData,
    FetchedAchievementsEnvelope,
    ParsedCommunityHtmlResult,
)
from backend.recommendation import compute_recommendation_score

logger = logging.getLogger("next_unlock.fetcher")


def get_cache_dir() -> str:
    """Returns directory for caching scraped achievement metadata."""
    env_cache = os.environ.get("NEXT_UNLOCK_CACHE_DIR")
    if env_cache:
        return env_cache

    base_dir = os.environ.get(
        "DECKY_PLUGIN_SETTINGS_DIR",
        os.path.expanduser("~/.config/next-unlock"),
    )
    return os.path.join(base_dir, "cache")


def get_cache_path(appid: int) -> str:
    return os.path.join(get_cache_dir(), f"achievements_{int(appid)}.json")


def _coerce_achievement_list(raw_list: Iterable[object]) -> list[AchievementData]:
    coerced: list[AchievementData] = []
    for item in raw_list:
        if not isinstance(item, Mapping):
            continue
        raw_pct = item.get("global_percentage", 0.0)
        pct = float(raw_pct) if isinstance(raw_pct, (int, float, str)) else 0.0
        raw_ut = item.get("unlock_time")
        unlock_time = int(raw_ut) if isinstance(raw_ut, (int, float)) and int(raw_ut) > 0 else None
        ach: AchievementData = {
            "id": str(item.get("id", "")),
            "name": str(item.get("name", "")),
            "description": str(item.get("description", "")),
            "icon": str(item.get("icon", "")),
            "unlocked": bool(item.get("unlocked", False)),
            "unlock_time": unlock_time,
            "global_percentage": pct,
            "rarity_tier": str(item.get("rarity_tier", "common")),
            "hidden": bool(item.get("hidden", False)),
        }
        cat = item.get("category")
        if isinstance(cat, str) and cat:
            ach["category"] = cat
        rec = item.get("rec_score")
        if isinstance(rec, (int, float)):
            ach["rec_score"] = float(rec)
        prog = item.get("progress")
        if isinstance(prog, Mapping):
            raw_c = prog.get("current", 0)
            raw_m = prog.get("max", 0)
            c_val = float(raw_c) if isinstance(raw_c, (int, float, str)) else 0.0
            m_val = float(raw_m) if isinstance(raw_m, (int, float, str)) else 0.0
            if m_val > 0:
                ach["progress"] = {"current": c_val, "max": m_val}
        coerced.append(ach)
    return coerced


def load_cached_achievements(appid: int) -> FetchedAchievementsEnvelope | None:
    """
    Loads cached achievements from disk, supporting both the canonical dictionary
    envelope `{"appid", "game_title", "header_image", "achievements"}` and legacy raw list files.
    """
    path = get_cache_path(appid)
    if not os.path.exists(path):
        return None
    try:
        with open(path, encoding="utf-8") as f:
            data: object = json.load(f)
            if isinstance(data, Mapping) and isinstance(data.get("achievements"), list):
                ach_list = _coerce_achievement_list(data["achievements"])
                raw_title = data.get("game_title")
                raw_hdr = data.get("header_image")
                return {
                    "appid": int(appid),
                    "game_title": str(raw_title) if isinstance(raw_title, str) else None,
                    "header_image": str(raw_hdr) if isinstance(raw_hdr, str) else None,
                    "achievements": ach_list,
                }
            if isinstance(data, list) and len(data) > 0:
                return {
                    "appid": int(appid),
                    "game_title": None,
                    "header_image": None,
                    "achievements": _coerce_achievement_list(data),
                }
    except Exception as e:
        logger.debug(f"Failed loading cache for appid {appid}: {e}")
    return None


def save_cached_achievements(
    appid: int,
    achievements: Iterable[Mapping[str, object]],
    game_title: str | None = None,
    header_image: str | None = None,
) -> None:
    """Saves achievement list in the canonical dictionary envelope."""
    try:
        cache_dir = get_cache_dir()
        os.makedirs(cache_dir, exist_ok=True)
        path = get_cache_path(appid)
        payload: dict[str, object] = {
            "appid": int(appid),
            "game_title": game_title,
            "achievements": list(achievements),
        }
        if header_image:
            payload["header_image"] = header_image
        with open(path, "w", encoding="utf-8") as f:
            json.dump(payload, f)
    except Exception as e:
        logger.debug(f"Failed saving cache for appid {appid}: {e}")


def _parse_valve_ssr_data(content: str) -> ParsedCommunityHtmlResult | None:
    """
    Parses Valve's modern React SSR <script id="valve-ssr-data"> JSON block on
    https://steamcommunity.com/achievements/<appid>, extracting achievements,
    descriptions (including hidden ones), exact CDN icons, global percentages,
    and store header artwork.
    """
    ssr_match = re.search(
        r'<script[^>]+id="valve-ssr-data"[^>]*>(.*?)</script>',
        content,
        re.DOTALL,
    )
    if not ssr_match:
        return None

    try:
        ssr: object = json.loads(ssr_match.group(1))
        if not isinstance(ssr, Mapping):
            return None
        cdn = str(ssr.get("cdn") or "cdn.fastly.steamstatic.com")
        render_ctx = ssr.get("renderContext")
        if not isinstance(render_ctx, Mapping):
            return None
        qd_raw = render_ctx.get("queryData")
        if not qd_raw:
            return None
        qd: object = json.loads(qd_raw) if isinstance(qd_raw, str) else qd_raw
        if not isinstance(qd, Mapping):
            return None
        queries = qd.get("queries")
        if not isinstance(queries, list):
            return None

        appid_val: int | None = None
        game_title: str | None = None
        header_image: str | None = None
        pcts: Mapping[str, object] = {}
        raw_achs: list[Mapping[str, object]] = []

        for q in queries:
            if not isinstance(q, Mapping):
                continue
            qk = q.get("queryKey")
            state = q.get("state")
            if not isinstance(qk, list) or not isinstance(state, Mapping):
                continue
            data = state.get("data")
            if not isinstance(data, Mapping):
                continue

            if len(qk) >= 3 and qk[0] == "StoreItem" and qk[2] == "default_info":
                raw_name = data.get("name")
                if isinstance(raw_name, str) and raw_name:
                    game_title = raw_name
                raw_aid = data.get("appid")
                if isinstance(raw_aid, int):
                    appid_val = raw_aid
            elif (
                len(qk) >= 3
                and qk[0] == "StoreItem"
                and qk[2] == "include_assets_without_overrides"
            ):
                hdr = data.get("header")
                fmt = data.get("asset_url_format")
                if isinstance(hdr, str) and isinstance(fmt, str) and "${FILENAME}" in fmt:
                    rel_path = fmt.replace("${FILENAME}", hdr).split("?")[0]
                    header_image = (
                        f"https://shared.fastly.steamstatic.com/store_item_assets/{rel_path}"
                    )
                elif isinstance(hdr, str) and appid_val:
                    header_image = (
                        f"https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/"
                        f"{appid_val}/{hdr}"
                    )
            elif len(qk) >= 3 and qk[0] == "achievements" and "percentage" in str(qk[2]):
                raw_p = data.get("percentages")
                if isinstance(raw_p, Mapping):
                    pcts = raw_p
            elif len(qk) >= 3 and qk[0] == "achievements" and qk[2] == "schema_v2":
                raw_aid = data.get("appid")
                if isinstance(raw_aid, int):
                    appid_val = raw_aid
                groups = data.get("groups")
                if isinstance(groups, list):
                    for grp in groups:
                        if isinstance(grp, Mapping):
                            grp_achs = grp.get("achievements")
                            if isinstance(grp_achs, list):
                                for ga in grp_achs:
                                    if isinstance(ga, Mapping):
                                        raw_achs.append(ga)

        if not raw_achs:
            return None

        achievements: list[AchievementData] = []
        seen_ids: set[str] = set()
        for idx, item in enumerate(raw_achs):
            name = str(item.get("name") or f"Achievement {idx + 1}").strip()
            desc = str(item.get("description") or "").strip()
            api_name = str(item.get("api_name") or "").strip()
            clean_slug = re.sub(r"[^a-z0-9_]+", "_", name.lower()).strip("_") or f"item_{idx + 1}"
            ach_id = api_name or f"ach_{clean_slug}"
            if ach_id in seen_ids:
                ach_id = f"{ach_id}_{idx + 1}"
            seen_ids.add(ach_id)

            ik = str(item.get("internal_key", ""))
            raw_pct_val = pcts.get(ik, 0.0)
            try:
                pct = (
                    round(float(raw_pct_val), 1)
                    if isinstance(raw_pct_val, (int, float, str))
                    else 0.0
                )
            except (ValueError, TypeError):
                pct = 0.0

            icon_file = str(item.get("icon_achieved") or item.get("icon_unachieved") or "").strip()
            if icon_file.startswith("http"):
                icon_url = icon_file
            elif icon_file and appid_val:
                icon_url = (
                    f"https://{cdn}/steamcommunity/public/images/apps/{appid_val}/{icon_file}"
                )
            else:
                icon_url = ""

            is_hidden = bool(item.get("hidden", False))
            rarity = "ultra_rare" if pct <= 5.0 else "rare" if pct <= 15.0 else "common"

            ach: AchievementData = {
                "id": ach_id,
                "name": name,
                "description": desc,
                "icon": icon_url,
                "unlocked": False,
                "unlock_time": None,
                "global_percentage": pct,
                "rarity_tier": rarity,
                "hidden": is_hidden,
            }
            ach["rec_score"] = compute_recommendation_score(ach)
            achievements.append(ach)

        return {
            "game_title": game_title,
            "header_image": header_image,
            "achievements": achievements,
        }
    except Exception as e:
        logger.debug(f"Failed parsing valve-ssr-data: {e}")
        return None


def parse_steam_community_html(content: str) -> ParsedCommunityHtmlResult:
    """
    Parses Steam Community stats HTML (both modern Valve React SSR and legacy HTML)
    into {"game_title": str | None, "header_image": str | None, "achievements": list[AchievementData]}.
    Extracted as a pure function for deterministic unit & fixture testing.
    """
    ssr_result = _parse_valve_ssr_data(content)
    if ssr_result and ssr_result["achievements"]:
        return ssr_result

    rows = re.findall(
        r'<div class="achieveRow\s*">(.*?)<div style="clear:\s*both;">',
        content,
        re.DOTALL,
    )
    if not rows:
        rows = re.findall(
            r'<div class="achieveRow[^"]*">(.*?)<div style="clear:\s*both;">',
            content,
            re.DOTALL,
        )

    title_m = re.search(
        r"<title>\s*Steam Community\s*::\s*(.*?)\s*::\s*Achievements\s*</title>",
        content,
        re.DOTALL,
    )
    game_title = html.unescape(title_m.group(1).strip()) if title_m else None

    achievements: list[AchievementData] = []
    seen_ids: set[str] = set()

    for idx, row_html in enumerate(rows):
        icon_m = re.search(r'<img[^>]+src="([^"]+)"', row_html)
        name_m = re.search(r"<h3[^>]*>(.*?)</h3>", row_html, re.DOTALL)
        desc_m = re.search(r"<h5[^>]*>(.*?)</h5>", row_html, re.DOTALL)
        pct_m = re.search(r'<div class="achievePercent">\s*([0-9.]+)%\s*</div>', row_html)

        raw_name = html.unescape(name_m.group(1).strip()) if name_m else f"Achievement {idx + 1}"
        name = re.sub(r"<[^>]+>", "", raw_name).strip()

        raw_desc = html.unescape(desc_m.group(1).strip()) if desc_m else ""
        desc = re.sub(r"<[^>]+>", "", raw_desc).strip()

        icon = icon_m.group(1).strip() if icon_m else ""
        try:
            pct = round(float(pct_m.group(1)), 1) if pct_m else 0.0
        except ValueError:
            pct = 0.0

        is_hidden = "achieveHiddenBox" in row_html or (not desc and "hidden" in row_html.lower())

        clean_slug = re.sub(r"[^a-z0-9_]+", "_", name.lower()).strip("_") or f"item_{idx + 1}"
        ach_id = f"ach_{clean_slug}"
        if ach_id in seen_ids:
            ach_id = f"{ach_id}_{idx + 1}"
        seen_ids.add(ach_id)

        rarity = "ultra_rare" if pct <= 5.0 else "rare" if pct <= 15.0 else "common"

        ach: AchievementData = {
            "id": ach_id,
            "name": name,
            "description": desc,
            "icon": icon,
            "unlocked": False,
            "unlock_time": None,
            "global_percentage": pct,
            "rarity_tier": rarity,
            "hidden": is_hidden,
        }
        ach["rec_score"] = compute_recommendation_score(ach)
        achievements.append(ach)

    return {
        "game_title": game_title,
        "header_image": None,
        "achievements": achievements,
    }


def fetch_achievements_from_steam(
    appid: int,
    force_refresh: bool = False,
) -> FetchedAchievementsEnvelope:
    """
    Fetches public achievement list, names, descriptions, icons, and unlock percentages
    from Steam Community. Uses local disk cache unless `force_refresh=True`.
    """
    appid_int = int(appid)

    if os.environ.get("NEXT_UNLOCK_OFFLINE_SANDBOX") == "1":
        cached_sandbox = load_cached_achievements(appid_int)
        if cached_sandbox is not None:
            return cached_sandbox
        return {
            "appid": appid_int,
            "game_title": None,
            "header_image": None,
            "achievements": [],
        }

    if not force_refresh:
        cached = load_cached_achievements(appid_int)
        if cached and cached["achievements"]:
            return cached

    url = f"https://steamcommunity.com/achievements/{appid_int}?l=english"
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            ),
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "gzip",
            "Cookie": "wants_mature_content=1; birthtime=0; lastagecheckage=1-0-1990",
        },
    )

    try:
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
        html_bytes: bytes = response.read()
        if html_bytes[:2] == b"\x1f\x8b":
            with contextlib.suppress(Exception):
                html_bytes = gzip.decompress(html_bytes)
        content = html_bytes.decode("utf-8", errors="ignore")

        parsed = parse_steam_community_html(content)
        achievements = parsed["achievements"]
        game_title = parsed["game_title"]
        header_image = parsed["header_image"]

        if achievements:
            save_cached_achievements(
                appid_int,
                achievements,
                game_title=game_title,
                header_image=header_image,
            )
            return {
                "appid": appid_int,
                "game_title": game_title,
                "header_image": header_image,
                "achievements": achievements,
            }
    except Exception as e:
        logger.warning(f"Error fetching achievements from steamcommunity for {appid_int}: {e}")

    # Fallback to local cache if network fails
    cached = load_cached_achievements(appid_int)
    if cached:
        return cached

    return {
        "appid": appid_int,
        "game_title": None,
        "header_image": None,
        "achievements": [],
    }
