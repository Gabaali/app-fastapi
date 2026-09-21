from __future__ import annotations

# IMPORTANT
# ---------
# Pokémon does not publish official rarity odds for normal expansions.
# The values below are observed pull rates from large public samples
# (mostly TCGplayer Authentication Center openings).
#
# Riftbound publishes the pack structure and some rarity frequencies.
# Where Riot has not published a premium-treatment rate, the profile is
# explicitly marked as an estimate.
#
# One Piece is intentionally NOT hardcoded here: the project database
# already contains a `pull_rates` table per set. The simulator reads that
# table directly, so OP01, OP02, ... can each use their own profile.


# ============================================================
# POKÉMON — observed per-pack probabilities
# ============================================================
#
# rare_slot:
#   Replaces the normal Rare/Holo slot.
#
# reverse1 / reverse2:
#   Replaces one of the two reverse slots in modern Scarlet & Violet /
#   Mega Evolution packs.
#
# Rates are decimals, so 0.10 = 10%.
#
# These profiles are meant for the physical EN-style booster model used
# by this simulator. Promo sets, Pokémon TCG Pocket sets, Trainer Kits,
# energy-only sets, etc. must NOT use these profiles.

POKEMON_PROFILES: dict[str, dict] = {
    "sv01": {
        "rare_slot": {"double_rare": 0.1376, "ultra_rare": 0.0657},
        "reverse1": {},
        "reverse2": {
            "illustration_rare": 0.0767,
            "special_illustration_rare": 0.0315,
            "hyper_rare": 0.0185,
        },
        "source": "TCGplayer — Scarlet & Violet, 8,000+ boosters",
    },
    "sv02": {
        "rare_slot": {"double_rare": 0.1372, "ultra_rare": 0.0664},
        "reverse1": {},
        "reverse2": {
            "illustration_rare": 0.0770,
            "special_illustration_rare": 0.0317,
            "hyper_rare": 0.0176,
        },
        "source": "TCGplayer — Paldea Evolved, 8,000+ boosters",
    },
    "sv03": {
        "rare_slot": {"double_rare": 0.1361, "ultra_rare": 0.0663},
        "reverse1": {},
        "reverse2": {
            "illustration_rare": 0.0760,
            "special_illustration_rare": 0.0313,
            "hyper_rare": 0.0192,
        },
        "source": "TCGplayer — Obsidian Flames",
    },
    "sv03.5": {
        "rare_slot": {"double_rare": 0.1250, "ultra_rare": 0.0625},
        "reverse1": {},
        "reverse2": {
            "illustration_rare": 0.0833,
            "special_illustration_rare": 0.03125,
            "hyper_rare": 0.0196,
        },
        "source": "Community aggregate — Pokémon 151",
    },
    "sv04": {
        "rare_slot": {"double_rare": 0.1557, "ultra_rare": 0.0664},
        "reverse1": {},
        "reverse2": {
            "illustration_rare": 0.0770,
            "special_illustration_rare": 0.0211,
            "hyper_rare": 0.0122,
        },
        "source": "TCGplayer — Paradox Rift",
    },
    "sv04.5": {
        "rare_slot": {"double_rare": 0.1589, "ultra_rare": 0.0661},
        "reverse1": {
            "shiny_rare": 0.2544,
            "shiny_ultra_rare": 0.0772,
        },
        "reverse2": {
            "illustration_rare": 0.0722,
            "special_illustration_rare": 0.0172,
            "hyper_rare": 0.0161,
        },
        "source": "TCGplayer — Paldean Fates",
    },
    "sv05": {
        "rare_slot": {"double_rare": 0.1683, "ultra_rare": 0.0667},
        "reverse1": {"ace_spec": 0.0500},
        "reverse2": {
            "illustration_rare": 0.0772,
            "special_illustration_rare": 0.0117,
            "hyper_rare": 0.0072,
        },
        "source": "TCGplayer — Temporal Forces",
    },
    "sv06": {
        "rare_slot": {"double_rare": 0.1693, "ultra_rare": 0.0661},
        "reverse1": {"ace_spec": 0.0506},
        "reverse2": {
            "illustration_rare": 0.0773,
            "special_illustration_rare": 0.0117,
            "hyper_rare": 0.0068,
        },
        "source": "TCGplayer — Twilight Masquerade",
    },
    "sv06.5": {
        "rare_slot": {"double_rare": 0.1670, "ultra_rare": 0.0670},
        "reverse1": {"ace_spec": 0.0500},
        "reverse2": {
            "illustration_rare": 0.0770,
            "special_illustration_rare": 0.0150,
            "hyper_rare": 0.0070,
        },
        "source": "Community aggregate — Shrouded Fable",
    },
    "sv07": {
        "rare_slot": {"double_rare": 0.1690, "ultra_rare": 0.0675},
        "reverse1": {"ace_spec": 0.0494},
        "reverse2": {
            "illustration_rare": 0.0779,
            "special_illustration_rare": 0.0111,
            "hyper_rare": 0.0073,
        },
        "source": "TCGplayer — Stellar Crown",
    },
    "sv08": {
        "rare_slot": {"double_rare": 0.1694, "ultra_rare": 0.0674},
        "reverse1": {"ace_spec": 0.0503},
        "reverse2": {
            "illustration_rare": 0.0767,
            "special_illustration_rare": 0.0115,
            "hyper_rare": 0.0053,
        },
        "source": "TCGplayer — Surging Sparks",
    },
    "sv08.5": {
        "rare_slot": {"double_rare": 0.1694, "ultra_rare": 0.0746},
        "reverse1": {
            "ace_spec": 0.0468,
            "master_ball_foil": 0.0492,
            "poke_ball_foil": 0.3310,
        },
        "reverse2": {
            "special_illustration_rare": 0.0222,
            "hyper_rare": 0.0056,
        },
        "source": "TCGplayer — Prismatic Evolutions, 1,200+ boosters",
    },
    "sv09": {
        "rare_slot": {"double_rare": 0.2029, "ultra_rare": 0.0654},
        "reverse1": {},
        "reverse2": {
            "illustration_rare": 0.0850,
            "special_illustration_rare": 0.0116,
            "hyper_rare": 0.0073,
        },
        "source": "TCGplayer — Journey Together, 8,000+ boosters",
    },
    "sv10": {
        "rare_slot": {"double_rare": 0.1983, "ultra_rare": 0.0639},
        "reverse1": {},
        "reverse2": {
            "illustration_rare": 0.0829,
            "special_illustration_rare": 0.0106,
            "hyper_rare": 0.0067,
        },
        "source": "TCGplayer — Destined Rivals",
    },
    "sv10.5b": {
        "rare_slot": {"double_rare": 0.20, "ultra_rare": 0.0583},
        "reverse1": {"master_ball_foil": 0.0514},
        "reverse2": {"illustration_rare": 0.1639},
        "source": "TCGplayer — Black Bolt; unmeasured classes fall back to normal slot",
    },
    "sv10.5w": {
        "rare_slot": {"double_rare": 0.20, "ultra_rare": 0.0583},
        "reverse1": {"master_ball_foil": 0.0514},
        "reverse2": {"illustration_rare": 0.1639},
        "source": "TCGplayer — White Flare; unmeasured classes fall back to normal slot",
    },
    "me01": {
        "rare_slot": {"double_rare": 0.2091, "ultra_rare": 0.0823},
        "reverse1": {},
        "reverse2": {
            "illustration_rare": 0.1089,
            "special_illustration_rare": 0.0099,
            "mega_hyper_rare": 0.0008,
        },
        "source": "TCGplayer — Mega Evolution",
    },
    "me02": {
        "rare_slot": {"double_rare": 0.2077, "ultra_rare": 0.0806},
        "reverse1": {},
        "reverse2": {
            "illustration_rare": 0.1097,
            "special_illustration_rare": 0.0125,
            "mega_hyper_rare": 0.0008,
        },
        "source": "TCGplayer — Phantasmal Flames, 5,000+ boosters",
    },
    "me02.5": {
        "rare_slot": {
            "double_rare": 0.2037,
            "ultra_rare": 0.0481,
            "mega_attack_rare": 1 / 29,
        },
        "reverse1": {},
        "reverse2": {
            "illustration_rare": 0.1125,
            "special_illustration_rare": 0.0144,
            "mega_hyper_rare": 0.0019,
        },
        "source": "TCGplayer / PokéBeach — Ascended Heroes, ~2,000+ boosters",
    },
    "me03": {
        "rare_slot": {"double_rare": 0.2097, "ultra_rare": 0.0854},
        "reverse1": {},
        "reverse2": {
            "illustration_rare": 0.1120,
            "special_illustration_rare": 0.0123,
            "mega_hyper_rare": 0.0006,
        },
        "source": "TCGplayer — Perfect Order",
    },
    "me04": {
        "rare_slot": {"double_rare": 0.2030, "ultra_rare": 0.0829},
        "reverse1": {},
        "reverse2": {
            "illustration_rare": 0.1066,
            "special_illustration_rare": 0.0121,
            "mega_hyper_rare": 0.0010,
        },
        "source": "TCGplayer — Chaos Rising, 8,500+ boosters",
    },
    "me05": {
        "rare_slot": {"double_rare": 0.2102, "ultra_rare": 0.0830},
        "reverse1": {},
        "reverse2": {
            "illustration_rare": 0.1101,
            "special_illustration_rare": 0.0125,
            "mega_hyper_rare": 0.0009,
        },
        "source": "Community/market opening aggregate — Pitch Black",
    },

    # Special 30th Celebration packs use a completely different structure.
    # The simulator handles this profile separately:
    # 5 foil cards + 1 foil Basic Energy, with 1 Pikachu Rare guaranteed.
    "30th": {
        "special_pack": "30th",
        "secondary_hit": {
            "double_rare": 0.219,
            "illustration_rare": 0.184,
            "classic_collection": 0.098,
            "special_illustration_rare": 0.055,
            "futuristic_rare": 0.012,
            # Remaining probability = no extra hit.
        },
        "source": "652 verified packs (TCGTalk); early-release empirical data",
    },
}


POKEMON_SUPPORTED_SET_IDS = set(POKEMON_PROFILES)


# ============================================================
# RIFTBOUND
# ============================================================
#
# Official baseline:
#   7 Common
#   3 Uncommon
#   2 Rare-or-better
#   1 foil C/U/R/E
#   1 Token/Rune
#
# Origins official:
#   Epic ~1 pack in 4
#   Alt Art ~2 per 24-pack display
#   Overnumber ~1 per 3 displays
#   ~1 in 10 Overnumbers is a Signature
#
# Unleashed official:
#   Same 14-card structure; Ultimate can occupy a Rare+ slot
#   and appears in < 0.1% of packs.
#
# Riot has not published complete premium-treatment odds for every later set.
# Those fields are explicitly tagged "estimate" below instead of pretending
# they are official.

RIFTBOUND_PROFILES: dict[str, dict] = {
    "OGN": {
        "epic_pack": 0.25,
        "alt_pack": 2 / 24,
        "overnumber_pack": 1 / (3 * 24),
        "signature_pack": (1 / (3 * 24)) * 0.10,
        "ultimate_pack": 0.0,
        "source": "Riot official — Origins collectability article",
        "confidence": "official",
    },
    "SFD": {
        "epic_pack": 0.25,
        "alt_pack": 2.5 / 24,
        "overnumber_pack": 1 / 60,
        "signature_pack": 1 / 720,
        "ultimate_pack": 0.0,
        "source": "Riot official pack structure + community box-opening estimate",
        "confidence": "estimated-premium",
    },
    "UNL": {
        "epic_pack": 0.27,
        "alt_pack": 3 / 24,
        "overnumber_pack": 1 / 72,
        "signature_pack": 1 / 720,
        "ultimate_pack": 0.0009,  # stays below Riot's official <0.1% ceiling
        "source": "Riot official structure + Ultimate <0.1%; other premium odds observed",
        "confidence": "mixed",
    },
    "VEN": {
        "epic_pack": 0.27,
        "alt_pack": 0.10,
        "special_alt_pack": 0.035,
        "overnumber_pack": 1 / 72,
        "signature_pack": 1 / 720,
        "ultimate_pack": 0.0,
        "source": "Riot official structure + community opening estimate",
        "confidence": "estimated-premium",
    },
}


RIFTBOUND_SUPPORTED_SET_IDS = set(RIFTBOUND_PROFILES)

# Riot only says the foil slot is "most of the time" Common/Uncommon,
# and can upgrade to Rare/Epic. They do not publish exact C/U/R/E splits.
RIFTBOUND_FOIL_WEIGHTS = {
    "common": 0.55,
    "uncommon": 0.35,
    "rare": 0.08,
    "epic": 0.02,
}
