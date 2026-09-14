"""
Recommendation engine for Next Unlock achievements.
Ranks locked achievements by effort, completion proximity, global rarity, and tags.
"""

def rank_achievements(achievements, pinned_ids=None):
    """
    Ranks achievements into actionable categories:
    - Pinned: User explicit focus
    - Up Next: Top priority recommendation (highest score)
    - Almost There: Progress >= 75%
    - Easy Grabs: Global % >= 30% or estimated minutes <= 15
    - Missable: Hidden or tagged missable
    """
    if pinned_ids is None:
        pinned_ids = []

    ranked = {
        "pinned": [],
        "up_next": [],
        "almost_there": [],
        "easy_grabs": [],
        "missable": [],
        "locked": [],
        "unlocked": []
    }

    for ach in achievements:
        if ach.get("unlocked"):
            ranked["unlocked"].append(ach)
            continue

        ach_id = ach.get("id")
        is_pinned = ach_id in pinned_ids
        ach["is_pinned"] = is_pinned

        if is_pinned:
            ranked["pinned"].append(ach)

        # Calculate recommendation score
        progress = ach.get("progress", {})
        cur = progress.get("current", 0)
        max_val = progress.get("max", 1)
        ratio = (cur / max_val) if max_val > 0 else 0
        global_pct = ach.get("global_percentage", 10.0)
        est_min = ach.get("estimated_minutes", 30)

        # Score formula: high ratio + reasonable global % + low time = higher score
        score = (ratio * 50) + (global_pct * 0.3) + max(0, (60 - est_min) * 0.5)
        ach["rec_score"] = round(score, 1)

        # Categorize
        if ratio >= 0.75:
            ranked["almost_there"].append(ach)

        if global_pct >= 30.0 or est_min <= 15:
            ranked["easy_grabs"].append(ach)

        if ach.get("hidden") or ach.get("category") == "Missable":
            ranked["missable"].append(ach)

        ranked["locked"].append(ach)

    # Sort locked by rec_score descending for "Up Next"
    sorted_locked = sorted(ranked["locked"], key=lambda x: x.get("rec_score", 0), reverse=True)
    ranked["up_next"] = sorted_locked[:3]  # Top 3 most promising

    return ranked
