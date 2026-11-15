"""
Strict typed domain schemas for Next Unlock backend (Spec 01–03).
Uses Python standard library TypedDict (compatible with Python 3.9+ and SteamOS)
enforced at compile/lint time by Astral's `ty` and `ruff` (`ANN401` no-Any).
"""

from __future__ import annotations

from typing import TypedDict


class AchievementProgress(TypedDict):
    current: int | float
    max: int | float


class _AchievementOptional(TypedDict, total=False):
    category: str
    is_pinned: bool
    rec_score: float
    progress: AchievementProgress
    set_id: int
    set_name: str
    dlc_appid: int
    archived: bool


class AchievementData(_AchievementOptional):
    id: str
    name: str
    description: str
    icon: str
    unlocked: bool
    unlock_time: int | None
    global_percentage: float
    rarity_tier: str
    hidden: bool


class _AchievementSetOptional(TypedDict, total=False):
    dlc_appid: int
    archived: bool
    header_image: str


class AchievementSetData(_AchievementSetOptional):
    id: int
    name: str
    total_achievements: int
    unlocked_count: int
    completion_percentage: float


class RankedAchievementsData(TypedDict):
    pinned: list[AchievementData]
    up_next: list[AchievementData]
    almost_there: list[AchievementData]
    easy_grabs: list[AchievementData]
    missable: list[AchievementData]
    locked: list[AchievementData]
    unlocked: list[AchievementData]


class _GameOptional(TypedDict, total=False):
    last_played: int
    achievement_sets: list[AchievementSetData]


class GameData(_GameOptional):
    appid: int
    name: str
    header_image: str
    total_achievements: int
    unlocked_count: int
    completion_percentage: float
    achievements: list[AchievementData]


class GameDetailsResponse(TypedDict):
    game: GameData
    ranked: RankedAchievementsData


class _EnvelopeOptional(TypedDict, total=False):
    achievement_sets: list[AchievementSetData]


class FetchedAchievementsEnvelope(_EnvelopeOptional):
    appid: int
    game_title: str | None
    header_image: str | None
    achievements: list[AchievementData]


class _ParsedHtmlOptional(TypedDict, total=False):
    achievement_sets: list[AchievementSetData]


class ParsedCommunityHtmlResult(_ParsedHtmlOptional):
    game_title: str | None
    header_image: str | None
    achievements: list[AchievementData]


class LocalUserStatsEnvelope(TypedDict):
    appid: int
    cached: bool
    total: int
    unlocked_count: int
    achievements: list[AchievementData]
    unlocked_by_id: dict[str, AchievementData]
    unlocked_by_name: dict[str, AchievementData]
    progress_by_name: dict[str, AchievementProgress]


class ActiveAppData(TypedDict):
    appid: int
    name: str


class TogglePinResponse(TypedDict):
    achievement_id: str
    pinned: bool


class SyncUnlockedResponse(TypedDict):
    appid: int
    synced_count: int
