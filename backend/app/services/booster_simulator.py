from __future__ import annotations

import math
import random
import re
import secrets
import unicodedata
from collections import defaultdict
from typing import Iterable

from ..models import CardOut, Game
from .card_catalog import connect_catalog, load_cards
from .drop_profiles import (
    POKEMON_PROFILES,
    POKEMON_SUPPORTED_SET_IDS,
    RIFTBOUND_FOIL_WEIGHTS,
    RIFTBOUND_PROFILES,
    RIFTBOUND_SUPPORTED_SET_IDS,
)


def _clean(value: object) -> str:
    text = unicodedata.normalize("NFKD", str(value or ""))
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    return re.sub(r"\s+", " ", text.lower().replace("-", " ")).strip()


def _draw(
    pool: list[CardOut],
    used: set[str] | None = None,
    *,
    allow_repeat: bool = False,
) -> CardOut | None:
    if not pool:
        return None

    if used is None or allow_repeat:
        card = random.choice(pool)
    else:
        available = [card for card in pool if card.card_key not in used]
        card = random.choice(available or pool)
        used.add(card.card_key)

    return card.model_copy(deep=True)


def _weighted_key(weights: dict[str, float]) -> str | None:
    usable = [(key, max(0.0, float(value))) for key, value in weights.items()]
    usable = [(key, value) for key, value in usable if value > 0]

    if not usable:
        return None

    total = sum(value for _, value in usable)
    roll = random.random()

    # Each configured probability is absolute per pack/slot, not normalized.
    cumulative = 0.0
    for key, probability in usable:
        cumulative += probability
        if roll < cumulative:
            return key

    # The leftover probability means "normal slot".
    return None


def _with_slot(
    card: CardOut | None,
    slot: str,
    *,
    variant: str | None = None,
) -> CardOut | None:
    if card is None:
        return None

    updates: dict[str, object] = {"slot": slot}
    if variant is not None:
        updates["variant"] = variant

    return card.model_copy(update=updates)


# ============================================================
# ONE PIECE
# ============================================================

OP_PACKS_PER_BOX = 24
OP_COMMON_SLOTS = 6
OP_MIDDLE_SLOTS = 3
OP_CARDS_PER_PACK = 12


def _onepiece_pull_rates(set_code: str) -> dict[str, float]:
    with connect_catalog("onepiece") as conn:
        rows = conn.execute(
            """
            SELECT drop_class, expected_per_box
            FROM pull_rates
            WHERE set_code = ?
              AND expected_per_box IS NOT NULL
            """,
            (set_code,),
        ).fetchall()

    return {
        str(row["drop_class"]): float(row["expected_per_box"] or 0.0)
        for row in rows
    }


def _op_group(cards: Iterable[CardOut]) -> dict[str, list[CardOut]]:
    grouped: dict[str, list[CardOut]] = defaultdict(list)
    for card in cards:
        grouped[str(card.drop_class or "")].append(card)
    return grouped


def _draw_op_weighted(
    pool: list[CardOut],
    used: set[str],
) -> CardOut | None:
    # The DB also contains per-card probability estimates, but CardOut does not
    # expose them. Uniform within a drop class is the least-assumptive choice.
    return _draw(pool, used)


def _simulate_onepiece(set_code: str) -> list[CardOut]:
    cards = load_cards("onepiece", set_code)
    rates = _onepiece_pull_rates(set_code)

    if not cards:
        raise ValueError(f"Aucune carte pour onepiece/{set_code}.")
    if not rates:
        raise ValueError(
            f"Aucun pull-rate One Piece trouvé pour {set_code} dans pull_rates."
        )

    pools = _op_group(cards)
    used: set[str] = set()
    pack: list[CardOut] = []

    common_pool = pools.get("Common", [])
    uncommon_pool = pools.get("Uncommon", [])
    leader_pool = pools.get("Leader", [])
    don_pool = pools.get("DON!!", [])

    for _ in range(OP_COMMON_SLOTS):
        card = _with_slot(_draw_op_weighted(common_pool, used), "Common")
        if card:
            pack.append(card)

    leader_rate = rates.get("Leader", 0.0)
    has_leader = (
        bool(leader_pool)
        and random.random() < min(1.0, leader_rate / OP_PACKS_PER_BOX)
    )

    middle: list[CardOut] = []
    if has_leader:
        card = _with_slot(_draw_op_weighted(leader_pool, used), "Leader")
        if card:
            middle.append(card)

    while len(middle) < OP_MIDDLE_SLOTS:
        card = _draw_op_weighted(uncommon_pool, used)
        if card is None:
            card = _draw_op_weighted(common_pool, used)
        card = _with_slot(card, "Uncommon")
        if card is None:
            break
        middle.append(card)

    pack.extend(middle)

    don = _draw_op_weighted(don_pool, used)
    if don is None:
        don = _draw_op_weighted(common_pool, used)
    don = _with_slot(don, "DON!!")
    if don:
        pack.append(don)

    excluded = {
        "Common",
        "Uncommon",
        "Leader",
        "DON!!",
        "Promo",
        "Promo ALT",
        "Promo SP",
        "Promo MANGA",
    }

    high_rates: list[list[object]] = []
    for drop_class, expected in rates.items():
        if drop_class in excluded:
            continue
        if not pools.get(drop_class):
            continue
        high_rates.append([drop_class, float(expected)])

    total_expected = sum(float(row[1]) for row in high_rates)

    rare_index = next(
        (
            i
            for i, row in enumerate(high_rates)
            if str(row[0]).lower() == "rare"
        ),
        None,
    )

    # A real pack always needs at least one high slot.
    if total_expected < OP_PACKS_PER_BOX:
        missing = OP_PACKS_PER_BOX - total_expected
        if rare_index is not None:
            high_rates[rare_index][1] = float(high_rates[rare_index][1]) + missing
        elif pools.get("Rare"):
            high_rates.append(["Rare", missing])
        total_expected = OP_PACKS_PER_BOX

    # Two high slots maximum in this physical pack model.
    maximum_high = OP_PACKS_PER_BOX * 2
    if total_expected > maximum_high:
        scale = maximum_high / total_expected
        for row in high_rates:
            row[1] = float(row[1]) * scale
        total_expected = maximum_high

    second_hit_probability = max(
        0.0,
        min(1.0, (total_expected - OP_PACKS_PER_BOX) / OP_PACKS_PER_BOX),
    )

    classes = [str(row[0]) for row in high_rates]
    weights = [float(row[1]) for row in high_rates]

    def draw_high() -> CardOut | None:
        if not classes:
            return _with_slot(
                _draw_op_weighted(pools.get("Rare", []), used),
                "Rare",
            )

        chosen = random.choices(classes, weights=weights, k=1)[0]
        return _with_slot(
            _draw_op_weighted(pools.get(chosen, []), used),
            chosen,
        )

    first = draw_high()
    if first:
        pack.append(first)

    if random.random() < second_hit_probability:
        second = draw_high()
    else:
        filler_name = "Common" if random.random() < 0.65 else "Uncommon"
        second = _draw_op_weighted(
            common_pool if filler_name == "Common" else uncommon_pool,
            used,
        )
        if second is None:
            second = _draw_op_weighted(common_pool, used)
        second = _with_slot(second, filler_name)

    if second:
        pack.append(second)

    while len(pack) < OP_CARDS_PER_PACK:
        card = _with_slot(_draw(common_pool, used), "Common")
        if card is None:
            break
        pack.append(card)

    return pack[:OP_CARDS_PER_PACK]


# ============================================================
# POKÉMON
# ============================================================

def _pokemon_rarity_key(value: object) -> str:
    text = _clean(value)

    checks: list[tuple[tuple[str, ...], str]] = [
        (("mega hyper rare", "mega hyper"), "mega_hyper_rare"),
        (
            (
                "special illustration rare",
                "illustration speciale rare",
                "rare illustration speciale",
            ),
            "special_illustration_rare",
        ),
        (
            ("shiny ultra rare", "ultra rare chromatique", "chromatique ultra rare"),
            "shiny_ultra_rare",
        ),
        (("shiny rare", "rare chromatique"), "shiny_rare"),
        (("rare noir blanc", "black white rare"), "black_white_rare"),
        (("mega attack rare",), "mega_attack_rare"),
        (("futuristic rare",), "futuristic_rare"),
        (("pikachu rare",), "pikachu_rare"),
        (("illustration rare", "rare illustration"), "illustration_rare"),
        (("double rare",), "double_rare"),
        (("ultra rare",), "ultra_rare"),
        (("hyper rare",), "hyper_rare"),
        (("high tech rare", "ace spec"), "ace_spec"),
        (("peu commune", "uncommon"), "uncommon"),
        (("commune", "common"), "common"),
        (("rare",), "rare"),
        (("energie", "energy"), "energy"),
    ]

    for needles, result in checks:
        if any(needle in text for needle in needles):
            return result

    return re.sub(r"[^a-z0-9]+", "_", text).strip("_") or "unknown"


def _pokemon_pools(cards: list[CardOut]) -> dict[str, list[CardOut]]:
    pools: dict[str, list[CardOut]] = defaultdict(list)
    for card in cards:
        pools[_pokemon_rarity_key(card.rarity)].append(card)
    return pools


def _probability_slot(
    pools: dict[str, list[CardOut]],
    probabilities: dict[str, float],
    fallback: list[CardOut],
    used: set[str],
    slot_label: str,
) -> CardOut | None:
    rarity_key = _weighted_key(probabilities)

    if rarity_key and pools.get(rarity_key):
        card = _draw(pools[rarity_key], used)
        return _with_slot(
            card,
            rarity_key.replace("_", " ").title(),
        )

    return _with_slot(_draw(fallback, used), slot_label)


def _reverse_slot(
    pools: dict[str, list[CardOut]],
    probabilities: dict[str, float],
) -> CardOut | None:
    rarity_key = _weighted_key(probabilities)

    if rarity_key == "master_ball_foil":
        base_pool = pools.get("common", []) + pools.get("uncommon", []) + pools.get("rare", [])
        return _with_slot(
            _draw(base_pool, allow_repeat=True),
            "Master Ball Foil",
            variant="Master Ball Foil",
        )

    if rarity_key == "poke_ball_foil":
        base_pool = pools.get("common", []) + pools.get("uncommon", []) + pools.get("rare", [])
        return _with_slot(
            _draw(base_pool, allow_repeat=True),
            "Poké Ball Foil",
            variant="Poké Ball Foil",
        )

    if rarity_key and pools.get(rarity_key):
        return _with_slot(
            _draw(pools[rarity_key], allow_repeat=True),
            rarity_key.replace("_", " ").title(),
        )

    reverse_pool = pools.get("common", []) + pools.get("uncommon", []) + pools.get("rare", [])
    return _with_slot(
        _draw(reverse_pool, allow_repeat=True),
        "Reverse Holo",
        variant="Reverse Holo",
    )


def _virtual_energy(set_code: str) -> CardOut:
    # Not part of the set database, but physically present in modern packs.
    return CardOut(
        card_key=f"virtual-energy-{secrets.token_hex(8)}",
        game="pokemon",
        product_set=set_code,
        card_number="—",
        name="Énergie de base",
        rarity="Énergie",
        variant="",
        drop_class="Energy",
        image_url=None,
        collectible=False,
        slot="Énergie",
    )


def _simulate_pokemon_30th() -> list[CardOut]:
    cards = load_cards("pokemon", "30th")
    classic_cards = load_cards("pokemon", "30th-c")

    if not cards:
        raise ValueError("Aucune carte pour pokemon/30th.")

    pools = _pokemon_pools(cards)
    used: set[str] = set()
    pack: list[CardOut] = []

    pikachu_pool = pools.get("pikachu_rare", [])
    normal_pool = pools.get("common", []) + pools.get("rare", [])

    # 3 ordinary foil cards.
    for _ in range(3):
        card = _with_slot(_draw(normal_pool, used), "Foil")
        if card:
            pack.append(card)

    # Guaranteed Pikachu Rare in every pack.
    pikachu = _with_slot(_draw(pikachu_pool, used), "Pikachu Rare")
    if pikachu:
        pack.append(pikachu)

    # One secondary-hit position. The empirical categories below are mutually
    # exclusive in the source sample, and the leftover probability means
    # "no additional hit".
    probabilities = POKEMON_PROFILES["30th"]["secondary_hit"]
    hit_key = _weighted_key(probabilities)

    hit: CardOut | None = None
    if hit_key == "classic_collection" and classic_cards:
        hit = _with_slot(
            _draw(classic_cards, allow_repeat=True),
            "Classic Collection",
            variant="Classic Collection",
        )
    elif hit_key and pools.get(hit_key):
        hit = _with_slot(
            _draw(pools[hit_key], used),
            hit_key.replace("_", " ").title(),
        )

    if hit is None:
        hit = _with_slot(_draw(normal_pool, used), "Foil")

    if hit:
        pack.append(hit)

    pack.append(_virtual_energy("30th"))
    return pack


def _simulate_pokemon(set_code: str) -> list[CardOut]:
    if set_code == "30th":
        return _simulate_pokemon_30th()

    if set_code not in POKEMON_SUPPORTED_SET_IDS:
        raise ValueError(
            f"Le set Pokémon {set_code} n'a pas de profil de pull-rate physique "
            "validé dans le simulateur."
        )

    profile = POKEMON_PROFILES[set_code]
    cards = load_cards("pokemon", set_code)

    if not cards:
        raise ValueError(f"Aucune carte pour pokemon/{set_code}.")

    pools = _pokemon_pools(cards)
    common = pools.get("common", [])
    uncommon = pools.get("uncommon", [])
    rare = pools.get("rare", [])

    if not common or not uncommon or not rare:
        raise ValueError(
            f"Structure Pokémon moderne incompatible pour {set_code}."
        )

    used: set[str] = set()
    pack: list[CardOut] = []

    for _ in range(4):
        card = _with_slot(_draw(common, used), "Common")
        if card:
            pack.append(card)

    for _ in range(3):
        card = _with_slot(_draw(uncommon, used), "Uncommon")
        if card:
            pack.append(card)

    reverse1 = _reverse_slot(pools, profile.get("reverse1", {}))
    if reverse1:
        pack.append(reverse1)

    reverse2 = _reverse_slot(pools, profile.get("reverse2", {}))
    if reverse2:
        pack.append(reverse2)

    rare_slot = _probability_slot(
        pools,
        profile.get("rare_slot", {}),
        rare,
        used,
        "Rare / Holo",
    )
    if rare_slot:
        pack.append(rare_slot)

    pack.append(_virtual_energy(set_code))
    return pack


# ============================================================
# RIFTBOUND
# ============================================================

def _rift_rarity_key(value: object) -> str:
    text = _clean(value)

    if "uncommon" in text or "peu commune" in text or "peu commun" in text:
        return "uncommon"
    if text in {"common", "commune", "commun"}:
        return "common"
    if "ultimate" in text or "ultime" in text:
        return "ultimate"
    if "epic" in text or "epique" in text:
        return "epic"
    if "rare" in text:
        return "rare"
    if "token" in text or "rune" in text:
        return "token"

    return re.sub(r"[^a-z0-9]+", "_", text).strip("_") or "unknown"


def _rift_metadata(set_code: str) -> dict[str, dict]:
    with connect_catalog("riftbound") as conn:
        rows = conn.execute(
            """
            SELECT
                public_code,
                code,
                collector_number,
                rarity_key,
                rarity_raw,
                card_type,
                is_alt_art,
                is_signed,
                is_variant
            FROM cards
            WHERE set_code = ?
              AND active = 1
            """,
            (set_code,),
        ).fetchall()

    result: dict[str, dict] = {}
    for row in rows:
        key = str(row["public_code"] or row["code"] or "")
        result[key] = dict(row)
    return result


def _rift_treatment(meta: dict) -> str:
    public_code = str(meta.get("public_code") or meta.get("code") or "")
    card_type = _clean(meta.get("card_type"))
    rarity = _rift_rarity_key(meta.get("rarity_key") or meta.get("rarity_raw"))

    if "token" in card_type or "rune" in card_type or "jeton" in card_type:
        # Rune variants are kept for the token/rune slot, not premium R+ slots.
        return "token"

    if int(meta.get("is_signed") or 0):
        return "signature"

    if rarity == "ultimate":
        return "ultimate"

    # Numbered above the printed set denominator => Overnumber.
    match = re.search(r"/(\d+)", public_code)
    denominator = int(match.group(1)) if match else 0

    try:
        collector_number = int(meta.get("collector_number") or 0)
    except (TypeError, ValueError):
        collector_number = 0

    if denominator and collector_number > denominator:
        return "overnumber"

    if int(meta.get("is_alt_art") or 0):
        return "alt"

    return "base"


def _rift_pools(
    cards: list[CardOut],
    metadata: dict[str, dict],
) -> tuple[
    dict[str, list[CardOut]],
    dict[str, list[CardOut]],
    list[CardOut],
]:
    base: dict[str, list[CardOut]] = defaultdict(list)
    premium: dict[str, list[CardOut]] = defaultdict(list)
    token_rune: list[CardOut] = []

    for card in cards:
        meta = metadata.get(card.card_number, {})
        treatment = _rift_treatment(meta)
        rarity_key = _rift_rarity_key(card.rarity)

        if treatment == "token":
            token_rune.append(card)
        elif treatment == "base":
            base[rarity_key].append(card)
        else:
            premium[treatment].append(card)

    return base, premium, token_rune


def _rift_epic_slot_probability(epic_pack_probability: float) -> float:
    # Two independent Rare+ slots:
    # 1 - (1 - p_slot)^2 = p_pack
    p_pack = max(0.0, min(0.999999, float(epic_pack_probability)))
    return 1.0 - math.sqrt(1.0 - p_pack)


def _simulate_riftbound(set_code: str) -> list[CardOut]:
    if set_code not in RIFTBOUND_SUPPORTED_SET_IDS:
        raise ValueError(
            f"Le set Riftbound {set_code} n'est pas un booster supporté."
        )

    profile = RIFTBOUND_PROFILES[set_code]
    cards = load_cards("riftbound", set_code)
    metadata = _rift_metadata(set_code)

    if not cards:
        raise ValueError(f"Aucune carte pour riftbound/{set_code}.")

    base, premium, token_rune = _rift_pools(cards, metadata)

    common = base.get("common", [])
    uncommon = base.get("uncommon", [])
    rare = base.get("rare", [])
    epic = base.get("epic", [])

    used: set[str] = set()
    pack: list[CardOut] = []

    for _ in range(7):
        card = _with_slot(_draw(common, used), "Common")
        if card:
            pack.append(card)

    for _ in range(3):
        card = _with_slot(_draw(uncommon, used), "Uncommon")
        if card:
            pack.append(card)

    # At most one premium treatment consumes one of the two Rare+ slots.
    premium_order = [
        ("ultimate", profile.get("ultimate_pack", 0.0)),
        ("signature", profile.get("signature_pack", 0.0)),
        ("overnumber", profile.get("overnumber_pack", 0.0)),
        ("special_alt", profile.get("special_alt_pack", 0.0)),
        ("alt", profile.get("alt_pack", 0.0)),
    ]

    premium_card: CardOut | None = None
    roll = random.random()
    cumulative = 0.0

    for treatment, probability in premium_order:
        pool = premium.get(treatment, [])

        # Vendetta's Special Alt cards are represented as alt cards in the DB;
        # use the alt pool when a dedicated pool is unavailable.
        if treatment == "special_alt" and not pool:
            pool = premium.get("alt", [])

        if not pool:
            continue

        cumulative += max(0.0, float(probability))
        if roll < cumulative:
            variant_label = treatment.replace("_", " ").title()
            premium_card = _with_slot(
                _draw(pool, used),
                variant_label,
                variant=variant_label,
            )
            break

    rare_plus: list[CardOut] = []
    if premium_card:
        rare_plus.append(premium_card)

    epic_slot_probability = _rift_epic_slot_probability(
        profile.get("epic_pack", 0.25)
    )

    while len(rare_plus) < 2:
        if epic and random.random() < epic_slot_probability:
            card = _with_slot(_draw(epic, used), "Epic")
        else:
            card = _with_slot(_draw(rare, used), "Rare")
            if card is None:
                card = _with_slot(_draw(epic, used), "Epic")

        if card is None:
            break

        rare_plus.append(card)

    pack.extend(rare_plus)

    # Dedicated foil slot. Riot only describes the distribution qualitatively,
    # so these C/U/R/E weights remain a clearly marked model assumption.
    foil_class = random.choices(
        list(RIFTBOUND_FOIL_WEIGHTS),
        weights=list(RIFTBOUND_FOIL_WEIGHTS.values()),
        k=1,
    )[0]

    foil_pool = base.get(foil_class, [])
    if not foil_pool:
        foil_pool = common + uncommon

    foil = _draw(foil_pool, allow_repeat=True)
    if foil:
        current_variant = str(foil.variant or "").strip()
        variant = f"{current_variant} · Foil" if current_variant else "Foil"
        foil = _with_slot(foil, "Foil", variant=variant)
        pack.append(foil)

    token = _with_slot(
        _draw(token_rune, allow_repeat=True),
        "Token / Rune",
    )

    if token:
        pack.append(token)
    else:
        pack.append(
            CardOut(
                card_key=f"virtual-rift-token-{secrets.token_hex(8)}",
                game="riftbound",
                product_set=set_code,
                card_number="—",
                name="Token / Rune",
                rarity="Token",
                variant="",
                drop_class="Token / Rune",
                image_url=None,
                collectible=False,
                slot="Token / Rune",
            )
        )

    while len(pack) < 14:
        card = _with_slot(_draw(common, allow_repeat=True), "Common")
        if card is None:
            break
        pack.append(card)

    return pack[:14]


# ============================================================
# PUBLIC ENTRY POINT
# ============================================================

def simulate_booster(game: Game, set_code: str) -> list[CardOut]:
    if game == "onepiece":
        return _simulate_onepiece(set_code)

    if game == "pokemon":
        return _simulate_pokemon(set_code)

    if game == "riftbound":
        return _simulate_riftbound(set_code)

    raise ValueError(f"Jeu non supporté: {game}")
