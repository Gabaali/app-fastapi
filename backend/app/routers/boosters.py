from typing import Annotated

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
)

from ..auth import get_current_user_id
from ..models import (
    BoosterOpenRequest,
    BoosterOpenResponse,
)
from ..services.booster_simulator import (
    simulate_booster,
)
from ..services.game_store import (
    get_booster_price,
    persist_booster_opening,
)


router = APIRouter(
    prefix="/api/boosters",
    tags=["boosters"],
)


@router.post(
    "/open",
    response_model=BoosterOpenResponse,
)
def open_booster(
    body: BoosterOpenRequest,
    user_id: Annotated[
        str,
        Depends(get_current_user_id),
    ],
):
    price = get_booster_price(
        body.game,
        body.set_code,
    )

    try:
        cards = simulate_booster(
            body.game,
            body.set_code,
        )

    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=503,
            detail=str(exc),
        ) from exc

    except ValueError as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc),
        ) from exc

    transaction = persist_booster_opening(
        user_id=user_id,
        game=body.game,
        set_code=body.set_code,
        price_coins=price,
        cards=cards,
    )

    # Positions des cartes qui n'étaient
    # pas encore dans le Cartédex avant
    # cette ouverture.
    new_positions = {
        int(position)
        for position
        in transaction.get(
            "new_positions",
            [],
        )
    }

    # On ajoute is_new aux cartes renvoyées
    # au frontend.
    response_cards = [
        card.model_copy(
            update={
                "is_new":
                    position
                    in new_positions
            }
        )
        for position, card
        in enumerate(
            cards,
            start=1,
        )
    ]

    return BoosterOpenResponse(
        opening_id=int(
            transaction["opening_id"]
        ),
        balance=int(
            transaction["balance"]
        ),
        price_coins=price,
        cards=response_cards,
    )