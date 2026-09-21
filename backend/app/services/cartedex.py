from __future__ import annotations

from fastapi import HTTPException

from ..models import Game
from ..supabase_client import get_supabase_admin
from .card_catalog import load_cards


def get_cartedex_set(
    *,
    user_id: str,
    game: Game,
    set_code: str,
) -> dict:
    """
    Fusionne le catalogue statique SQLite avec la collection Supabase
    de l'utilisateur.

    Les cartes non possédées gardent leur nom/rareté/numéro, mais leur
    image_url n'est pas renvoyée afin que le frontend puisse afficher
    un placeholder "carte manquante".
    """
    try:
        catalog_cards = load_cards(
            game,
            set_code,
        )
    except FileNotFoundError:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Erreur catalogue: {exc}",
        ) from exc

    collectible_cards = [
        card
        for card in catalog_cards
        if card.collectible
        and card.card_key
    ]

    if not collectible_cards:
        raise HTTPException(
            status_code=404,
            detail="Aucune carte collectible pour cette extension.",
        )

    try:
        response = (
            get_supabase_admin()
            .table("user_collection")
            .select(
                "card_key,quantity,"
                "first_obtained_at,last_obtained_at"
            )
            .eq("user_id", user_id)
            .eq("game", game)
            .eq("product_set", set_code)
            .execute()
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Erreur Supabase collection: {exc}",
        ) from exc

    owned_by_key = {
        str(row["card_key"]): row
        for row in (response.data or [])
        if row.get("card_key")
    }

    result_cards = []

    for card in collectible_cards:
        owned_row = owned_by_key.get(
            card.card_key
        )

        owned = owned_row is not None
        quantity = (
            int(
                owned_row.get(
                    "quantity",
                    0,
                )
                or 0
            )
            if owned
            else 0
        )

        result_cards.append(
            {
                "card_key": card.card_key,
                "game": card.game,
                "product_set": card.product_set,
                "card_number": card.card_number,
                "name": card.name,
                "rarity": card.rarity,
                "variant": card.variant,
                "drop_class": card.drop_class,
                # On ne révèle l'illustration que si la carte est possédée.
                "image_url": (
                    card.image_url
                    if owned
                    else None
                ),
                "owned": owned,
                "quantity": quantity,
                "first_obtained_at": (
                    owned_row.get(
                        "first_obtained_at"
                    )
                    if owned
                    else None
                ),
                "last_obtained_at": (
                    owned_row.get(
                        "last_obtained_at"
                    )
                    if owned
                    else None
                ),
            }
        )

    owned_count = sum(
        1
        for card in result_cards
        if card["owned"]
    )

    total_count = len(result_cards)

    return {
        "game": game,
        "set_code": set_code,
        "owned_cards": owned_count,
        "total_cards": total_count,
        "completion_percent": (
            round(
                owned_count
                / total_count
                * 100,
                1,
            )
            if total_count
            else 0.0
        ),
        "cards": result_cards,
    }
