from __future__ import annotations

import hashlib
import re
import sqlite3
from contextlib import contextmanager
from functools import lru_cache
from pathlib import Path

from ..config import get_settings
from ..models import CardOut, Game, SetSummary
from .image_mapper import resolve_image_url


DB_FILENAMES = {
    "onepiece": "onepiece_cards.sqlite",
    "pokemon": "pokemon_tcg.sqlite",
    "riftbound": "riftbound_tcg.sqlite",
}


def _stable_hash(*parts: object) -> str:
    raw = "\x1f".join(
        str(part or "").strip()
        for part in parts
    )
    return hashlib.sha256(
        raw.encode("utf-8")
    ).hexdigest()


def _legacy_onepiece_card_key(row) -> str:
    return _stable_hash(
        row["product_set"],
        row["card_number"],
        row["name"],
        row["rarity"],
        row["variant"],
    )


@lru_cache(maxsize=8)
def _db_path(game: str) -> Path:
    settings = get_settings()
    path = (
        settings.card_db_dir
        / DB_FILENAMES[game]
    ).resolve()

    if not path.is_file():
        raise FileNotFoundError(
            f"Base SQLite absente pour {game}: {path}"
        )

    return path


@contextmanager
def connect_catalog(game: Game):
    path = _db_path(game)

    conn = sqlite3.connect(
        f"file:{path}?mode=ro",
        uri=True,
        check_same_thread=False,
    )
    conn.row_factory = sqlite3.Row

    try:
        yield conn
    finally:
        conn.close()


def list_sets(
    game: Game,
) -> list[SetSummary]:
    with connect_catalog(game) as conn:
        if game == "onepiece":
            rows = conn.execute(
                """
                SELECT
                    product_set AS set_code,
                    product_set AS set_name,
                    COUNT(*) AS card_count
                FROM terminal_cards
                WHERE product_set IS NOT NULL
                  AND drop_class IS NOT NULL
                  AND drop_class NOT LIKE 'Promo%'
                GROUP BY product_set
                ORDER BY product_set
                """
            ).fetchall()

        elif game == "pokemon":
            rows = conn.execute(
                """
                SELECT
                    set_id AS set_code,
                    name AS set_name,
                    card_count_total AS card_count
                FROM sets
                ORDER BY release_date DESC, set_id
                """
            ).fetchall()

        else:
            rows = conn.execute(
                """
                SELECT
                    set_code,
                    set_name,
                    card_count
                FROM sets
                WHERE card_count > 0
                ORDER BY set_code
                """
            ).fetchall()

    return [
        SetSummary(
            set_code=str(row["set_code"]),
            set_name=str(
                row["set_name"]
                or row["set_code"]
            ),
            card_count=int(
                row["card_count"] or 0
            ),
        )
        for row in rows
    ]


def load_cards(
    game: Game,
    set_code: str,
) -> list[CardOut]:
    if game == "onepiece":
        return _load_onepiece_cards(
            set_code
        )

    if game == "pokemon":
        return _load_pokemon_cards(
            set_code
        )

    return _load_riftbound_cards(
        set_code
    )


def _op_variant_number(
    value: object,
) -> int:
    match = re.search(
        r"(\d+)",
        str(value or ""),
    )
    return (
        int(match.group(1))
        if match
        else 9999
    )


def _op_is_special(row) -> bool:
    variant = str(
        row["variant"] or ""
    ).upper()

    rarity = str(
        row["rarity"] or ""
    ).upper()

    drop_class = str(
        row["drop_class"] or ""
    ).lower()

    if variant in {
        "ALT",
        "AA",
        "MANGA",
        "SP",
        "TR",
        "PARALLEL",
    }:
        return True

    if rarity == "TR":
        return True

    return any(
        word in drop_class
        for word in (
            "manga",
            "alt",
            "treasure",
            "signature",
            "super",
            "wanted",
            "anniversary",
        )
    )


def _op_source_url(row) -> str | None:
    return resolve_image_url(
        "onepiece",
        local_paths=(
            row["clean_image_path"],
            row["local_image_path"],
        ),
        remote_urls=(
            row["image_url"],
        ),
    )


def _build_onepiece_image_map(
    conn: sqlite3.Connection,
    terminal_rows: list[sqlite3.Row],
) -> dict[int, str | None]:
    """
    Reprend la logique importante de l'ancienne app :
      - override exact prioritaire ;
      - image base pour carte normale ;
      - prints parallèles pour ALT/MANGA/SP/etc.
    """
    if not terminal_rows:
        return {}

    mapping: dict[int, str | None] = {}

    # 1) Overrides exacts basés sur le même card_key que l'ancienne app.
    override_rows = conn.execute(
        """
        SELECT
            card_key,
            local_image_path,
            source_url
        FROM card_image_overrides
        """
    ).fetchall()

    override_by_key = {
        str(row["card_key"]): row
        for row in override_rows
    }

    for terminal in terminal_rows:
        card_key = (
            _legacy_onepiece_card_key(
                terminal
            )
        )

        override = (
            override_by_key.get(card_key)
        )

        if not override:
            continue

        source = resolve_image_url(
            "onepiece",
            local_paths=(
                override[
                    "local_image_path"
                ],
            ),
            remote_urls=(
                override["source_url"],
            ),
        )

        if source:
            mapping[
                int(terminal["terminal_id"])
            ] = source

    # 2) Tous les prints correspondant aux card_number du set.
    numbers = sorted(
        {
            str(row["card_number"])
            for row in terminal_rows
            if row["card_number"]
        }
    )

    if not numbers:
        return mapping

    placeholders = ",".join(
        "?"
        for _ in numbers
    )

    print_rows = conn.execute(
        f"""
        SELECT
            card_uid,
            print_id,
            base_id,
            variant_suffix,
            variant_family,
            image_url,
            local_image_path,
            clean_image_path
        FROM cards
        WHERE base_id IN ({placeholders})
        """,
        numbers,
    ).fetchall()

    by_base: dict[
        str,
        list[sqlite3.Row],
    ] = {}

    for row in print_rows:
        by_base.setdefault(
            str(row["base_id"]),
            [],
        ).append(row)

    terminal_by_number: dict[
        str,
        list[sqlite3.Row],
    ] = {}

    for row in terminal_rows:
        terminal_by_number.setdefault(
            str(row["card_number"]),
            [],
        ).append(row)

    for card_number, terminal_group in (
        terminal_by_number.items()
    ):
        candidates = list(
            by_base.get(
                card_number,
                [],
            )
        )

        if not candidates:
            continue

        candidates.sort(
            key=lambda row: (
                _op_variant_number(
                    row["variant_suffix"]
                ),
                str(
                    row["print_id"]
                    or ""
                ),
            )
        )

        base_candidates = [
            row
            for row in candidates
            if (
                str(
                    row["variant_family"]
                    or ""
                ).lower()
                == "base"
                or not row[
                    "variant_suffix"
                ]
            )
        ]

        parallel_candidates = [
            row
            for row in candidates
            if row not in base_candidates
        ]

        terminal_group = sorted(
            terminal_group,
            key=lambda row: int(
                row["terminal_id"]
            ),
        )

        terminal_base = [
            row
            for row in terminal_group
            if not _op_is_special(row)
        ]

        terminal_special = [
            row
            for row in terminal_group
            if _op_is_special(row)
        ]

        base_source_row = (
            base_candidates[0]
            if base_candidates
            else candidates[0]
        )

        base_source = _op_source_url(
            base_source_row
        )

        for row in terminal_base:
            terminal_id = int(
                row["terminal_id"]
            )

            if terminal_id not in mapping:
                mapping[
                    terminal_id
                ] = base_source

        if terminal_special:
            source_rows = (
                parallel_candidates
                if parallel_candidates
                else candidates
            )

            for index, row in enumerate(
                terminal_special
            ):
                terminal_id = int(
                    row["terminal_id"]
                )

                if terminal_id in mapping:
                    continue

                candidate = source_rows[
                    min(
                        index,
                        len(source_rows) - 1,
                    )
                ]

                mapping[
                    terminal_id
                ] = _op_source_url(
                    candidate
                )

    return mapping


def _load_onepiece_cards(
    set_code: str,
) -> list[CardOut]:
    with connect_catalog(
        "onepiece"
    ) as conn:
        terminal_rows = conn.execute(
            """
            SELECT
                terminal_id,
                product_set,
                card_number,
                name,
                rarity,
                COALESCE(variant, '') AS variant,
                drop_class
            FROM terminal_cards
            WHERE product_set = ?
              AND drop_class IS NOT NULL
              AND drop_class NOT LIKE 'Promo%'
            ORDER BY terminal_id
            """,
            (set_code,),
        ).fetchall()

        image_map = (
            _build_onepiece_image_map(
                conn,
                terminal_rows,
            )
        )

    cards = []

    for row in terminal_rows:
        cards.append(
            CardOut(
                card_key=(
                    _legacy_onepiece_card_key(
                        row
                    )
                ),
                game="onepiece",
                product_set=str(
                    row["product_set"]
                ),
                card_number=str(
                    row["card_number"] or ""
                ),
                name=str(
                    row["name"] or ""
                ),
                rarity=str(
                    row["rarity"] or ""
                ),
                variant=str(
                    row["variant"] or ""
                ),
                drop_class=str(
                    row["drop_class"] or ""
                ),
                image_url=image_map.get(
                    int(
                        row["terminal_id"]
                    )
                ),
            )
        )

    return cards


def _load_pokemon_cards(
    set_code: str,
) -> list[CardOut]:
    with connect_catalog(
        "pokemon"
    ) as conn:
        rows = conn.execute(
            """
            SELECT
                card_id,
                local_id,
                set_id,
                name,
                rarity,
                local_image_path,
                image_high_url,
                image_low_url
            FROM cards
            WHERE set_id = ?
            ORDER BY
                CAST(local_id AS INTEGER),
                local_id
            """,
            (set_code,),
        ).fetchall()

    cards = []

    for row in rows:
        source_id = str(
            row["card_id"]
        )

        image_url = resolve_image_url(
            "pokemon",
            local_paths=(
                row["local_image_path"],
            ),
            remote_urls=(
                row["image_high_url"],
                row["image_low_url"],
            ),
        )

        cards.append(
            CardOut(
                card_key=_stable_hash(
                    "pokemon",
                    source_id,
                ),
                game="pokemon",
                product_set=str(
                    row["set_id"]
                ),
                card_number=str(
                    row["local_id"] or ""
                ),
                name=str(
                    row["name"] or ""
                ),
                rarity=str(
                    row["rarity"] or ""
                ),
                drop_class=str(
                    row["rarity"] or ""
                ),
                image_url=image_url,
            )
        )

    return cards


def _load_riftbound_cards(
    set_code: str,
) -> list[CardOut]:
    with connect_catalog(
        "riftbound"
    ) as conn:
        rows = conn.execute(
            """
            SELECT
                card_uid,
                public_code,
                code,
                set_code,
                name,
                rarity_raw,
                rarity_key,
                local_image_path,
                image_full_url,
                image_url
            FROM cards
            WHERE set_code = ?
              AND active = 1
              AND LOWER(
                  COALESCE(
                      rarity_key,
                      ''
                  )
              ) != 'promo'
            ORDER BY
                collector_number,
                public_code
            """,
            (set_code,),
        ).fetchall()

    cards = []

    for row in rows:
        source_id = str(
            row["card_uid"]
        )

        rarity = str(
            row["rarity_raw"]
            or row["rarity_key"]
            or ""
        )

        image_url = resolve_image_url(
            "riftbound",
            local_paths=(
                row["local_image_path"],
            ),
            remote_urls=(
                row["image_full_url"],
                row["image_url"],
            ),
        )

        cards.append(
            CardOut(
                card_key=_stable_hash(
                    "riftbound",
                    source_id,
                ),
                game="riftbound",
                product_set=str(
                    row["set_code"]
                ),
                card_number=str(
                    row["public_code"]
                    or row["code"]
                    or ""
                ),
                name=str(
                    row["name"] or ""
                ),
                rarity=rarity,
                drop_class=rarity,
                image_url=image_url,
            )
        )

    return cards
