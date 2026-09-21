from __future__ import annotations

from fastapi import HTTPException

from ..config import get_settings
from ..models import CardOut
from ..supabase_client import get_supabase_admin


def get_wallet_balance(user_id: str) -> int:
    response = (
        get_supabase_admin()
        .table("wallets")
        .select("balance_coins")
        .eq("user_id", user_id)
        .single()
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=404,
            detail="Portefeuille introuvable.",
        )

    return int(response.data["balance_coins"])


def get_booster_price(game: str, set_code: str) -> int:
    return int(get_settings().default_booster_price_coins)


def persist_booster_opening(
    *,
    user_id: str,
    game: str,
    set_code: str,
    price_coins: int,
    cards: list[CardOut],
) -> dict:
    payload_cards = [
        card.model_dump(mode="json")
        for card in cards
    ]

    try:
        response = (
            get_supabase_admin()
            .rpc(
                "open_booster_transaction",
                {
                    "p_user_id": user_id,
                    "p_game": game,
                    "p_set_code": set_code,
                    "p_price_coins": int(price_coins),
                    "p_cards": payload_cards,
                },
            )
            .execute()
        )
    except Exception as exc:
        message = str(exc)

        if "INSUFFICIENT_FUNDS" in message:
            raise HTTPException(
                status_code=409,
                detail="Solde insuffisant.",
            ) from exc

        raise HTTPException(
            status_code=500,
            detail=f"Erreur Supabase: {message}",
        ) from exc

    data = response.data

    if isinstance(data, list) and len(data) == 1:
        data = data[0]

    if not isinstance(data, dict):
        raise HTTPException(
            status_code=500,
            detail="Réponse inattendue de Supabase.",
        )

    return data
