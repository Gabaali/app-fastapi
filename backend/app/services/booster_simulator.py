from __future__ import annotations

import random

from ..models import CardOut, Game
from .card_catalog import load_cards


PACK_SIZES: dict[Game, int] = {
    "onepiece": 12,
    "pokemon": 10,
    "riftbound": 14,
}


def simulate_booster(game: Game, set_code: str) -> list[CardOut]:
    """
    Simulateur de départ.

    Remplace ensuite ce contenu par les probabilités exactes de ton ancienne app.
    Le reste de l'architecture ne changera pas.
    """
    cards = load_cards(game, set_code)

    if not cards:
        raise ValueError(f"Aucune carte pour {game}/{set_code}.")

    size = PACK_SIZES[game]

    if len(cards) >= size:
        selected = random.sample(cards, k=size)
    else:
        selected = random.choices(cards, k=size)

    return [
        card.model_copy(update={"slot": f"Slot {index}"})
        for index, card in enumerate(selected, start=1)
    ]
