"""
Rich mock dataset for Next Unlock development and testing.
Includes realistic games, achievement lists, rarity percentages, categories, and progress.
"""

MOCK_GAMES = [
    {
        "appid": 1245620,
        "name": "Elden Ring",
        "header_image": "https://cdn.cloudflare.steamstatic.com/steam/apps/1245620/header.jpg",
        "total_achievements": 42,
        "unlocked_count": 34,
        "completion_percentage": 80.9,
        "achievements": [
            {
                "id": "ACH_ELDEN_LORD",
                "name": "Elden Lord",
                "description": "Achieved the 'Elden Lord' ending.",
                "icon": "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/1245620/b382d61dd2674e1d3bc01b4aef9b20ab1e71e723.jpg",
                "unlocked": True,
                "unlock_time": 1704067200,
                "global_percentage": 24.5,
                "rarity_tier": "common",
                "category": "Story",
                "hidden": False,
                "progress": {"current": 1, "max": 1}
            },
            {
                "id": "ACH_MALENIA",
                "name": "Shardbearer Malenia",
                "description": "Defeated Shardbearer Malenia.",
                "icon": "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/1245620/c213454efb5ef6017daaa0ef82c2a05d8fcd6749.jpg",
                "unlocked": False,
                "unlock_time": None,
                "global_percentage": 4.1,
                "rarity_tier": "ultra_rare",
                "category": "Up Next",
                "hidden": False,
                "progress": {"current": 85, "max": 100},
                "estimated_minutes": 45,
                "hint": "Target Haligtree area, prepare bleed or frost weapons."
            },
            {
                "id": "ACH_LEGENDARY_ARMAMENTS",
                "name": "Legendary Armaments",
                "description": "Acquired all legendary armaments.",
                "icon": "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/1245620/a9b5f543881dfd7b1029ab095bc37f00d350aa1b.jpg",
                "unlocked": False,
                "unlock_time": None,
                "global_percentage": 9.2,
                "rarity_tier": "rare",
                "category": "Almost There",
                "hidden": False,
                "progress": {"current": 8, "max": 9},
                "estimated_minutes": 20,
                "hint": "Only Bolt of Gransax is missing in Leyndell."
            },
            {
                "id": "ACH_GODDEVOURING_SERPENT",
                "name": "Rykard, Lord of Blasphemy",
                "description": "Defeated Rykard, Lord of Blasphemy.",
                "icon": "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/1245620/5d4817a5ef0921ec5662243d4f40ffbfaef449f8.jpg",
                "unlocked": False,
                "unlock_time": None,
                "global_percentage": 35.8,
                "rarity_tier": "common",
                "category": "Easy Grabs",
                "hidden": False,
                "progress": {"current": 0, "max": 1},
                "estimated_minutes": 15,
                "hint": "Use Serpent-Hunter spear in Volcano Manor arena."
            },
            {
                "id": "ACH_AGE_OF_STARS",
                "name": "Age of the Stars",
                "description": "Achieved the 'Age of the Stars' ending.",
                "icon": "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/1245620/190886a113dbb3046bc0fdf78e2448408f6cf9ee.jpg",
                "unlocked": False,
                "unlock_time": None,
                "global_percentage": 28.2,
                "rarity_tier": "rare",
                "category": "Missable",
                "hidden": True,
                "progress": {"current": 4, "max": 5},
                "estimated_minutes": 30,
                "hint": "Complete Ranni's questline before finishing the final boss."
            }
        ]
    },
    {
        "appid": 1091500,
        "name": "Cyberpunk 2077",
        "header_image": "https://cdn.cloudflare.steamstatic.com/steam/apps/1091500/header.jpg",
        "total_achievements": 44,
        "unlocked_count": 39,
        "completion_percentage": 88.6,
        "achievements": [
            {
                "id": "ACH_NIGHT_CITY_LEGEND",
                "name": "Night City Legend",
                "description": "Complete all Cyberpunk 2077 achievements.",
                "icon": "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/1091500/524317f2bc29285098939c3e9cb19cfba98031d8.jpg",
                "unlocked": False,
                "unlock_time": None,
                "global_percentage": 3.8,
                "rarity_tier": "ultra_rare",
                "category": "Up Next",
                "hidden": False,
                "progress": {"current": 39, "max": 44},
                "estimated_minutes": 90,
                "hint": "Finish remaining 5 gig trophies."
            },
            {
                "id": "ACH_AUTOPILOT",
                "name": "Autorestart",
                "description": "Perform a Quickhack on 3 enemies at once.",
                "icon": "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/1091500/039dfeb5ca1029c782782ec9908cf8b5bc0ad167.jpg",
                "unlocked": False,
                "unlock_time": None,
                "global_percentage": 42.1,
                "rarity_tier": "common",
                "category": "Easy Grabs",
                "hidden": False,
                "progress": {"current": 2, "max": 3},
                "estimated_minutes": 5,
                "hint": "Use Contagion hack in a crowded gang area."
            }
        ]
    },
    {
        "appid": 1145350,
        "name": "Hades II",
        "header_image": "https://cdn.cloudflare.steamstatic.com/steam/apps/1145350/header.jpg",
        "total_achievements": 38,
        "unlocked_count": 31,
        "completion_percentage": 81.5,
        "achievements": [
            {
                "id": "ACH_CHRONOS_DOWN",
                "name": "Time Is Up",
                "description": "Vanquish Chronos in the Underworld.",
                "icon": "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/1145350/a9b5f543881dfd7b1029ab095bc37f00d350aa1b.jpg",
                "unlocked": True,
                "unlock_time": 1715000000,
                "global_percentage": 32.1,
                "rarity_tier": "common",
                "category": "Story",
                "hidden": False,
                "progress": {"current": 1, "max": 1}
            },
            {
                "id": "ACH_ALL_ASPECTS",
                "name": "Master of Arms",
                "description": "Unlock all Nocturnal Arms aspects.",
                "icon": "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/1145350/5d4817a5ef0921ec5662243d4f40ffbfaef449f8.jpg",
                "unlocked": False,
                "unlock_time": None,
                "global_percentage": 6.8,
                "rarity_tier": "rare",
                "category": "Up Next",
                "hidden": False,
                "progress": {"current": 11, "max": 12},
                "estimated_minutes": 25,
                "hint": "Collect 2 more Nightmare resources."
            }
        ]
    },
    {
        "appid": 367520,
        "name": "Hollow Knight",
        "header_image": "https://cdn.cloudflare.steamstatic.com/steam/apps/367520/header.jpg",
        "total_achievements": 63,
        "unlocked_count": 55,
        "completion_percentage": 87.3,
        "achievements": [
            {
                "id": "ACH_PANTHEO_5",
                "name": "Embrace the Void",
                "description": "Conquer the Pantheon of Hallownest.",
                "icon": "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/367520/524317f2bc29285098939c3e9cb19cfba98031d8.jpg",
                "unlocked": False,
                "unlock_time": None,
                "global_percentage": 2.9,
                "rarity_tier": "ultra_rare",
                "category": "Up Next",
                "hidden": False,
                "progress": {"current": 4, "max": 5},
                "estimated_minutes": 60,
                "hint": "Practice Absolute Radiance in Godhome."
            }
        ]
    }
]


def get_mock_games():
    return MOCK_GAMES


def get_mock_game_by_id(appid):
    for game in MOCK_GAMES:
        if game["appid"] == int(appid):
            return game
    return MOCK_GAMES[0]
