from __future__ import annotations

from urllib.parse import quote

from ..config import get_settings
from ..models import Game


GAME_PREFIXES = {
    "onepiece": "onepiece",
    "pokemon": "pokemon",
    "riftbound": "riftbound",
}


def _normalize(value: object) -> str:
    return (
        str(value or "")
        .strip()
        .replace("\\", "/")
        .lstrip("./")
    )


def _r2_relative_path(
    game: Game,
    raw_path: object,
) -> str | None:

    value = _normalize(raw_path)

    if not value:
        return None

    lower = value.lower()

    # Pokémon
    if game == "pokemon":
        prefix = "pokemon_images/"

        if lower.startswith(prefix):
            return value[len(prefix):]

        return value

    # Riftbound
    if game == "riftbound":
        prefix = "riftbound_images/"

        if lower.startswith(prefix):
            return value[len(prefix):]

        return value

    # One Piece
    if lower.startswith("images/"):
        return value[len("images/"):]

    if lower.startswith("optc_images/"):
        return value[len("optc_images/"):]

    if lower.startswith(
        "assets/clean_cards/scans/"
    ):
        tail = value[
            len("assets/clean_cards/scans/"):
        ]

        return f"clean_cards/scans/{tail}"

    if lower.startswith(
        "images_poneglyph/"
    ):
        tail = value[
            len("images_poneglyph/"):
        ]

        return f"poneglyph/{tail}"

    return value


def r2_image_url(
    game: Game,
    raw_path: object,
) -> str | None:

    relative = _r2_relative_path(
        game,
        raw_path,
    )

    if not relative:
        return None

    settings = get_settings()

    base = (
        settings
        .card_media_base_url
        .rstrip("/")
    )

    game_prefix = GAME_PREFIXES[game]

    encoded_path = "/".join(
        quote(part)
        for part in relative.split("/")
        if part
    )

    return (
        f"{base}/"
        f"{game_prefix}/"
        f"{encoded_path}"
    )


def remote_image_url(
    *values: object,
) -> str | None:

    for value in values:
        text = str(
            value or ""
        ).strip()

        if text.startswith(
            ("https://", "http://")
        ):
            return text

    return None


def resolve_image_url(
    game: Game,
    *,
    local_paths: tuple[object, ...] = (),
    remote_urls: tuple[object, ...] = (),
) -> str | None:

    # Les anciens chemins "locaux"
    # deviennent maintenant des URLs R2.
    for raw_path in local_paths:

        url = r2_image_url(
            game,
            raw_path,
        )

        if url:
            return url

    # Fallback vers l'ancienne URL Internet.
    return remote_image_url(
        *remote_urls,
    )