from __future__ import annotations

import random

from ..models import CardOut
from .card_catalog import connect_catalog, load_cards

FLAGS_CARDS_PER_PACK = 10
FLAGS_COMMON_SLOTS = 6
FLAGS_UNCOMMON_SLOTS = 2


def _draw_unique(
    pool: list[CardOut],
    used: set[str],
) -> CardOut | None:
    available = [
        card
        for card in pool
        if card.card_key not in used
    ]

    if not available:
        return None

    card = random.choice(available)
    used.add(card.card_key)
    return card.model_copy(deep=True)


def _with_slot(
    card: CardOut | None,
    slot: str,
) -> CardOut | None:
    if card is None:
        return None

    return card.model_copy(
        update={"slot": slot}
    )


def _load_rarity_config() -> list[dict]:
    with connect_catalog("flags") as conn:
        rows = conn.execute(
            """
            SELECT
                rarity,
                rarity_rank,
                catalog_share,
                card_count,
                guaranteed_slots,
                rare_slot_rate,
                wildcard_rate,
                drop_rate
            FROM rarity_config
            ORDER BY rarity_rank
            """
        ).fetchall()

    return [dict(row) for row in rows]


def _build_pools(
    cards: list[CardOut],
) -> dict[str, list[CardOut]]:
    pools: dict[str, list[CardOut]] = {}

    for card in cards:
        rarity = str(
            card.rarity
            or card.drop_class
            or ""
        ).strip()

        if not rarity:
            continue

        pools.setdefault(
            rarity,
            [],
        ).append(card)

    return pools


def _weighted_draw(
    *,
    pools: dict[str, list[CardOut]],
    config: list[dict],
    weight_field: str,
    used: set[str],
    slot: str,
) -> CardOut | None:
    """
    Tire uniquement dans les raretés Rare+.

    Les lignes Commun / Peu commun peuvent avoir un wildcard_rate dans
    le SQLite, mais elles sont volontairement ignorées ici : le slot Joker
    est, comme demandé, obligatoirement Rare ou mieux.
    """

    candidates: list[tuple[str, float]] = []

    for row in config:
        rank = int(
            row.get("rarity_rank")
            or 0
        )

        if rank < 3:
            continue

        rarity = str(
            row.get("rarity")
            or ""
        ).strip()

        weight = max(
            0.0,
            float(
                row.get(weight_field)
                or 0.0
            ),
        )

        if not rarity or weight <= 0:
            continue

        pool = pools.get(
            rarity,
            [],
        )

        if not any(
            card.card_key not in used
            for card in pool
        ):
            continue

        candidates.append(
            (rarity, weight)
        )

    if not candidates:
        return None

    rarity = random.choices(
        [
            name
            for name, _
            in candidates
        ],
        weights=[
            weight
            for _, weight
            in candidates
        ],
        k=1,
    )[0]

    return _with_slot(
        _draw_unique(
            pools.get(
                rarity,
                [],
            ),
            used,
        ),
        slot,
    )


def simulate_flags_pack(
    set_code: str,
) -> list[CardOut]:
    if set_code.upper() != "WORLD":
        raise ValueError(
            "Le booster Drapeaux supporte "
            "uniquement le set WORLD."
        )

    cards = load_cards(
        "flags",
        set_code,
    )

    if not cards:
        raise ValueError(
            f"Aucun drapeau pour flags/{set_code}."
        )

    config = _load_rarity_config()
    pools = _build_pools(cards)

    by_rank = {
        int(row["rarity_rank"]):
        str(row["rarity"]).strip()
        for row in config
        if row.get("rarity")
        and row.get("rarity_rank")
        is not None
    }

    common_label = by_rank.get(
        1,
        "Commun",
    )

    uncommon_label = by_rank.get(
        2,
        "Peu commun",
    )

    common = pools.get(
        common_label,
        [],
    )

    uncommon = pools.get(
        uncommon_label,
        [],
    )

    if not common:
        raise ValueError(
            "Aucun drapeau Commun dans le catalogue."
        )

    if not uncommon:
        raise ValueError(
            "Aucun drapeau Peu commun dans le catalogue."
        )

    used: set[str] = set()
    pack: list[CardOut] = []

    # 6 Communes garanties.
    for _ in range(
        FLAGS_COMMON_SLOTS
    ):
        card = _with_slot(
            _draw_unique(
                common,
                used,
            ),
            "Commun",
        )

        if card is None:
            raise ValueError(
                "Pas assez de cartes Commun "
                "pour construire le booster."
            )

        pack.append(card)

    # 2 Peu communes garanties.
    for _ in range(
        FLAGS_UNCOMMON_SLOTS
    ):
        card = _with_slot(
            _draw_unique(
                uncommon,
                used,
            ),
            "Peu commun",
        )

        if card is None:
            raise ValueError(
                "Pas assez de cartes Peu commun "
                "pour construire le booster."
            )

        pack.append(card)

    # 1 Rare ou mieux.
    # Les poids viennent de rarity_config.rare_slot_rate.
    rare_plus = _weighted_draw(
        pools=pools,
        config=config,
        weight_field="rare_slot_rate",
        used=used,
        slot="Rare ou mieux",
    )

    if rare_plus is None:
        raise ValueError(
            "Impossible de tirer le slot Rare ou mieux."
        )

    pack.append(rare_plus)

    # 1 Joker Rare+.
    # Les poids Commun/Peu commun présents dans wildcard_rate sont ignorés.
    # Les poids Rare+ restants sont normalisés automatiquement par
    # random.choices().
    joker = _weighted_draw(
        pools=pools,
        config=config,
        weight_field="wildcard_rate",
        used=used,
        slot="Joker Rare+",
    )

    if joker is None:
        raise ValueError(
            "Impossible de tirer le slot Joker Rare+."
        )

    pack.append(joker)

    if len(pack) != FLAGS_CARDS_PER_PACK:
        raise ValueError(
            "Booster Drapeaux incomplet : "
            f"{len(pack)}/{FLAGS_CARDS_PER_PACK}."
        )

    return pack
