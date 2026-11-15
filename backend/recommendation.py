"""
Canonical Recommendation & Ranking Engine for Next Unlock (Spec 03).

Single source of truth for scoring and ranking achievements on the backend.
Must remain 100% mathematically aligned with `rankAchievements` in `src/services/steamApi.ts`.
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping

from backend.models import (
    AchievementData,
    AchievementProgress,
    AchievementSetData,
    RankedAchievementsData,
)


def get_progress_ratio(ach: Mapping[str, object]) -> float:
    """
    Returns multi-step progress ratio in [0.0, 1.0].
    Only multi-step achievements (max > 1 and current > 0) contribute partial progress.
    """
    progress = ach.get("progress")
    if isinstance(progress, Mapping):
        try:
            raw_max = progress.get("max", 0)
            raw_cur = progress.get("current", 0)
            max_val = float(raw_max) if isinstance(raw_max, (int, float, str)) else 0.0
            cur_val = float(raw_cur) if isinstance(raw_cur, (int, float, str)) else 0.0
            if max_val > 1 and cur_val > 0:
                return min(1.0, max(0.0, cur_val / max_val))
        except (TypeError, ValueError):
            return 0.0
    return 0.0


def compute_recommendation_score(ach: Mapping[str, object]) -> float:
    """
    Computes the canonical Next Unlock recommendation score (Spec 03):
      rec_score = round((ratio * 60.0) + (global_pct * 0.8) + visibility_bonus, 1)

    Higher score = easier / closer to completion = recommended next.
    Unlocked and archived (retired) achievements always score 0.0.
    """
    if bool(ach.get("unlocked")) or bool(ach.get("archived")):
        return 0.0

    ratio = get_progress_ratio(ach)
    raw_pct = ach.get("global_percentage", 0.0)
    try:
        global_pct = float(raw_pct) if isinstance(raw_pct, (int, float, str)) else 0.0
    except (TypeError, ValueError):
        global_pct = 0.0
    global_pct = min(100.0, max(0.0, global_pct))

    is_hidden = bool(ach.get("hidden", False))
    desc = str(ach.get("description") or "").strip()
    visibility_bonus = 15.0 if (not is_hidden and len(desc) > 0) else 0.0

    score = (ratio * 60.0) + (global_pct * 0.8) + visibility_bonus
    return round(score, 1)


def _clone_achievement(
    raw_ach: Mapping[str, object],
    is_pinned: bool,
    rec_score: float,
) -> AchievementData:
    raw_pct = raw_ach.get("global_percentage", 0.0)
    pct = float(raw_pct) if isinstance(raw_pct, (int, float, str)) else 0.0
    raw_ut = raw_ach.get("unlock_time")
    unlock_time = int(raw_ut) if isinstance(raw_ut, (int, float)) and int(raw_ut) > 0 else None

    ach: AchievementData = {
        "id": str(raw_ach.get("id", "")),
        "name": str(raw_ach.get("name", "")),
        "description": str(raw_ach.get("description", "")),
        "icon": str(raw_ach.get("icon", "")),
        "unlocked": bool(raw_ach.get("unlocked", False)),
        "unlock_time": unlock_time,
        "global_percentage": pct,
        "rarity_tier": str(raw_ach.get("rarity_tier", "common")),
        "hidden": bool(raw_ach.get("hidden", False)),
        "is_pinned": is_pinned,
        "rec_score": rec_score,
    }
    cat = raw_ach.get("category")
    if isinstance(cat, str) and cat:
        ach["category"] = cat

    raw_set_id = raw_ach.get("set_id")
    if isinstance(raw_set_id, int):
        ach["set_id"] = raw_set_id
    raw_set_name = raw_ach.get("set_name")
    if isinstance(raw_set_name, str) and raw_set_name:
        ach["set_name"] = raw_set_name
    raw_dlc = raw_ach.get("dlc_appid")
    if isinstance(raw_dlc, int) and raw_dlc > 0:
        ach["dlc_appid"] = raw_dlc
    if bool(raw_ach.get("archived", False)):
        ach["archived"] = True

    prog = raw_ach.get("progress")
    if isinstance(prog, Mapping):
        raw_c = prog.get("current", 0)
        raw_m = prog.get("max", 0)
        c_val = float(raw_c) if isinstance(raw_c, (int, float, str)) else 0.0
        m_val = float(raw_m) if isinstance(raw_m, (int, float, str)) else 0.0
        if m_val > 0:
            typed_prog: AchievementProgress = {"current": c_val, "max": m_val}
            ach["progress"] = typed_prog
    return ach


def compute_achievement_sets(
    achievements: Iterable[Mapping[str, object]],
    raw_sets: Iterable[Mapping[str, object]] | None = None,
) -> list[AchievementSetData]:
    """
    Computes per-set progress (`total_achievements`, `unlocked_count`, `completion_percentage`)
    for Steam's Achievement Sets (`schema_v2` `groups`).
    """
    ach_list = list(achievements)
    sets_by_id: dict[int, AchievementSetData] = {}
    ordered_ids: list[int] = []

    if raw_sets is not None:
        for rs in raw_sets:
            raw_id = rs.get("id", 0)
            sid = int(raw_id) if isinstance(raw_id, (int, float, str)) else 0
            raw_name = str(rs.get("name") or "").strip()
            sname = raw_name if raw_name else "Base Game"
            entry: AchievementSetData = {
                "id": sid,
                "name": sname,
                "total_achievements": 0,
                "unlocked_count": 0,
                "completion_percentage": 0.0,
            }
            raw_dlc = rs.get("dlc_appid")
            if isinstance(raw_dlc, int) and raw_dlc > 0:
                entry["dlc_appid"] = raw_dlc
            if bool(rs.get("archived", False)):
                entry["archived"] = True
            raw_hdr = rs.get("header_image")
            if isinstance(raw_hdr, str) and raw_hdr:
                entry["header_image"] = raw_hdr
            sets_by_id[sid] = entry
            ordered_ids.append(sid)

    for ach in ach_list:
        raw_sid = ach.get("set_id", 0)
        sid = int(raw_sid) if isinstance(raw_sid, int) else 0
        if sid not in sets_by_id:
            raw_sname = str(ach.get("set_name") or "").strip()
            entry = {
                "id": sid,
                "name": raw_sname if raw_sname else "Base Game",
                "total_achievements": 0,
                "unlocked_count": 0,
                "completion_percentage": 0.0,
            }
            raw_dlc = ach.get("dlc_appid")
            if isinstance(raw_dlc, int) and raw_dlc > 0:
                entry["dlc_appid"] = raw_dlc
            if bool(ach.get("archived", False)):
                entry["archived"] = True
            sets_by_id[sid] = entry
            ordered_ids.append(sid)

        s_entry = sets_by_id[sid]
        s_entry["total_achievements"] += 1
        if bool(ach.get("unlocked", False)):
            s_entry["unlocked_count"] += 1

    result: list[AchievementSetData] = []
    for sid in ordered_ids:
        s_entry = sets_by_id[sid]
        tot = s_entry["total_achievements"]
        unl = s_entry["unlocked_count"]
        if tot == 0:
            continue
        s_entry["completion_percentage"] = round((unl / tot) * 100.0, 1)
        result.append(s_entry)

    return result


def rank_achievements(
    achievements: Iterable[Mapping[str, object]],
    pinned_ids: Iterable[str] | None = None,
) -> RankedAchievementsData:
    """
    Ranks achievements into actionable categories defined in Spec 03:
    - pinned: User explicit focus (locked achievements in pinned_ids)
    - up_next: Top 5 most achievable locked non-archived recommendations
    - almost_there: Multi-step locked non-archived achievements with >= 50% progress
    - easy_grabs: Locked non-archived achievements unlocked by >= 25% of players
    - missable: Hidden / secret or rare (<= 10%) or explicitly tagged Missable locked achievements
    - locked: All locked achievements sorted by rec_score descending
    - unlocked: All unlocked achievements
    """
    pinned_set = set(pinned_ids) if pinned_ids is not None else set()

    ranked: RankedAchievementsData = {
        "pinned": [],
        "up_next": [],
        "almost_there": [],
        "easy_grabs": [],
        "missable": [],
        "locked": [],
        "unlocked": [],
    }

    for raw_ach in achievements:
        ach_id = str(raw_ach.get("id", ""))
        is_pinned = ach_id in pinned_set

        if bool(raw_ach.get("unlocked")):
            unlocked_ach = _clone_achievement(raw_ach, is_pinned=is_pinned, rec_score=0.0)
            ranked["unlocked"].append(unlocked_ach)
            continue

        score = compute_recommendation_score(raw_ach)
        ach = _clone_achievement(raw_ach, is_pinned=is_pinned, rec_score=score)
        ratio = get_progress_ratio(ach)
        global_pct = ach["global_percentage"]
        is_archived = bool(ach.get("archived", False))

        if is_pinned:
            ranked["pinned"].append(ach)

        if not is_archived and ratio >= 0.5:
            ranked["almost_there"].append(ach)

        if not is_archived and global_pct >= 25.0 and (not ach["hidden"] or ratio > 0):
            ranked["easy_grabs"].append(ach)

        if ach["hidden"] or ach.get("category") == "Missable" or global_pct <= 10.0:
            ranked["missable"].append(ach)

        ranked["locked"].append(ach)

    def locked_sort_key(a: AchievementData) -> tuple[float, float, str]:
        return (
            -float(a.get("rec_score", 0.0)),
            -float(a["global_percentage"]),
            a["name"],
        )

    ranked["locked"].sort(key=locked_sort_key)
    ranked["pinned"].sort(key=locked_sort_key)
    ranked["almost_there"].sort(
        key=lambda a: (-get_progress_ratio(a), -float(a.get("rec_score", 0.0)))
    )
    ranked["easy_grabs"].sort(key=lambda a: (-float(a["global_percentage"]), a["name"]))
    ranked["missable"].sort(key=locked_sort_key)
    ranked["unlocked"].sort(
        key=lambda a: (
            -(int(a["unlock_time"] or 0)),
            float(a["global_percentage"]),
        )
    )

    # For Up Next, exclude archived achievements and prefer visible achievements
    # or achievements with active progress.
    non_archived_locked = [a for a in ranked["locked"] if not a.get("archived", False)]
    actionable_locked = [
        a for a in non_archived_locked if not a["hidden"] or get_progress_ratio(a) > 0
    ]
    source_for_up_next = actionable_locked if actionable_locked else non_archived_locked
    ranked["up_next"] = source_for_up_next[:5]

    return ranked
