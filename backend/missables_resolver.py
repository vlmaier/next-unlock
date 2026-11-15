"""
3-Tier Hybrid Missable & Unobtainable Achievement Resolver (Spec 02 & Spec 03).

Tier 1: Curated Bundled Missables Registry + Open-Source `achievement-scavenger-database`
        GitHub Raw CDN (`https://raw.githubusercontent.com/batureren/achievement-scavenger-database/main/games/<appid>.json`).
Tier 2: Top-Rated Steam Community Guide "Missable" / "Point of No Return" subsection parser.
Tier 3: SteamHunters public API (`https://steamhunters.com/api/apps/<appid>/achievements`)
        `obtainability != 0` check for broken/unobtainable achievements.
"""

from __future__ import annotations

import contextlib
import html
import json
import logging
import os
import re
import ssl
import urllib.request
from collections.abc import Iterable, Mapping
from typing import TypedDict

from backend.models import AchievementData
from backend.recommendation import compute_recommendation_score

logger = logging.getLogger("next_unlock.missables")

GITHUB_SCAVENGER_DB_URL = (
    "https://raw.githubusercontent.com/batureren/achievement-scavenger-database/main/games"
)
STEAMHUNTERS_API_URL = "https://steamhunters.com/api/apps"


class MissableMetadata(TypedDict, total=False):
    is_missable: bool
    missable_reason: str
    is_unobtainable: bool


def _normalize_key(raw: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", raw.lower()).strip("_")


# Bundled high-precision missable registry for major RPG / Soulslike / Metroidvania titles.
# Keys inside each game dict can be either exact achievement IDs (lowercased) or normalized achievement names.
CURATED_MISSABLES: dict[int, dict[str, str]] = {
    1245620: {
        "ach_legendary_armaments": (
            "Must collect the Bolt of Gransax in Leyndell, Royal Capital before defeating Maliketh in Crumbling Farum Azula."
        ),
        "legendary_armaments": (
            "Must collect the Bolt of Gransax in Leyndell, Royal Capital before defeating Maliketh in Crumbling Farum Azula."
        ),
        "ach_age_of_stars": (
            "Complete Ranni's questline and summon her sign after the final boss before choosing another ending."
        ),
        "age_of_the_stars": (
            "Complete Ranni's questline and summon her sign after the final boss before choosing another ending."
        ),
    },
    1091500: {
        "ach_night_city_legend": (
            "Complete Rogue's side quests (Blistering Love) before the Nocturne Op55N1 point of no return."
        ),
        "legend_of_the_afterlife": (
            "Complete Rogue's side quests (Blistering Love) before the Nocturne Op55N1 point of no return."
        ),
        "the_devil": (
            "Save Takemura during Search and Destroy before escaping the apartment building."
        ),
    },
    292030: {
        "card_collector": (
            "Win missable Gwent cards during A Matter of Life and Death, A Dangerous Game, and High Stakes."
        ),
        "full_crew": (
            "Recruit all possible allies (and do not kill Keira Metz) before entering The Isle of Mists."
        ),
        "assassin_of_kings": (
            "Complete Eye for an Eye, A Deadly Plot, and Redania's Most Wanted without shoving Dijkstra forcefully."
        ),
    },
    1086940: {
        "leave_no_one_behind": (
            "Save every Tiefling refugee across Acts 1, 2, and 3—any Tiefling death locks out this playthrough."
        ),
        "she_cannot_be_caged": (
            "Rescue Sazza at the Emerald Grove, Goblin Camp, and Moonrise Towers across Acts 1 and 2."
        ),
    },
    367520: {
        "neglect": (
            "Leave Zote in Greenpath without rescuing him from the Vengefly King (mutually exclusive with Rivalry)."
        ),
        "purity": (
            "Strike the Nailsmith after upgrading to the Pure Nail (mutually exclusive with Happy Couple)."
        ),
        "banishment": (
            "Help Brumm banish the Grimm Troupe in Deepnest (mutually exclusive with Ritual)."
        ),
    },
    374320: {
        "master_of_expression": (
            "Acquire Yellowfinger Heysel's Proper Bow gesture before defeating the Abyss Watchers."
        ),
        "usurpation_of_fire": (
            "Draw out True Strength 5 times with Yoel before defeating the Abyss Watchers."
        ),
    },
    814380: {
        "shura": ("Choose to obey the Iron Code when confronting Owl atop Ashina Castle."),
    },
}


def _truncate_reason(text: str, max_len: int = 160) -> str:
    cleaned = re.sub(r"\s+", " ", text).strip()
    if len(cleaned) <= max_len:
        return cleaned
    sentence_end = cleaned.find(". ")
    if 25 <= sentence_end <= max_len:
        return cleaned[: sentence_end + 1]
    return cleaned[: max_len - 1].rstrip() + "…"


def parse_scavenger_db_payload(data: object) -> dict[str, MissableMetadata]:
    """
    Parses a JSON payload from `batureren/achievement-scavenger-database`
    (`games/<appid>.json`) into a lookup map keyed by normalized ID and name.
    """
    result: dict[str, MissableMetadata] = {}
    if not isinstance(data, Mapping):
        return result
    raw_achs = data.get("achievements")
    if not isinstance(raw_achs, list):
        return result

    for item in raw_achs:
        if not isinstance(item, Mapping):
            continue
        if not bool(item.get("is_missable", False)):
            continue
        apiname = str(item.get("apiname") or "").strip()
        display_name = str(item.get("display_name") or "").strip()
        chapter = str(item.get("chapter") or "").strip()
        hint = str(item.get("hint") or "").strip()

        reason_parts: list[str] = []
        if chapter and chapter.lower() not in ("completion", "miscellaneous", "general"):
            reason_parts.append(f"[{chapter}]")
        if hint:
            reason_parts.append(_truncate_reason(hint, 140))
        reason = " ".join(reason_parts).strip()

        meta: MissableMetadata = {"is_missable": True}
        if reason:
            meta["missable_reason"] = reason

        if apiname:
            result[apiname.lower()] = meta
            result[_normalize_key(apiname)] = meta
        if display_name:
            result[_normalize_key(display_name)] = meta

    return result


def parse_steam_guide_missables(
    guide_html: str,
    achievements: Iterable[Mapping[str, object]],
) -> dict[str, MissableMetadata]:
    """
    Parses a Steam Community Guide HTML page for subsections titled "Missable" / "Point of No Return"
    or inline "MISSABLE WARNING" / "[Missable]" callouts, cross-referencing achievement names.
    """
    result: dict[str, MissableMetadata] = {}
    if not guide_html:
        return result

    ach_entries: list[tuple[str, str, str]] = []
    for ach in achievements:
        aid = str(ach.get("id") or "").strip()
        aname = str(ach.get("name") or "").strip()
        if aid and len(aname) >= 3:
            ach_entries.append((aid.lower(), _normalize_key(aname), aname))

    if not ach_entries:
        return result

    # Extract subsection blocks: <div class="subSectionTitle">...</div> ... <div class="subSectionDesc">...</div>
    subsections = re.findall(
        r'class="subSectionTitle"[^>]*>(.*?)</div>\s*<div class="subSectionDesc"[^>]*>(.*?)</div>\s*</div>',
        guide_html,
        re.DOTALL | re.IGNORECASE,
    )

    missable_texts: list[str] = []
    for raw_title, raw_body in subsections:
        clean_title = html.unescape(re.sub(r"<[^>]+>", " ", raw_title)).strip().lower()
        clean_body = html.unescape(re.sub(r"<[^>]+>", " ", raw_body)).strip()
        if any(
            kw in clean_title
            for kw in ("missable", "point of no return", "watch out", "lockout", "before you")
        ):
            missable_texts.append(clean_body)
        elif "missable" in clean_body.lower():
            # Extract lines/paragraphs mentioning missable inside general walkthrough sections
            for line in re.split(r"[\r\n]+|(?<=[.!?])\s+", clean_body):
                if "missable" in line.lower():
                    missable_texts.append(line)

    # Also check if the guide title itself is dedicated to missable achievements
    guide_title_m = re.search(
        r'class="workshopItemTitle"[^>]*>(.*?)</div>', guide_html, re.DOTALL | re.IGNORECASE
    )
    if guide_title_m and "missable" in guide_title_m.group(1).lower() and not missable_texts:
        full_clean = html.unescape(re.sub(r"<[^>]+>", " ", guide_html))
        missable_texts.append(full_clean)

    if not missable_texts:
        return result

    combined_corpus = "\n".join(missable_texts)

    for aid_lower, norm_name, display_name in ach_entries:
        pattern = re.compile(r"\b" + re.escape(display_name) + r"\b", re.IGNORECASE)
        match = pattern.search(combined_corpus)
        if not match:
            continue

        # Extract a short context window after the achievement name if available
        start = match.end()
        snippet_window = combined_corpus[start : start + 220].lstrip(" :—–-•*.")
        first_sentence = re.split(r"[\r\n]+|(?<=[.!?])\s+", snippet_window)[0].strip()
        reason = (
            _truncate_reason(first_sentence, 140)
            if len(first_sentence) >= 12
            else "Flagged as missable in top-rated Steam Community Achievement Guide."
        )
        meta: MissableMetadata = {
            "is_missable": True,
            "missable_reason": reason,
        }
        result[aid_lower] = meta
        result[norm_name] = meta

    return result


def parse_steamhunters_obtainability(data: object) -> set[str]:
    """
    Parses `https://steamhunters.com/api/apps/<appid>/achievements` JSON array
    and returns normalized identifiers (`apiName` and normalized `name`) for achievements
    where `obtainability != 0` (broken / unobtainable / discontinued).
    """
    unobtainable_keys: set[str] = set()
    if not isinstance(data, list):
        return unobtainable_keys

    for item in data:
        if not isinstance(item, Mapping):
            continue
        raw_obt = item.get("obtainability", 0)
        obt = int(raw_obt) if isinstance(raw_obt, (int, float)) else 0
        if obt != 0:
            api_name = str(item.get("apiName") or "").strip()
            name = str(item.get("name") or "").strip()
            if api_name:
                unobtainable_keys.add(api_name.lower())
                unobtainable_keys.add(_normalize_key(api_name))
            if name:
                unobtainable_keys.add(_normalize_key(name))

    return unobtainable_keys


def _http_get_text(url: str, timeout: float = 2.5) -> str | None:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            ),
            "Accept-Language": "en-US,en;q=0.9",
        },
    )
    try:
        ssl_ctx = ssl.create_default_context()
        ssl_ctx.check_hostname = False
        ssl_ctx.verify_mode = ssl.CERT_NONE
    except Exception:
        ssl_ctx = None

    try:
        resp = (
            urllib.request.urlopen(req, timeout=timeout, context=ssl_ctx)
            if ssl_ctx
            else urllib.request.urlopen(req, timeout=timeout)
        )
        raw: bytes = resp.read()
        return raw.decode("utf-8", errors="ignore")
    except Exception as e:
        logger.debug(f"Missables HTTP lookup skipped for {url}: {e}")
        return None


def enrich_achievements_with_missables(
    appid: int,
    achievements: list[AchievementData],
    allow_network: bool = True,
) -> list[AchievementData]:
    """
    Enriches achievements with `is_missable`, `missable_reason`, and `is_unobtainable`
    using the 3-tier hybrid pipeline. Safe for offline execution when `allow_network=False`
    or `NEXT_UNLOCK_OFFLINE_SANDBOX=1`.
    """
    if not achievements:
        return achievements

    appid_int = int(appid)
    is_offline = not allow_network or os.environ.get("NEXT_UNLOCK_OFFLINE_SANDBOX") == "1"

    missable_lookup: dict[str, MissableMetadata] = {}
    unobtainable_keys: set[str] = set()

    # Tier 1a: Bundled high-precision curated missables
    bundled = CURATED_MISSABLES.get(appid_int)
    if bundled:
        for key, reason in bundled.items():
            missable_lookup[key.lower()] = {
                "is_missable": True,
                "missable_reason": reason,
            }

    # Tier 1b: Achievement Scavenger open-source GitHub Raw CDN
    if not missable_lookup and not is_offline:
        raw_json = _http_get_text(f"{GITHUB_SCAVENGER_DB_URL}/{appid_int}.json", timeout=2.2)
        if raw_json:
            with contextlib.suppress(Exception):
                parsed_json: object = json.loads(raw_json)
                missable_lookup.update(parse_scavenger_db_payload(parsed_json))

    # Tier 2: Top-Rated Steam Community Guide "Missable" Section Parser (fallback)
    if not missable_lookup and not is_offline:
        search_url = (
            f"https://steamcommunity.com/app/{appid_int}/guides/"
            f"?searchText=missable&browsesort=toprated&browsefilter=toprated&requiredtags%5B%5D=English&l=english"
        )
        search_html = _http_get_text(search_url, timeout=2.5)
        if search_html:
            guide_links = re.findall(
                r"https://steamcommunity\.com/sharedfiles/filedetails/\?id=\d+",
                search_html,
            )
            if guide_links:
                guide_html = _http_get_text(guide_links[0], timeout=2.5)
                if guide_html:
                    missable_lookup.update(parse_steam_guide_missables(guide_html, achievements))

    # Tier 3: SteamHunters Public API for broken/unobtainable achievements
    if not is_offline:
        sh_json = _http_get_text(
            f"{STEAMHUNTERS_API_URL}/{appid_int}/achievements",
            timeout=2.0,
        )
        if sh_json:
            with contextlib.suppress(Exception):
                sh_data: object = json.loads(sh_json)
                unobtainable_keys.update(parse_steamhunters_obtainability(sh_data))

    for ach in achievements:
        aid_lower = ach["id"].lower()
        norm_id = _normalize_key(ach["id"])
        norm_name = _normalize_key(ach["name"])

        # Preserve pre-existing explicit Missable tag or flags
        if ach.get("category") == "Missable":
            ach["is_missable"] = True

        matched_meta = (
            missable_lookup.get(aid_lower)
            or missable_lookup.get(norm_id)
            or missable_lookup.get(norm_name)
        )
        if matched_meta:
            if matched_meta.get("is_missable"):
                ach["is_missable"] = True
            reason = matched_meta.get("missable_reason")
            if reason and not ach.get("missable_reason"):
                ach["missable_reason"] = reason

        if (
            aid_lower in unobtainable_keys
            or norm_id in unobtainable_keys
            or norm_name in unobtainable_keys
        ):
            ach["is_unobtainable"] = True

        ach["rec_score"] = compute_recommendation_score(ach)

    return achievements
