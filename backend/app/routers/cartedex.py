from typing import Annotated

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
)
from pydantic import BaseModel

from ..auth import get_current_user_id
from ..models import Game
from ..services.cartedex import (
    get_cartedex_set,
)


router = APIRouter(
    prefix="/api/cartedex",
    tags=["cartedex"],
)


class CartedexCardOut(BaseModel):
    card_key: str
    game: Game
    product_set: str
    card_number: str = ""
    name: str
    rarity: str = ""
    variant: str = ""
    drop_class: str = ""
    image_url: str | None = None

    owned: bool
    quantity: int

    first_obtained_at: str | None = None
    last_obtained_at: str | None = None


class CartedexSetOut(BaseModel):
    game: Game
    set_code: str
    owned_cards: int
    total_cards: int
    completion_percent: float
    cards: list[CartedexCardOut]


@router.get(
    "/{game}/{set_code}",
    response_model=CartedexSetOut,
)
def get_cartedex(
    game: Game,
    set_code: str,
    user_id: Annotated[
        str,
        Depends(get_current_user_id),
    ],
):
    try:
        return get_cartedex_set(
            user_id=user_id,
            game=game,
            set_code=set_code,
        )
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=503,
            detail=str(exc),
        ) from exc
