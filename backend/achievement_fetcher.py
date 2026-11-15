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

from backend.missables_resolver import enrich_achievements_with_missables
from backend.models import (
    AchievementData,
    AchievementSetData,
    FetchedAchievementsEnvelope,
    ParsedCommunityHtmlResult,
)
from backend.recommendation import compute_achievement_sets, compute_recommendation_score

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
        raw_set_id = item.get("set_id")
        if isinstance(raw_set_id, int):
            ach["set_id"] = raw_set_id
        raw_set_name = item.get("set_name")
        if isinstance(raw_set_name, str) and raw_set_name:
            ach["set_name"] = raw_set_name
        raw_dlc = item.get("dlc_appid")
        if isinstance(raw_dlc, int) and raw_dlc > 0:
            ach["dlc_appid"] = raw_dlc
        if bool(item.get("archived", False)):
            ach["archived"] = True
        if bool(item.get("is_missable", False)) or item.get("category") == "Missable":
            ach["is_missable"] = True
        raw_reason = item.get("missable_reason")
        if isinstance(raw_reason, str) and raw_reason:
            ach["missable_reason"] = raw_reason
        if bool(item.get("is_unobtainable", False)):
            ach["is_unobtainable"] = True
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
    envelope `{"appid", "game_title", "header_image", "achievements", "achievement_sets"}`
    and legacy raw list files.
    """
    path = get_cache_path(appid)
    if not os.path.exists(path):
        return None
    try:
        with open(path, encoding="utf-8") as f:
            data: object = json.load(f)
            if isinstance(data, Mapping) and isinstance(data.get("achievements"), list):
                ach_list = enrich_achievements_with_missables(
                    int(appid),
                    _coerce_achievement_list(data["achievements"]),
                    allow_network=False,
                )
                raw_title = data.get("game_title")
                raw_hdr = data.get("header_image")
                raw_sets = data.get("achievement_sets")
                typed_raw_sets = (
                    [s for s in raw_sets if isinstance(s, Mapping)]
                    if isinstance(raw_sets, list)
                    else None
                )
                computed_sets = compute_achievement_sets(ach_list, typed_raw_sets)
                return {
                    "appid": int(appid),
                    "game_title": str(raw_title) if isinstance(raw_title, str) else None,
                    "header_image": str(raw_hdr) if isinstance(raw_hdr, str) else None,
                    "achievements": ach_list,
                    "achievement_sets": computed_sets,
                }
            if isinstance(data, list) and len(data) > 0:
                ach_list = enrich_achievements_with_missables(
                    int(appid),
                    _coerce_achievement_list(data),
                    allow_network=False,
                )
                return {
                    "appid": int(appid),
                    "game_title": None,
                    "header_image": None,
                    "achievements": ach_list,
                    "achievement_sets": compute_achievement_sets(ach_list),
                }
    except Exception as e:
        logger.debug(f"Failed loading cache for appid {appid}: {e}")
    return None


def save_cached_achievements(
    appid: int,
    achievements: Iterable[Mapping[str, object]],
    game_title: str | None = None,
    header_image: str | None = None,
    achievement_sets: Iterable[Mapping[str, object]] | None = None,
) -> None:
    """Saves achievement list and sets in the canonical dictionary envelope."""
    try:
        cache_dir = get_cache_dir()
        os.makedirs(cache_dir, exist_ok=True)
        path = get_cache_path(appid)
        ach_list = list(achievements)
        computed_sets = compute_achievement_sets(ach_list, achievement_sets)
        payload: dict[str, object] = {
            "appid": int(appid),
            "game_title": game_title,
            "achievements": ach_list,
            "achievement_sets": computed_sets,
        }
        if header_image:
            payload["header_image"] = header_image
        with open(path, "w", encoding="utf-8") as f:
            json.dump(payload, f)
    except Exception as e:
        logger.debug(f"Failed saving cache for appid {appid}: {e}")


def _extract_store_appid(qk_second: object, data: Mapping[str, object]) -> int | None:
    raw_aid = data.get("appid")
    if isinstance(raw_aid, int) and raw_aid > 0:
        return raw_aid
    if isinstance(qk_second, str) and qk_second.startswith("app_"):
        with contextlib.suppress(ValueError):
            return int(qk_second[4:])
    return None


def _parse_valve_ssr_data(content: str) -> ParsedCommunityHtmlResult | None:
    """
    Parses Valve's modern React SSR <script id="valve-ssr-data"> JSON block on
    https://steamcommunity.com/achievements/<appid>, extracting achievements,
    Steam Achievement Sets (`schema_v2` `groups`), DLC sets (`dlcappid`),
    archived status, descriptions (including hidden ones), exact CDN icons,
    global percentages, and store header artwork.
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
        store_names: dict[int, str] = {}
        store_headers: dict[int, str] = {}
        pcts: Mapping[str, object] = {}
        raw_groups: list[Mapping[str, object]] = []

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
                s_aid = _extract_store_appid(qk[1], data)
                raw_name = data.get("name")
                if s_aid and isinstance(raw_name, str) and raw_name:
                    store_names[s_aid] = raw_name
                    if appid_val is None:
                        appid_val = s_aid
            elif (
                len(qk) >= 3
                and qk[0] == "StoreItem"
                and qk[2] == "include_assets_without_overrides"
            ):
                s_aid = _extract_store_appid(qk[1], data)
                hdr = data.get("header")
                fmt = data.get("asset_url_format")
                if s_aid and isinstance(hdr, str):
                    if isinstance(fmt, str) and "${FILENAME}" in fmt:
                        rel_path = fmt.replace("${FILENAME}", hdr).split("?")[0]
                        store_headers[s_aid] = (
                            f"https://shared.fastly.steamstatic.com/store_item_assets/{rel_path}"
                        )
                    else:
                        store_headers[s_aid] = (
                            f"https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/"
                            f"{s_aid}/{hdr}"
                        )
            elif len(qk) >= 3 and qk[0] == "achievements" and "percentage" in str(qk[2]):
                raw_p = data.get("percentages")
                if isinstance(raw_p, Mapping):
                    pcts = raw_p
            elif len(qk) >= 3 and qk[0] == "achievements" and qk[2] == "schema_v2":
                raw_aid = data.get("appid")
                if isinstance(raw_aid, int):
                    appid_val = raw_aid
                elif isinstance(qk[1], int):
                    appid_val = qk[1]
                groups = data.get("groups")
                if isinstance(groups, list):
                    for grp in groups:
                        if isinstance(grp, Mapping):
                            raw_groups.append(grp)

        if not raw_groups:
            return None

        game_title = store_names.get(appid_val) if appid_val else None
        if not game_title and store_names:
            game_title = next(iter(store_names.values()))

        header_image = store_headers.get(appid_val) if appid_val else None
        if not header_image and store_headers:
            header_image = next(iter(store_headers.values()))

        achievements: list[AchievementData] = []
        raw_sets_meta: list[dict[str, object]] = []
        seen_ids: set[str] = set()
        ach_counter = 0

        for grp in raw_groups:
            raw_gid = grp.get("id", 0)
            gid = int(raw_gid) if isinstance(raw_gid, (int, float, str)) else 0
            raw_gname = str(grp.get("name") or "").strip()
            gname = raw_gname if raw_gname else "Base Game"
            raw_dlc = grp.get("dlcappid", 0)
            dlc_appid = int(raw_dlc) if isinstance(raw_dlc, (int, float, str)) else 0
            grp_archived = bool(grp.get("archived", False))

            set_meta: dict[str, object] = {
                "id": gid,
                "name": gname,
                "archived": grp_archived,
            }
            if dlc_appid > 0:
                set_meta["dlc_appid"] = dlc_appid
                if dlc_appid in store_headers:
                    set_meta["header_image"] = store_headers[dlc_appid]
            raw_sets_meta.append(set_meta)

            grp_achs = grp.get("achievements")
            if not isinstance(grp_achs, list):
                continue

            for item in grp_achs:
                if not isinstance(item, Mapping):
                    continue
                ach_counter += 1
                name = str(item.get("name") or f"Achievement {ach_counter}").strip()
                desc = str(item.get("description") or "").strip()
                api_name = str(item.get("api_name") or "").strip()
                clean_slug = (
                    re.sub(r"[^a-z0-9_]+", "_", name.lower()).strip("_") or f"item_{ach_counter}"
                )
                ach_id = api_name or f"ach_{clean_slug}"
                if ach_id in seen_ids:
                    ach_id = f"{ach_id}_{ach_counter}"
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

                icon_file = str(
                    item.get("icon_achieved") or item.get("icon_unachieved") or ""
                ).strip()
                if icon_file.startswith("http"):
                    icon_url = icon_file
                elif icon_file and appid_val:
                    icon_url = (
                        f"https://{cdn}/steamcommunity/public/images/apps/{appid_val}/{icon_file}"
                    )
                else:
                    icon_url = ""

                is_hidden = bool(item.get("hidden", False))
                is_archived = bool(item.get("archived", False)) or grp_archived
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
                    "set_id": gid,
                    "set_name": gname,
                }
                if dlc_appid > 0:
                    ach["dlc_appid"] = dlc_appid
                if is_archived:
                    ach["archived"] = True
                ach["rec_score"] = compute_recommendation_score(ach)
                achievements.append(ach)

        if not achievements:
            return None

        computed_sets: list[AchievementSetData] = compute_achievement_sets(
            achievements, raw_sets_meta
        )
        return {
            "game_title": game_title,
            "header_image": header_image,
            "achievements": achievements,
            "achievement_sets": computed_sets,
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
        raw_sets = parsed.get("achievement_sets")

        if achievements:
            achievements = enrich_achievements_with_missables(
                appid_int,
                achievements,
                allow_network=True,
            )
            computed_sets = compute_achievement_sets(achievements, raw_sets)
            save_cached_achievements(
                appid_int,
                achievements,
                game_title=game_title,
                header_image=header_image,
                achievement_sets=computed_sets,
            )
            return {
                "appid": appid_int,
                "game_title": game_title,
                "header_image": header_image,
                "achievements": achievements,
                "achievement_sets": computed_sets,
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
